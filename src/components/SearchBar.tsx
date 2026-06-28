// src/components/SearchBar.tsx
import { useState, useEffect, useRef } from 'react'
import type { BjdongEntry } from '../types'

interface AptEntry { name: string; code: string; emdNm: string }

interface Props {
  bjdong: BjdongEntry[]
  onSearch: (dongCode: string, aptName: string) => void
  loading: boolean
}

const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']

function toChosung(str: string): string {
  return [...str].map(c => {
    const code = c.charCodeAt(0) - 0xAC00
    if (code < 0 || code > 11171) return c
    return CHOSUNG[Math.floor(code / (21 * 28))]
  }).join('')
}

function matchToken(target: string, tok: string): boolean {
  if (target.includes(tok)) return true
  if ([...tok].every(c => CHOSUNG.includes(c))) return toChosung(target).includes(tok)
  return false
}

function scoreApt(apt: AptEntry, tokens: string[]): boolean {
  // 모든 토큰이 아파트명 또는 지역명에 매칭되어야 함
  return tokens.every(tok =>
    matchToken(apt.name, tok) || matchToken(apt.emdNm, tok)
  )
}

export function SearchBar({ bjdong: _bjdong, onSearch, loading }: Props) {
  const [query, setQuery] = useState('')
  const [aptIndex, setAptIndex] = useState<AptEntry[]>([])
  const [aptIndexLoaded, setAptIndexLoaded] = useState(false)
  const [suggestions, setSuggestions] = useState<AptEntry[]>([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/apt-index.json')
      .then(r => r.ok ? r.json() : [])
      .then((data: AptEntry[]) => { setAptIndex(data); setAptIndexLoaded(true) })
      .catch(() => setAptIndexLoaded(true))
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q) { setSuggestions([]); setActiveIdx(-1); return }
    const tokens = q.split(/\s+/).filter(Boolean)
    const results: AptEntry[] = []
    for (const apt of aptIndex) {
      if (scoreApt(apt, tokens)) {
        results.push(apt)
        if (results.length >= 10) break
      }
    }
    setSuggestions(results)
    setActiveIdx(-1)
  }, [query, aptIndex])

  const select = (apt: AptEntry) => {
    setQuery(apt.name)
    setSuggestions([])
    onSearch(apt.code, apt.name)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && suggestions[activeIdx]) select(suggestions[activeIdx])
      else if (suggestions.length > 0) select(suggestions[0])  // 엔터 → 첫 번째 후보 즉시 선택
    }
  }

  const placeholder = !aptIndexLoaded
    ? '로딩중…'
    : aptIndex.length > 0
      ? '아파트명 검색 (예: 엘프라우드, ㄹㅁㅇ, 래미안 평촌)'
      : '아파트명 입력 (예: 래미안대치팰리스)'

  const DropdownList = ({ isMobile = false }: { isMobile?: boolean }) =>
    suggestions.length === 0 ? null : (
      <div style={{
        position: isMobile ? 'static' : 'absolute',
        top: isMobile ? undefined : '100%',
        left: 0, zIndex: 300,
        width: isMobile ? '100%' : 380,
        background: '#fff',
        border: '1px solid #ccc',
        borderTop: isMobile ? 'none' : '1px solid #ccc',
        boxShadow: isMobile ? 'none' : '0 2px 8px rgba(0,0,0,0.15)',
        maxHeight: 280, overflowY: 'auto',
      }}>
        {suggestions.map((apt, i) => (
          <div
            key={`${apt.name}|${apt.code}`}
            // onMouseDown 사용: blur보다 먼저 발생해서 드롭다운이 닫히기 전에 선택됨
            onMouseDown={(e) => { e.preventDefault(); select(apt) }}
            style={{
              padding: '8px 12px', cursor: 'pointer',
              borderBottom: '1px solid #f0f0f0',
              background: i === activeIdx ? '#e8f5e9' : 'transparent',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 500, fontSize: 13 }}>{apt.name}</span>
            <span style={{ fontSize: 11, color: '#888' }}>{apt.emdNm}</span>
          </div>
        ))}
      </div>
    )

  return (
    <>
      {/* 데스크톱: Formula Bar */}
      <div className="xl-fbar">
        <div className="xl-namebox">A1</div>
        <div className="xl-fxlbl" style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '0 6px', borderRight: '1px solid #ddd', flexShrink: 0 }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#666', padding: '0 2px', fontFamily: 'inherit' }} title="취소">✕</button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#666', padding: '0 2px', fontFamily: 'inherit' }} title="입력">✓</button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#0078d4', padding: '0 2px', fontStyle: 'italic', fontFamily: 'inherit' }} title="함수 삽입">fx</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, position: 'relative' }}>
          <input
            ref={inputRef}
            className="xl-finput"
            placeholder={placeholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1 }}
            autoComplete="off"
          />
          <DropdownList />
        </div>
        <button
          className="xl-addbtn"
          onClick={() => {
            if (suggestions.length === 1) select(suggestions[0])
            else if (suggestions.length > 1) select(suggestions[activeIdx >= 0 ? activeIdx : 0])
          }}
          disabled={!query.trim() || loading || suggestions.length === 0}
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
            placeholder={placeholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          <button
            className="mob-addbtn"
            onClick={() => { if (suggestions.length > 0) select(suggestions[activeIdx >= 0 ? activeIdx : 0]) }}
            disabled={!query.trim() || loading || suggestions.length === 0}
          >
            {loading ? '…' : '조회'}
          </button>
        </div>
        <DropdownList isMobile />
      </div>
    </>
  )
}
