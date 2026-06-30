// src/components/SearchBar.tsx
import { useState, useEffect, useRef } from 'react'
import type { BjdongEntry, AptResult } from '../types'

interface AptEntry { name: string; code: string; emdNm: string }

interface Props {
  bjdong: BjdongEntry[]
  onSearch: (dongCode: string, aptName: string) => void
  loading: boolean
  pending: AptResult[]
  loadingAth: boolean
  onAdd: (aptName: string, dongCode: string) => void
  onAddAll: () => void
  onClearPending: () => void
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
  return tokens.every(tok =>
    matchToken(apt.name, tok) || matchToken(apt.emdNm, tok)
  )
}

export function SearchBar({ bjdong: _bjdong, onSearch, loading, pending, loadingAth, onAdd, onAddAll, onClearPending }: Props) {
  const [query, setQuery] = useState('')
  const [aptIndex, setAptIndex] = useState<AptEntry[]>([])
  const [aptIndexLoaded, setAptIndexLoaded] = useState(false)
  const [suggestions, setSuggestions] = useState<AptEntry[]>([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const skipSearchRef = useRef(false)

  useEffect(() => {
    fetch('/apt-index.json')
      .then(r => r.ok ? r.json() : [])
      .then((data: AptEntry[]) => { setAptIndex(data); setAptIndexLoaded(true) })
      .catch(() => setAptIndexLoaded(true))
  }, [])

  useEffect(() => {
    if (skipSearchRef.current) { skipSearchRef.current = false; return }
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
    skipSearchRef.current = true
    setQuery(apt.name)
    setSuggestions([])
    setActiveIdx(-1)
    onSearch(apt.code, apt.name)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && suggestions[activeIdx]) select(suggestions[activeIdx])
      else if (suggestions.length > 0) select(suggestions[0])
    }
  }

  const placeholder = !aptIndexLoaded
    ? '로딩중…'
    : '아파트명 검색 (초성 검색 지원: ㄹㅁㅇ, 지역명+아파트명 조합 가능)'

  // 자동완성 드랍다운 (기존)
  const AutoSuggest = ({ isMobile = false }: { isMobile?: boolean }) =>
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

  // 검색 결과 드랍다운 (검색 후 단지 선택용)
  const ResultDropdown = () => {
    if (pending.length === 0 && !loading) return null
    return (
      <div style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        zIndex: 299,
        minWidth: 320,
        background: '#fff',
        border: '1px solid #bbb',
        boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
        borderRadius: 2,
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', borderBottom: '1px solid #eee',
          background: '#f5f5f5', fontSize: 12, color: '#555',
        }}>
          <span>
            {loading ? '조회중…' : `${pending.length}개 단지 발견`}
            {loadingAth && !loading ? ' · ATH 로딩중…' : ''}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            {pending.length > 1 && (
              <button
                onMouseDown={(e) => { e.preventDefault(); onAddAll() }}
                style={{
                  fontSize: 11, padding: '2px 8px', cursor: 'pointer',
                  background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 2,
                }}
              >
                전체 추가
              </button>
            )}
            <button
              onMouseDown={(e) => { e.preventDefault(); onClearPending() }}
              style={{
                fontSize: 11, padding: '2px 6px', cursor: 'pointer',
                background: 'none', color: '#888', border: '1px solid #ccc', borderRadius: 2,
              }}
            >
              ✕
            </button>
          </div>
        </div>
        {/* 단지 목록 */}
        {pending.map(r => (
          <div
            key={`${r.aptName}__${r.dongCode}`}
            onMouseDown={(e) => { e.preventDefault(); onAdd(r.aptName, r.dongCode) }}
            style={{
              padding: '8px 12px', cursor: 'pointer',
              borderBottom: '1px solid #f0f0f0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f0f7ff')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontWeight: 500, fontSize: 13 }}>{r.aptName}</span>
            <span style={{ fontSize: 11, color: '#1a73e8', fontWeight: 600 }}>+ 추가</span>
          </div>
        ))}
      </div>
    )
  }

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
          <AutoSuggest />
          {suggestions.length === 0 && <ResultDropdown />}
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
        <AutoSuggest isMobile />
        {/* 모바일 결과 드랍다운 */}
        {pending.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #ddd', borderTop: 'none' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: '#f5f5f5', fontSize: 12 }}>
              <span>{pending.length}개 단지</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {pending.length > 1 && (
                  <button onMouseDown={(e) => { e.preventDefault(); onAddAll() }}
                    style={{ fontSize: 11, padding: '2px 8px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: 2 }}>
                    전체 추가
                  </button>
                )}
                <button onMouseDown={(e) => { e.preventDefault(); onClearPending() }}
                  style={{ fontSize: 11, padding: '2px 6px', background: 'none', color: '#888', border: '1px solid #ccc', borderRadius: 2 }}>
                  ✕
                </button>
              </div>
            </div>
            {pending.map(r => (
              <div key={`${r.aptName}__${r.dongCode}`}
                onMouseDown={(e) => { e.preventDefault(); onAdd(r.aptName, r.dongCode) }}
                style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{r.aptName}</span>
                <span style={{ fontSize: 11, color: '#1a73e8' }}>+ 추가</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
