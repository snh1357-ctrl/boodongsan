// src/hooks/useAptSearch.ts
import { useState, useCallback, useEffect } from 'react'
import type { AptResult, RawDeal } from '../types'
import { aggregateByArea } from '../lib/aggregate'

interface SearchParams { dongCode: string; aptName: string }
interface SearchState {
  results: AptResult[]       // 테이블에 고정된 항목
  pending: AptResult[]       // 검색 후 드랍다운에 표시 중인 항목
  loading: boolean
  loadingAth: boolean
  error: string | null
}

const currentYear = new Date().getFullYear()
const ATH_START_YEAR = 2012

function athChunks(): [number, number][] {
  const endYear = currentYear - 1
  if (ATH_START_YEAR > endYear) return []
  const chunks: [number, number][] = []
  for (let y = ATH_START_YEAR; y <= endYear; y += 4) {
    chunks.push([y, Math.min(y + 3, endYear)])
  }
  return chunks
}

function loadSavedResults(): AptResult[] {
  try { return JSON.parse(localStorage.getItem('apt_results') || '[]') } catch { return [] }
}

async function fetchChunk(dongCode: string, aptName: string, fromYear: number, toYear: number): Promise<RawDeal[]> {
  const url = `/api/search?dongCode=${encodeURIComponent(dongCode)}&aptName=${encodeURIComponent(aptName)}&fromYear=${fromYear}&toYear=${toYear}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return []
  const data = await res.json() as { deals: RawDeal[] }
  return data.deals ?? []
}

function buildResults(deals: RawDeal[], searchTerm: string, dongCode: string, athLoaded: boolean): AptResult[] {
  const grouped = new Map<string, RawDeal[]>()
  for (const d of deals) {
    const name = (d.aptNm ?? '').trim()
    if (!name) continue
    if (!grouped.has(name)) grouped.set(name, [])
    grouped.get(name)!.push(d)
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ko'))
    .map(([molitName, molitDeals]) => {
      // 가장 많이 등장하는 건축년도 사용
      const yearCount = new Map<string, number>()
      for (const d of molitDeals) {
        if (d.buildYear) yearCount.set(d.buildYear, (yearCount.get(d.buildYear) ?? 0) + 1)
      }
      const buildYear = yearCount.size > 0
        ? [...yearCount.entries()].sort((a, b) => b[1] - a[1])[0][0]
        : undefined
      return {
        aptName: molitName,
        searchTerm,
        dongCode,
        units: aggregateByArea(molitDeals),
        athLoaded,
        buildYear,
      }
    })
}

// results 배열에서 searchTerm+dongCode 그룹 제거
function removeBySearch(arr: AptResult[], searchTerm: string, dongCode: string) {
  return arr.filter(r => !(r.searchTerm === searchTerm && r.dongCode === dongCode))
}

export function useAptSearch() {
  const [state, setState] = useState<SearchState>(() => ({
    results: loadSavedResults(),
    pending: [],
    loading: false,
    loadingAth: false,
    error: null,
  }))

  useEffect(() => {
    try { localStorage.setItem('apt_results', JSON.stringify(state.results)) } catch {}
  }, [state.results])

  const search = useCallback(async ({ dongCode, aptName }: SearchParams) => {
    setState(prev => ({ ...prev, loading: true, loadingAth: false, error: null, pending: [] }))

    try {
      // Phase 1: 최근 12개월
      let recentDeals = await fetchChunk(dongCode, aptName, currentYear - 1, currentYear)

      // fallback: 최근 5년
      if (recentDeals.length === 0) {
        const [a, b] = await Promise.all([
          fetchChunk(dongCode, aptName, currentYear - 5, currentYear - 2),
          fetchChunk(dongCode, aptName, currentYear - 1, currentYear),
        ])
        recentDeals = [...a, ...b]
      }

      const newPending = buildResults(recentDeals, aptName, dongCode, false)

      // 단지가 하나이면 드랍다운 없이 바로 추가
      if (newPending.length === 1) {
        setState(prev => {
          const item = newPending[0]
          const exists = prev.results.some(r => r.aptName === item.aptName && r.dongCode === item.dongCode)
          return {
            ...prev,
            pending: [],
            loading: false,
            loadingAth: true,
            error: null,
            results: exists
              ? prev.results.map(r => r.aptName === item.aptName && r.dongCode === item.dongCode ? item : r)
              : [...prev.results, item],
          }
        })
      } else {
        setState(prev => ({
          ...prev,
          pending: newPending,
          loading: false,
          loadingAth: true,
          error: null,
        }))
      }

      loadAth(dongCode, aptName, recentDeals)
    } catch (e) {
      setState(prev => ({
        ...prev,
        loading: false,
        loadingAth: false,
        error: e instanceof Error ? e.message : '조회 실패',
      }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function loadAth(dongCode: string, aptName: string, recentDeals: RawDeal[]) {
    const chunks = athChunks()

    const finish = (athResults: AptResult[]) => {
      setState(prev => {
        // pending 업데이트 (아직 추가 안 한 것들)
        const pendingNames = new Set(prev.pending.map(r => r.aptName))
        const newPending = athResults.filter(r => pendingNames.has(r.aptName))

        // results에 이미 추가된 것들도 ATH 업데이트
        const addedNames = new Set(
          prev.results
            .filter(r => r.searchTerm === aptName && r.dongCode === dongCode)
            .map(r => r.aptName)
        )
        const updatedResults = prev.results.map(r =>
          r.searchTerm === aptName && r.dongCode === dongCode && addedNames.has(r.aptName)
            ? (athResults.find(a => a.aptName === r.aptName) ?? r)
            : r
        )

        return { ...prev, loadingAth: false, pending: newPending, results: updatedResults }
      })
    }

    if (chunks.length === 0) {
      setState(prev => {
        const updated = prev.pending.map(r => ({ ...r, athLoaded: true }))
        return { ...prev, loadingAth: false, pending: updated }
      })
      return
    }

    Promise.all(chunks.map(([from, to]) => fetchChunk(dongCode, aptName, from, to)))
      .then(chunkDeals => {
        const allDeals = [...recentDeals, ...chunkDeals.flat()]
        finish(buildResults(allDeals, aptName, dongCode, true))
      })
      .catch(() => setState(prev => ({ ...prev, loadingAth: false })))
  }

  // 드랍다운에서 단건 테이블 추가
  const addToTable = useCallback((aptName: string, dongCode: string) => {
    setState(prev => {
      const item = prev.pending.find(r => r.aptName === aptName && r.dongCode === dongCode)
      if (!item) return prev
      return {
        ...prev,
        pending: prev.pending.filter(r => !(r.aptName === aptName && r.dongCode === dongCode)),
        // 같은 항목이 이미 테이블에 있으면 업데이트, 없으면 추가
        results: prev.results.some(r => r.aptName === aptName && r.dongCode === dongCode)
          ? prev.results.map(r => r.aptName === aptName && r.dongCode === dongCode ? item : r)
          : [...prev.results, item],
      }
    })
  }, [])

  // 드랍다운에서 전체 테이블 추가
  const addAllToTable = useCallback(() => {
    setState(prev => {
      if (prev.pending.length === 0) return prev
      const existingKeys = new Set(prev.results.map(r => `${r.aptName}__${r.dongCode}`))
      const toAdd = prev.pending.filter(r => !existingKeys.has(`${r.aptName}__${r.dongCode}`))
      const toUpdate = prev.pending.filter(r => existingKeys.has(`${r.aptName}__${r.dongCode}`))
      return {
        ...prev,
        pending: [],
        results: [
          ...prev.results.map(r => toUpdate.find(u => u.aptName === r.aptName && u.dongCode === r.dongCode) ?? r),
          ...toAdd,
        ],
      }
    })
  }, [])

  // 드랍다운 닫기
  const clearPending = useCallback(() => {
    setState(prev => ({ ...prev, pending: [] }))
  }, [])

  // 테이블 개별 삭제
  const removeResult = useCallback((aptName: string, dongCode: string) => {
    setState(prev => ({
      ...prev,
      results: prev.results.filter(r => !(r.aptName === aptName && r.dongCode === dongCode)),
    }))
  }, [])

  // 테이블 그룹 전체 삭제
  const removeGroup = useCallback((searchTerm: string, dongCode: string) => {
    setState(prev => ({
      ...prev,
      results: removeBySearch(prev.results, searchTerm, dongCode),
    }))
  }, [])

  return { ...state, search, addToTable, addAllToTable, clearPending, removeResult, removeGroup }
}
