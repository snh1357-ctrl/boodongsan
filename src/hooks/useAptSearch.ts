// src/hooks/useAptSearch.ts
import { useState, useCallback, useEffect } from 'react'
import type { AptResult, RawDeal } from '../types'
import { aggregateByArea } from '../lib/aggregate'

interface SearchParams { dongCode: string; aptName: string }
interface SearchState  { results: AptResult[]; loading: boolean; loadingAth: boolean; error: string | null }

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

// 동일 검색어로 조회된 기존 결과 모두 제거
function removeBySearch(results: AptResult[], searchTerm: string, dongCode: string) {
  return results.filter(r => !(r.searchTerm === searchTerm && r.dongCode === dongCode))
}

// 거래 데이터를 MOLIT aptNm 별로 그룹화 → 각각 AptResult 생성
function buildResults(deals: RawDeal[], searchTerm: string, dongCode: string, athLoaded: boolean): AptResult[] {
  const grouped = new Map<string, RawDeal[]>()
  for (const d of deals) {
    const name = (d.aptNm ?? '').trim()
    if (!name) continue
    if (!grouped.has(name)) grouped.set(name, [])
    grouped.get(name)!.push(d)
  }
  // 이름 오름차순 정렬 (차수 순서: 현대1차, 현대2차, ...)
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ko'))
    .map(([molitName, molitDeals]) => ({
      aptName: molitName,
      searchTerm,
      dongCode,
      units: aggregateByArea(molitDeals),
      athLoaded,
    }))
}

export function useAptSearch() {
  const [state, setState] = useState<SearchState>(() => ({
    results: loadSavedResults(),
    loading: false,
    loadingAth: false,
    error: null,
  }))

  useEffect(() => {
    try { localStorage.setItem('apt_results', JSON.stringify(state.results)) } catch {}
  }, [state.results])

  const search = useCallback(async ({ dongCode, aptName }: SearchParams) => {
    setState(prev => ({ ...prev, loading: true, loadingAth: false, error: null }))

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

      const newResults = buildResults(recentDeals, aptName, dongCode, false)

      setState(prev => ({
        results: [
          ...newResults,
          ...removeBySearch(prev.results, aptName, dongCode),
        ],
        loading: false,
        loadingAth: true,
        error: null,
      }))

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
    if (chunks.length === 0) {
      setState(prev => ({
        ...prev,
        loadingAth: false,
        results: prev.results.map(r =>
          r.searchTerm === aptName && r.dongCode === dongCode ? { ...r, athLoaded: true } : r
        ),
      }))
      return
    }

    Promise.all(chunks.map(([from, to]) => fetchChunk(dongCode, aptName, from, to)))
      .then(chunkDeals => {
        const allDeals = [...recentDeals, ...chunkDeals.flat()]
        const athResults = buildResults(allDeals, aptName, dongCode, true)
        setState(prev => ({
          ...prev,
          loadingAth: false,
          results: [
            ...athResults,
            ...removeBySearch(prev.results, aptName, dongCode),
          ],
        }))
      })
      .catch(() => setState(prev => ({ ...prev, loadingAth: false })))
  }

  // 개별 행 삭제 (aptName = MOLIT 이름 기준)
  const removeResult = useCallback((aptName: string, dongCode: string) => {
    setState(prev => ({
      ...prev,
      results: prev.results.filter(r => !(r.aptName === aptName && r.dongCode === dongCode)),
    }))
  }, [])

  // 검색 그룹 전체 삭제 (searchTerm 기준)
  const removeGroup = useCallback((searchTerm: string, dongCode: string) => {
    setState(prev => ({
      ...prev,
      results: removeBySearch(prev.results, searchTerm, dongCode),
    }))
  }, [])

  return { ...state, search, removeResult, removeGroup }
}
