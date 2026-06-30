// src/hooks/useAptSearch.ts
import { useState, useCallback, useEffect } from 'react'
import type { AptResult, RawDeal } from '../types'
import { aggregateByArea } from '../lib/aggregate'

interface SearchParams { dongCode: string; aptName: string }
interface SearchState  { results: AptResult[]; loading: boolean; loadingAth: boolean; error: string | null }

// Phase 1 (빠른 조회): 최근 2년 → 현재가·3개월 평균 즉시 표시
// Phase 2 (ATH 조회): 2012~2년전 → 역대 최고가 업데이트 (백그라운드)
const RECENT_YEARS = 2
const ATH_START_YEAR = 2012

const currentYear = new Date().getFullYear()

// Phase 2: 2012 ~ (현재-2년)을 3년 청크로 분할, 각 Worker 서브요청 ≤ 45개
function athChunks(): [number, number][] {
  const endYear = currentYear - RECENT_YEARS
  if (ATH_START_YEAR > endYear) return []
  const chunks: [number, number][] = []
  for (let y = ATH_START_YEAR; y <= endYear; y += 3) {
    chunks.push([y, Math.min(y + 2, endYear)])
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
      // Phase 1: 최근 2년 (빠름, ~24개월)
      const recentDeals = await fetchChunk(dongCode, aptName, currentYear - RECENT_YEARS + 1, currentYear)
      if (recentDeals.length === 0) {
        // 최근 데이터 없으면 좀 더 넓게 시도
        const extendedDeals = await fetchChunk(dongCode, aptName, currentYear - 5, currentYear)
        const units = aggregateByArea(extendedDeals)
        const result: AptResult = { aptName, dongCode, units, athLoaded: false }
        setState(prev => ({
          results: [result, ...prev.results.filter(r => !(r.aptName === aptName && r.dongCode === dongCode))],
          loading: false,
          loadingAth: true,
          error: null,
        }))
        // Phase 2
        loadAth(dongCode, aptName, extendedDeals)
        return
      }

      const units = aggregateByArea(recentDeals)
      const result: AptResult = { aptName, dongCode, units, athLoaded: false }
      setState(prev => ({
        results: [result, ...prev.results.filter(r => !(r.aptName === aptName && r.dongCode === dongCode))],
        loading: false,
        loadingAth: true,
        error: null,
      }))

      // Phase 2: ATH 조회 (백그라운드)
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
          r.aptName === aptName && r.dongCode === dongCode
            ? { ...r, athLoaded: true }
            : r
        ),
      }))
      return
    }

    Promise.all(chunks.map(([from, to]) => fetchChunk(dongCode, aptName, from, to)))
      .then(chunkDeals => {
        const allDeals: RawDeal[] = [...recentDeals, ...chunkDeals.flat()]
        const units = aggregateByArea(allDeals)
        setState(prev => ({
          ...prev,
          loadingAth: false,
          results: prev.results.map(r =>
            r.aptName === aptName && r.dongCode === dongCode
              ? { aptName, dongCode, units, athLoaded: true }
              : r
          ),
        }))
      })
      .catch(() => {
        setState(prev => ({ ...prev, loadingAth: false }))
      })
  }

  const removeResult = useCallback((aptName: string, dongCode: string) => {
    setState(prev => ({
      ...prev,
      results: prev.results.filter(r => !(r.aptName === aptName && r.dongCode === dongCode)),
    }))
  }, [])

  return { ...state, search, removeResult }
}
