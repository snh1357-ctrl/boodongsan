// src/components/SearchBar.tsx
import { useState, useEffect } from 'react'
import type { BjdongEntry } from '../types'

interface Props {
  bjdong: BjdongEntry[]
  onSearch: (dongCode: string, aptName: string) => void
  loading: boolean
}

export function SearchBar({ bjdong, onSearch, loading }: Props) {
  const [query, setQuery] = useState('')
  const [aptName, setAptName] = useState('')
  const [suggestions, setSuggestions] = useState<BjdongEntry[]>([])
  const [selected, setSelected] = useState<BjdongEntry | null>(null)
  const [activeIdx, setActiveIdx] = useState(-1)

  useEffect(() => {
    if (query.length < 1) { setSuggestions([]); setActiveIdx(-1); return }
    const q = query.trim().toLowerCase()
    setSuggestions(bjdong.filter(e => e.fullNm.includes(q) || e.emdNm.includes(q)).slice(0, 8))
    setActiveIdx(-1)
  }, [query, bjdong])

  const handleSelect = (entry: BjdongEntry) => {
    setSelected(entry)
    setQuery(entry.fullNm)
    setSuggestions([])
    setActiveIdx(-1)
  }

  const handleSubmit = () => {
    if (!selected || !aptName.trim()) return
    onSearch(selected.code, aptName.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    else if (e.key === 'ArrowUp') setActiveIdx(i => Math.max(i - 1, -1))
    else if (e.key === 'Enter' && activeIdx >= 0) handleSelect(suggestions[activeIdx])
    else if (e.key === 'Enter') handleSubmit()
  }

  return (
    <>
      {/* 데스크톱: Formula Bar */}
      <div className="xl-fbar">
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, position: 'relative' }}>
          <input
            className="xl-finput"
            style={{ width: 240, borderRight: '1px solid #d7d7d7' }}
            placeholder="동 검색 (예: 대치동)"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null) }}
            onKeyDown={handleKeyDown}
          />
          <input
            className="xl-finput"
            placeholder="아파트명 입력 (예: 래미안대치팰리스1차)"
            value={aptName}
            onChange={e => setAptName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          {suggestions.length > 0 && (
            <div className="autocomplete-list" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, width: 280 }}>
              {suggestions.map((s, i) => (
                <div
                  key={s.fullNm}
                  className={`autocomplete-item${i === activeIdx ? ' active' : ''}`}
                  onClick={() => handleSelect(s)}
                >
                  <span className="ac-symbol">{s.emdNm}</span>
                  <span className="ac-name">{s.sidoNm} {s.sigunguNm}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          className="xl-addbtn"
          onClick={handleSubmit}
          disabled={!selected || !aptName.trim() || loading}
        >
          {loading ? '조회중…' : '조회'}
        </button>
      </div>

      {/* 모바일 헤더 */}
      <div id="mobileHeader">
        <div className="mob-row1">
          <span className="mob-title">🏢 아파트 실거래가</span>
        </div>
        <div className="mob-row2">
          <input
            placeholder="동 검색"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null) }}
          />
          <input
            placeholder="아파트명"
            value={aptName}
            onChange={e => setAptName(e.target.value)}
          />
          <button className="mob-addbtn" onClick={handleSubmit} disabled={!selected || !aptName.trim() || loading}>
            {loading ? '…' : '조회'}
          </button>
        </div>
      </div>
    </>
  )
}
