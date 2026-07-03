// src/hooks/useAptSearch.ts
import { useState, useCallback, useEffect } from 'react'
import type { AptResult, RawDeal } from '../types'
import { aggregateByArea, dedupeDeals } from '../lib/aggregate'

interface AptInfo {
  houseHoldCnt: number | null
  buildYear: string | null
  exclusiveRatio: number | null
  parkingPerHousehold: number | null
}

interface RawRent {
  aptNm: string
  excluUseAr: string
  deposit: string
  monthlyRent: string
  dealYear: string
  dealMonth: string
  dealDay: string
}

// 최근 12개월 전월세에서 면적별 최신 순수 전세(월세 0) 보증금 추출
async function fetchJeonseByArea(aptName: string, dongCode: string): Promise<Map<number, { price: number; date: string }>> {
  const map = new Map<number, { price: number; date: string }>()
  try {
    const url = `/api/rent?dongCode=${encodeURIComponent(dongCode)}&aptName=${encodeURIComponent(aptName)}&months=12`
    const res = await fetch(url)
    if (!res.ok) return map
    const data = await res.json() as { rents: RawRent[] }
    for (const r of data.rents ?? []) {
      if ((parseInt(r.monthlyRent) || 0) > 0) continue  // 월세 낀 계약 제외
      const deposit = parseInt(r.deposit) || 0
      if (deposit <= 0) continue
      const area = Math.round(parseFloat(r.excluUseAr) * 100) / 100
      const date = `${r.dealYear}-${String(+r.dealMonth).padStart(2, '0')}-${String(+r.dealDay).padStart(2, '0')}`
      const prev = map.get(area)
      if (!prev || date > prev.date) map.set(area, { price: deposit, date })
    }
  } catch {}
  return map
}

