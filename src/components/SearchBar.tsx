// src/components/SearchBar.tsx
// 호간고노 스타일: 단일 검색창 → 아파트명/동명 통합 자동완성
import { useState, useEffect, useRef } from 'react'
import type { BjdongEntry } from '../types'

interface AptEntry { name: string; code: string; emdNm: string }

interface SuggestionItem {
  type: 'apt' | 'dong'
  label: string       // 표시 텍스트 (아파트명 or 동명)
  sub: string         // 부제 (지역명)
  code: string        // 5자리 시군구코드
  aptName?: string    // apt 타입일 때 아파트명
}

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

function matches(target: string, q: string): boolean {
  if (!q) return false
  if (target.includes(q)) return true
  const isChosung = [...q].every(c => CHOSUNG.includes(c))
  if (isChosung) return toChosung(target).includes(q)
  return false
}

export function SearchBar({ bjdong, onSearch, loading }: Props) {
  const [query, setQuery] = useState('')
  const [aptIndex, setAptIndex] = useState<AptEntry[]>([])
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)

  // apt-index.json 지연 로드
  useEffect(() => {
    fetch('/apt-index.json')
      .then(r => r.ok ? r.json() : [])
      .then((data: AptEntry[]) => setAptIndex(data))
      .catch(() => {})
  }, [])

  // 자동완성 계산
  useEffect(() => {
    const q = query.trim()
    if (q.length < 1) { setSuggestions([]); setActiveIdx(-1); return }

    const items: SuggestionItem[] = []

    // 1. 아파트명 매칭 (최대 6개)
    for (const apt of aptIndex) {
      if (matches(apt.name, q)) {
        items.push({ type: 'apt', label: apt.name, sub: apt.emdNm, code: apt.code, aptName: apt.name })
        if (items.length >= 6) break
      }
    }

    // 2. 동 이름 매칭 (최대 3개, 아파트 결과가 적을 때만)
    if (items.length < 6) {
      for (const e of bjdong) {
        if (matches(e.emdNm, q) || matches(e.sigunguNm, q)) {
          items.push({ type: 'dong', label: e.emdNm, sub: `${e.sidoNm} ${e.sigunguNm}`, code: e.code })
          if (items.filter(i => i.type === 'dong').length >= 3) break
        }
      }
    }

    setSuggestions(items)
    setActiveIdx(-1)
  }, [query, aptIndex, bjdong])

  const handleSelect = (item: SuggestionItem) => {
    if (item.type === 'apt') {
      // 아파트 선택 → 바로 검색
      setQuery(item.label)
      setSuggestions([])
      onSearch(item.code, item.aptName!)
    } else {
      // 동 선택 → 아파트명 추가 입력 필요
      setQuery(item.label + ' ')
      setSuggestions([])
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
      else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); handleSelect(suggestions[activeIdx]) }
    }
  }

  const placeholder = aptIndex.length > 0
    ? `아파트명 검색 (예: 엘프라우드, ㄹㅁㅇ)`
    : `아파트명 검색 (예: 래미안, 평촌동)`

  const SuggestionList = ({ mobile = false }: { mobile?: boolean }) => (
    <div
      className={mobile ? undefined : 'autocomplete-list'}
      style={mobile
        ? { background: '#fff', border: '1px solid #ccc', borderTop: 'none', maxHeight: 240, overflowY: 'auto' }
        : { position: 'absolute', top: '100%', left: 0, zIndex: 200, width: 360, maxHeight: 280, overflowY: 'auto' }
      }
    >
      {suggestions.map((s, i) => (
        <div
          key={`${s.type}-${s.label}-${s.code}`}
          className={mobile ? undefined : `autocomplete-item${i === activeIdx ? ' active' : ''}`}
          style={mobile ? {
            padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f0f0f0',
            background: i === activeIdx ? '#f0f7f0' : 'transparent',
          } : undefined}
          onClick={() => handleSelect(s)}
        >
          {s.type === 'apt' ? (
            <>
              <span className={mobile ? undefined : 'ac-symbol'} style={mobile ? { fontWeight: 600, fontSize: 13 } : undefined}>{s.label}</span>
              <span className={mobile ? undefined : 'ac-name'} style={mobile ? { fontSize: 11, color: '#888', marginLeft: 6 } : undefined}>{s.sub}</span>
            </>
          ) : (
            <>
              <span className={mobile ? undefined : 'ac-symbol'} style={mobile ? { fontSize: 13 } : undefined}>📍 {s.label}</span>
              <span className={mobile ? undefined : 'ac-name'} style={mobile ? { fontSize: 11, color: '#888', marginLeft: 6 } : undefined}>{s.sub}</span>
            </>
          )}
        </div>
      ))}
    </div>
  )

  return (
    <>
      {/* 데스크톱: Formula Bar */}
      <div className="xl-fbar">
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, position: 'relative' }}>
          <input
            ref={inputRef}
            className="xl-finput"
            placeholder={placeholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setSuggestions([]), 150)}
            style={{ flex: 1 }}
            autoComplete="off"
          />
          {suggestions.length > 0 && <SuggestionList />}
        </div>
        <button
          className="xl-addbtn"
          onClick={() => {
            const q = query.trim()
            if (!q || loading) return
            // 동명 + 아파트명 형식 처리
            const dong = bjdong.find(e => q.startsWith(e.emdNm))
            if (dong) onSearch(dong.code, q.slice(dong.emdNm.length).trim() || q)
          }}
          disabled={!query.trim() || loading}
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
            ref={mobileInputRef}
            placeholder={placeholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
          />
          <button
            className="mob-addbtn"
            onClick={() => {
              const q = query.trim()
              if (!q || loading) return
              const dong = bjdong.find(e => q.startsWith(e.emdNm))
              if (dong) onSearch(dong.code, q.slice(dong.emdNm.length).trim() || q)
            }}
            disabled={!query.trim() || loading}
          >
            {loading ? '…' : '조회'}
          </button>
        </div>
        {suggestions.length > 0 && <SuggestionList mobile />}
      </div>
    </>
  )
}
