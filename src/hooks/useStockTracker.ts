import { useState, useCallback, useEffect } from 'react'
import type { StockData } from '../types'

interface State { stocks: StockData[]; loading: Set<string>; errors: Map<string, string> }

function loadSaved(): StockData[] {
  try { return JSON.parse(localStorage.getItem('stock_results') || '[]') } catch { return [] }
}

export function useStockTracker() {
  const [state, setState] = useState<State>(() => ({
    stocks: loadSaved(),
    loading: new Set(),
    errors: new Map(),
  }))

  useEffect(() => {
    try { localStorage.setItem('stock_results', JSON.stringify(state.stocks)) } catch {}
  }, [state.stocks])

  const fetchStock = useCallback(async (symbol: string) => {
    const sym = symbol.toUpperCase().trim()
    setState(prev => {
      const loading = new Set(prev.loading)
      loading.add(sym)
      const errors = new Map(prev.errors)
      errors.delete(sym)
      return { ...prev, loading, errors }
    })

    try {
      const res = await fetch(`/api/stock?symbol=${encodeURIComponent(sym)}`)
      const data = await res.json() as StockData & { error?: string }
      if (!res.ok || data.error) throw new Error(data.error ?? 'API error')

      setState(prev => {
        const loading = new Set(prev.loading)
        loading.delete(sym)
        const stocks = [data, ...prev.stocks.filter(s => s.symbol !== sym)]
        return { ...prev, stocks, loading }
      })
    } catch (e) {
      setState(prev => {
        const loading = new Set(prev.loading)
        loading.delete(sym)
        const errors = new Map(prev.errors)
        errors.set(sym, e instanceof Error ? e.message : '조회 실패')
        return { ...prev, loading, errors }
      })
    }
  }, [])

  const removeStock = useCallback((symbol: string) => {
    setState(prev => ({ ...prev, stocks: prev.stocks.filter(s => s.symbol !== symbol) }))
  }, [])

  const refreshAll = useCallback(async () => {
    const symbols = state.stocks.map(s => s.symbol)
    await Promise.all(symbols.map(fetchStock))
  }, [state.stocks, fetchStock])

  return {
    stocks: state.stocks,
    loading: state.loading,
    errors: state.errors,
    isAnyLoading: state.loading.size > 0,
    fetchStock,
    removeStock,
    refreshAll,
  }
}
