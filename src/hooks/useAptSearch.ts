// src/hooks/useAptSearch.ts
import { useState, useCallback, useEffect } from 'react'
import type { AptResult, RawDeal } from '../types'
import { aggregateByArea } from '../lib/aggregate'

interface SearchParams { dongCode: string; aptName: string }
interface SearchState  { results: AptResult[]; loading: boolean; error: string | null }

// 4년 청크 6개 → 브라우저가 병렬 호출, 각 Worker 요청은 ~45개월 이하
// 커버 범위: 2002-2026 = 24년 전체 역대 최고가 포함
const YEAR_CHUNKS: [number, number][] = [
  [2002, 2005],
  [2006, 2009],
  [2010, 2013],
  [2014, 2017],
  [2018, 2021],
  [2022, new Date().getFullYear()],
]

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
    error: null,
  }))

  useEffect(() => {
    try { localStorage.setItem('apt_results', JSON.stringify(state.results)) } catch {}
  }, [state.results])

  const search = useCallback(async ({ dongCode, aptName }: SearchParams) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      // 모든 청크 병렬 호출 → 각 Worker는 ~45개월 (무료 플랜 서브요청 50개 제한 안전)
      const chunkDeals = await Promise.all(
        YEAR_CHUNKS.map(([from, to]) => fetchChunk(dongCode, aptName, from, to))
      )
      const allDeals: RawDeal[] = chunkDeals.flat()
      const units = aggregateByArea(allDeals)
      const result: AptResult = { aptName, dongCode, units }
      setState(prev => ({
        results: [result, ...prev.results.filter(r => !(r.aptName === aptName && r.dongCode === dongCode))],
        loading: false,
        error: null,
      }))
    } catch (e) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : '조회 실패',
      }))
    }
  }, [])

  const removeResult = useCallback((aptName: string, dongCode: string) => {
    setState(prev => ({
      ...prev,
      results: prev.results.filter(r => !(r.aptName === aptName && r.dongCode === dongCode)),
    }))
  }, [])

  return { ...state, search, removeResult }
}
