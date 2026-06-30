// src/hooks/useAptSearch.ts
import { useState, useCallback, useEffect } from 'react'
import type { AptResult, RawDeal } from '../types'
import { aggregateByArea } from '../lib/aggregate'

interface SearchParams { dongCode: string; aptName: string }
interface SearchState  { results: AptResult[]; loading: boolean; loadingAth: boolean; error: string | null }

const currentYear = new Date().getFullYear()
const ATH_START_YEAR = 2012

// ATH 조회용 청크 (2012 ~ 작년)
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
      // Phase 1: 최근 12개월 (KV 캐시 히트 시 ~100ms, 미스 시 12 MOLIT 호출)
      const recentDeals = await fetchChunk(dongCode, aptName, currentYear - 1, currentYear)

      if (recentDeals.length > 0) {
        // 즉시 표시
        const units = aggregateByArea(recentDeals)
        setState(prev => ({
          results: [
            { aptName, dongCode, units, athLoaded: false },
            ...prev.results.filter(r => !(r.aptName === aptName && r.dongCode === dongCode)),
          ],
          loading: false,
          loadingAth: true,
          error: null,
        }))
        loadAth(dongCode, aptName, recentDeals)
        return
      }

      // Phase 1 fallback: 최근 5년으로 확장 (거래 뜸한 단지 대응)
      // 최근 1년과 그 이전 4년을 병렬로 가져옴
      const [extRecent, extOld] = await Promise.all([
        fetchChunk(dongCode, aptName, currentYear - 5, currentYear - 2),
        fetchChunk(dongCode, aptName, currentYear - 1, currentYear),
      ])
      const extDeals = [...extRecent, ...extOld]
      const units = aggregateByArea(extDeals)
      setState(prev => ({
        results: [
          { aptName, dongCode, units, athLoaded: false },
          ...prev.results.filter(r => !(r.aptName === aptName && r.dongCode === dongCode)),
        ],
        loading: false,
        loadingAth: true,
        error: null,
      }))
      loadAth(dongCode, aptName, extDeals)
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
          r.aptName === aptName && r.dongCode === dongCode ? { ...r, athLoaded: true } : r
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
      .catch(() => setState(prev => ({ ...prev, loadingAth: false })))
  }

  const removeResult = useCallback((aptName: string, dongCode: string) => {
    setState(prev => ({
      ...prev,
      results: prev.results.filter(r => !(r.aptName === aptName && r.dongCode === dongCode)),
    }))
  }, [])

  return { ...state, search, removeResult }
}