async function fetchAptInfo(aptName: string, dongCode: string): Promise<AptInfo | null> {
  try {
    const url = `/api/apt-info?aptName=${encodeURIComponent(aptName)}&dongCode=${encodeURIComponent(dongCode)}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json() as {
      found: boolean
      houseHoldCnt?: number | null
      buildYear?: string | null
      exclusiveRatio?: number | null
      parkingPerHousehold?: number | null
    }
    if (!data.found) return null
    return {
      houseHoldCnt: data.houseHoldCnt ?? null,
      buildYear: data.buildYear ?? null,
      exclusiveRatio: data.exclusiveRatio ?? null,
      parkingPerHousehold: data.parkingPerHousehold ?? null,
    }
  } catch {
    return null
  }
}

interface SearchParams { dongCode: string; aptName: string }
interface SearchState {
  results: AptResult[]       // 테이블에 고정된 항목
  pending: AptResult[]       // 검색 후 드랍다운에 표시 중인 항목
  loading: boolean
  loadingAth: boolean
  error: string | null
  noResult: string | null    // 검색 결과 0건이었던 아파트명 (피드백 표시용)
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
    noResult: null,
  }))

  useEffect(() => {
    try { localStorage.setItem('apt_results', JSON.stringify(state.results)) } catch {}
  }, [state.results])

  // 단지 정보(세대수·연식·전용률·주차) + 전세가 조회 후 results에 반영
  const loadAptInfo = useCallback((aptName: string, dongCode: string) => {
    fetchAptInfo(aptName, dongCode).then(info => {
      if (info === null) return
      setState(prev => ({
        ...prev,
        results: prev.results.map(r =>
          r.aptName === aptName && r.dongCode === dongCode
            ? {
                ...r,
                houseHoldCnt: info.houseHoldCnt ?? r.houseHoldCnt,
                buildYear: r.buildYear ?? info.buildYear ?? undefined,
                exclusiveRatio: info.exclusiveRatio ?? r.exclusiveRatio,
                parkingPerHousehold: info.parkingPerHousehold ?? r.parkingPerHousehold,
              }
            : r
        ),
      }))
    })
    fetchJeonseByArea(aptName, dongCode).then(jeonseMap => {
      if (jeonseMap.size === 0) return
      setState(prev => ({
        ...prev,
        results: prev.results.map(r =>
          r.aptName === aptName && r.dongCode === dongCode
            ? {
                ...r,
                units: r.units.map(u => {
                  const j = jeonseMap.get(u.area)
                  if (!j) return u
                  return {
                    ...u,
                    jeonse: j,
                    jeonseRatio: u.lastDeal.price > 0 ? Math.round((j.price / u.lastDeal.price) * 100) : undefined,
                  }
                }),
              }
            : r
        ),
      }))
    })
  }, [])

  // localStorage에서 복원된 결과 중 단지·전세 정보가 없는 항목 보강 (최초 1회)
  useEffect(() => {
    const missing = loadSavedResults().filter(r =>
      r.houseHoldCnt == null || r.exclusiveRatio == null || r.units.some(u => u.jeonse == null)
    )
    missing.forEach(r => loadAptInfo(r.aptName, r.dongCode))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const search = useCallback(async ({ dongCode, aptName }: SearchParams) => {
    setState(prev => ({ ...prev, loading: true, loadingAth: false, error: null, pending: [], noResult: null }))

    try {
      // ATH 전체 기간 조회를 최근 거래 조회와 동시에 시작 (대기 시간 단축)
      const athPromise = Promise.all(
        athChunks().map(([from, to]) => fetchChunk(dongCode, aptName, from, to))
      )

      // Phase 1: 최근 12개월
      let recentDeals = await fetchChunk(dongCode, aptName, currentYear - 1, currentYear)

      // fallback: 최근 5년
      if (recentDeals.length === 0) {
        recentDeals = await fetchChunk(dongCode, aptName, currentYear - 5, currentYear - 2)
      }

      let newPending = buildResults(recentDeals, aptName, dongCode, false)
      let athDone = false

      // 최근 5년 거래가 없으면 전체 기간(2012~)에서 확인
      if (newPending.length === 0) {
        const chunkDeals = await athPromise
        const allDeals = dedupeDeals([...recentDeals, ...chunkDeals.flat()])
        newPending = buildResults(allDeals, aptName, dongCode, true)
        athDone = true
        // 전체 기간에도 거래가 없음 → 명시적 피드백 (신축·전매제한 등)
        if (newPending.length === 0) {
          setState(prev => ({ ...prev, loading: false, loadingAth: false, pending: [], noResult: aptName }))
          return
        }
      }

      // 단지가 하나이면 드랍다운 없이 바로 추가
      if (newPending.length === 1) {
        const item = newPending[0]
        setState(prev => {
          const exists = prev.results.some(r => r.aptName === item.aptName && r.dongCode === item.dongCode)
          return {
            ...prev,
            pending: [],
            loading: false,
            loadingAth: !athDone,
            error: null,
            results: exists
              ? prev.results.map(r => r.aptName === item.aptName && r.dongCode === item.dongCode ? item : r)
              : [...prev.results, item],
          }
        })
        loadAptInfo(item.aptName, item.dongCode)
      } else {
        setState(prev => ({
          ...prev,
          pending: newPending,
          loading: false,
          loadingAth: !athDone,
          error: null,
        }))
      }

      if (!athDone) loadAth(dongCode, aptName, recentDeals, athPromise)
    } catch (e) {
      setState(prev => ({
        ...prev,
        loading: false,
        loadingAth: false,
        error: e instanceof Error ? e.message : '조회 실패',
      }))
    }
  }, [loadAptInfo]) // eslint-disable-line react-hooks/exhaustive-deps

  function loadAth(
    dongCode: string,
    aptName: string,
    recentDeals: RawDeal[],
    athPromise: Promise<RawDeal[][]>,
  ) {
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
        const updatedResults = prev.results.map(r => {
          if (r.searchTerm !== aptName || r.dongCode !== dongCode || !addedNames.has(r.aptName)) return r
          const a = athResults.find(a => a.aptName === r.aptName)
          if (!a) return r
          // 이미 조회된 단지 정보(세대수·전용률·연식·주차·전세)는 유지
          return {
            ...a,
            houseHoldCnt: r.houseHoldCnt,
            exclusiveRatio: r.exclusiveRatio,
            parkingPerHousehold: r.parkingPerHousehold,
            buildYear: a.buildYear ?? r.buildYear,
            units: a.units.map(u => {
              const old = r.units.find(o => o.area === u.area)
              if (!old?.jeonse) return u
              return {
                ...u,
                jeonse: old.jeonse,
                jeonseRatio: u.lastDeal.price > 0 ? Math.round((old.jeonse.price / u.lastDeal.price) * 100) : old.jeonseRatio,
              }
            }),
          }
        })

        return { ...prev, loadingAth: false, pending: newPending, results: updatedResults }
      })
    }

    athPromise
      .then(chunkDeals => {
        const allDeals = dedupeDeals([...recentDeals, ...chunkDeals.flat()])
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
        results: prev.results.some(r => r.aptName === aptName && r.dongCode === dongCode)
          ? prev.results.map(r => r.aptName === aptName && r.dongCode === dongCode ? item : r)
          : [...prev.results, item],
      }
    })
    loadAptInfo(aptName, dongCode)
  }, [loadAptInfo])

  // 드랍다운에서 전체 테이블 추가
  const addAllToTable = useCallback(() => {
    let toFetch: { aptName: string; dongCode: string }[] = []
    setState(prev => {
      if (prev.pending.length === 0) return prev
      const existingKeys = new Set(prev.results.map(r => `${r.aptName}__${r.dongCode}`))
      const toAdd = prev.pending.filter(r => !existingKeys.has(`${r.aptName}__${r.dongCode}`))
      const toUpdate = prev.pending.filter(r => existingKeys.has(`${r.aptName}__${r.dongCode}`))
      toFetch = prev.pending.map(r => ({ aptName: r.aptName, dongCode: r.dongCode }))
      return {
        ...prev,
        pending: [],
        results: [
          ...prev.results.map(r => toUpdate.find(u => u.aptName === r.aptName && u.dongCode === r.dongCode) ?? r),
          ...toAdd,
        ],
      }
    })
    toFetch.forEach(({ aptName, dongCode }) => loadAptInfo(aptName, dongCode))
  }, [loadAptInfo])

  // 드랍다운 닫기 (결과 없음 메시지도 함께 닫음)
  const clearPending = useCallback(() => {
    setState(prev => ({ ...prev, pending: [], noResult: null }))
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
