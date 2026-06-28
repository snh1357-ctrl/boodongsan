// src/hooks/useAptSearch.ts
import { useState, useCallback, useEffect } from 'react'
import type { AptResult, RawDeal } from '../types'
import { aggregateByArea } from '../lib/aggregate'

interface SearchParams {
  dongCode: string
  aptName: string
}

interface SearchState {
  results: AptResult[]
  loading: boolean
  error: string | null
}

function loadSavedResults(): AptResult[] {
  try { return JSON.parse(localStorage.getItem('apt_results') || '[]') } catch { return [] }
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
      const res = await fetch(
        `/api/search?dongCode=${encodeURIComponent(dongCode)}&aptName=${encodeURIComponent(aptName)}`,
        { cache: 'no-store' }
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { deals: RawDeal[] }
      const units = aggregateByArea(data.deals)
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
