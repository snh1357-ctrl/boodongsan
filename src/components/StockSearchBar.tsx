import { useState, useEffect, useRef } from 'react'
import type { StockSearchResult } from '../types'

interface Props {
  onAdd: (symbol: string) => void
  loading: boolean
}

export function StockSearchBar({ onAdd, loading }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<StockSearchResult[]>([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipRef = useRef(false)

  useEffect(() => {
    if (skipRef.current) { skipRef.current = false; return }
    const q = query.trim()
    if (!q) { setSuggestions([]); return }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stock-search?q=${encodeURIComponent(q)}`)
        const data = await res.json() as StockSearchResult[]
        setSuggestions(data)
        setActiveIdx(-1)
      } catch {
        setSuggestions([])
      }
    }, 250)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const select = (s: StockSearchResult) => {
    skipRef.current = true
    setQuery(s.symbol)
    setSuggestions([])
    setActiveIdx(-1)
    onAdd(s.symbol)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const sym = activeIdx >= 0 ? suggestions[activeIdx]?.symbol : suggestions[0]?.symbol ?? query.trim().toUpperCase()
      if (sym) { skipRef.current = true; setQuery(sym); setSuggestions([]); onAdd(sym) }
    }
  }

  const Dropdown = () => suggestions.length === 0 ? null : (
    <div style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 300,
      width: 380, background: '#fff', border: '1px solid #ccc',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)', maxHeight: 280, overflowY: 'auto',
    }}>
      {suggestions.map((s, i) => (
        <div
          key={s.symbol}
          onMouseDown={e => { e.preventDefault(); select(s) }}
          style={{
            padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0',
            background: i === activeIdx ? '#e8f5e9' : 'transparent',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{s.symbol}</span>
            <span style={{ fontSize: 11, color: '#666' }}>{s.name}</span>
          </div>
          <span style={{ fontSize: 10, color: '#999', marginLeft: 8 }}>{s.exchange}</span>
        </div>
      ))}
    </div>
  )

  return (
    <div className="xl-fbar">
      <div className="xl-namebox">A1</div>
      <div className="xl-fxlbl" style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '0 6px', borderRight: '1px solid #ddd', flexShrink: 0 }}>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#666', padding: '0 2px' }} title="취소">✕</button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#666', padding: '0 2px' }} title="입력">✓</button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#0078d4', padding: '0 2px', fontStyle: 'italic' }} title="함수 삽입">fx</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, position: 'relative' }}>
        <input
          className="xl-finput"
          placeholder="티커 또는 종목명 검색 — AAPL · 테슬라 · 삼성전자 · QQQ · KODEX200..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1 }}
          autoComplete="off"
        />
        <Dropdown />
      </div>
      <button
        className="xl-addbtn"
        onClick={() => {
          const sym = suggestions[activeIdx >= 0 ? activeIdx : 0]?.symbol ?? query.trim().toUpperCase()
          if (sym) { skipRef.current = true; setQuery(sym); setSuggestions([]); onAdd(sym) }
        }}
        disabled={!query.trim() || loading}
      >
        {loading ? '조회중…' : '+ 추가'}
      </button>
    </div>
  )
}
