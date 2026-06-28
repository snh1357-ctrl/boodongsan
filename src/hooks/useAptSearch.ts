// src/hooks/useAptSearch.ts
import { useState, useCallback } from 'react'
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

export function useAptSearch() {
  const [state, setState] = useState<SearchState>({
    results: [],
    loading: false,
    error: null,
  })

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
