// src/components/SearchBar.tsx
// Smart single-input search: "평촌 엘프라우드" → splits tokens, matches 동, rest = aptName
import { useState, useEffect, useRef } from 'react'
import type { BjdongEntry } from '../types'

interface Props {
  bjdong: BjdongEntry[]
  onSearch: (dongCode: string, aptName: string) => void
  loading: boolean
}

interface Suggestion {
  entry: BjdongEntry
  aptName: string // remaining tokens after removing matched location word
}

function buildSuggestions(query: string, bjdong: BjdongEntry[]): Suggestion[] {
  const q = query.trim()
  if (!q) return []

  const tokens = q.split(/\s+/)
  const seen = new Set<string>()
  const results: Suggestion[] = []

  // Try each token as a potential location match
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    if (tok.length < 1) continue
    const matches = bjdong.filter(e =>
      e.emdNm.includes(tok) || e.fullNm.includes(tok)
    )
    for (const entry of matches) {
      if (seen.has(entry.fullNm)) continue
      seen.add(entry.fullNm)
      const aptName = tokens.filter((_, j) => j !== i).join(' ')
      results.push({ entry, aptName })
      if (results.length >= 8) return results
    }
  }

  // fallback: match full query against fullNm
  if (results.length === 0) {
    const matches = bjdong.filter(e => e.fullNm.includes(q) || e.emdNm.includes(q))
    for (const entry of matches.slice(0, 8)) {
      results.push({ entry, aptName: '' })
    }
  }

  return results
}

export function SearchBar({ bjdong, onSearch, loading }: Props) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState<{ entry: BjdongEntry; aptName: string } | null>(null)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (selected) { setSuggestions([]); return }
    setSuggestions(buildSuggestions(query, bjdong))
    setActiveIdx(-1)
  }, [query, bjdong, selected])

  const handleSelect = (s: Suggestion) => {
    setSelected(s)
    setQuery(s.aptName || '')
    setSuggestions([])
    setActiveIdx(-1)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleSubmit = () => {
    if (!selected) return
    const aptName = query.trim()
    if (!aptName) return
    onSearch(selected.entry.code, aptName)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
      else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); handleSelect(suggestions[activeIdx]) }
      else if (e.key === 'Enter') handleSubmit()
    } else {
      if (e.key === 'Enter') handleSubmit()
    }
  }

  const clearSelected = () => {
    setSelected(null)
    setQuery('')
    setSuggestions([])
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const placeholder = selected
    ? `아파트명 입력 (예: 엘프라우드)`
    : `동+아파트명 입력 (예: 평촌 엘프라우드)`

  return (
    <>
      {/* 데스크톱: Formula Bar */}
      <div className="xl-fbar">
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, position: 'relative' }}>
          {selected && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: 3,
              padding: '2px 6px', marginLeft: 6, marginRight: 4,
              fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0
            }}>
              {selected.entry.emdNm}
              <button
                onClick={clearSelected}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 2, lineHeight: 1, color: '#555', fontSize: 13 }}
                title="지역 변경"
              >×</button>
            </span>
          )}
          <input
            ref={inputRef}
            className="xl-finput"
            placeholder={placeholder}
            value={query}
            onChange={e => { setQuery(e.target.value); if (selected) setSelected(null) }}
            onKeyDown={handleKeyDown}
            style={{ flex: 1 }}
          />
          {suggestions.length > 0 && (
            <div className="autocomplete-list" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, width: 320 }}>
              {suggestions.map((s, i) => (
                <div
                  key={s.entry.fullNm}
                  className={`autocomplete-item${i === activeIdx ? ' active' : ''}`}
                  onClick={() => handleSelect(s)}
                >
                  <span className="ac-symbol">{s.entry.emdNm}</span>
                  <span className="ac-name">{s.entry.sidoNm} {s.entry.sigunguNm}</span>
                  {s.aptName && <span style={{ marginLeft: 6, color: '#888', fontSize: 11 }}>→ "{s.aptName}"</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          className="xl-addbtn"
          onClick={handleSubmit}
          disabled={!selected || !query.trim() || loading}
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
          {selected && (
            <span style={{ background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: 3, padding: '2px 5px', fontSize: 11, whiteSpace: 'nowrap' }}>
              {selected.entry.emdNm}
              <button onClick={clearSelected} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 3px', color: '#555' }}>×</button>
            </span>
          )}
          <input
            placeholder={selected ? '아파트명' : '동+아파트명 (예: 평촌 엘프라우드)'}
            value={query}
            onChange={e => { setQuery(e.target.value); if (selected) setSelected(null) }}
            onKeyDown={handleKeyDown}
          />
          <button className="mob-addbtn" onClick={handleSubmit} disabled={!selected || !query.trim() || loading}>
            {loading ? '…' : '조회'}
          </button>
        </div>
        {suggestions.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #ccc', borderTop: 'none' }}>
            {suggestions.map((s, i) => (
              <div
                key={s.entry.fullNm}
                style={{ padding: '6px 10px', cursor: 'pointer', background: i === activeIdx ? '#f0f7f0' : 'transparent', fontSize: 13 }}
                onClick={() => handleSelect(s)}
              >
                <strong>{s.entry.emdNm}</strong> <span style={{ color: '#888', fontSize: 11 }}>{s.entry.sidoNm} {s.entry.sigunguNm}</span>
                {s.aptName && <span style={{ color: '#4caf50', fontSize: 11 }}> → "{s.aptName}"</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
