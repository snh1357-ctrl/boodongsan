// src/components/SearchBar.tsx
import { useState, useEffect, useRef } from 'react'
import type { BjdongEntry } from '../types'

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
  if (target.includes(q)) return true
  const isChosung = [...q].every(c => CHOSUNG.includes(c))
  if (isChosung) return toChosung(target).includes(q)
  return false
}

function getDongSuggestions(query: string, bjdong: BjdongEntry[]) {
  const q = query.trim()
  if (!q) return []
  return bjdong.filter(e => matches(e.emdNm, q) || matches(e.sigunguNm + ' ' + e.emdNm, q)).slice(0, 8)
}

function getAptSuggestions(query: string, aptList: string[]): string[] {
  const q = query.trim()
  if (!q) return aptList.slice(0, 8)
  return aptList.filter(name => matches(name, q)).slice(0, 8)
}

export function SearchBar({ bjdong, onSearch, loading }: Props) {
  // Phase 1: dong selection
  const [dongQuery, setDongQuery] = useState('')
  const [selectedDong, setSelectedDong] = useState<BjdongEntry | null>(null)
  const [dongSuggestions, setDongSuggestions] = useState<BjdongEntry[]>([])

  // Phase 2: apt name selection
  const [aptQuery, setAptQuery] = useState('')
  const [aptList, setAptList] = useState<string[]>([])
  const [aptLoading, setAptLoading] = useState(false)
  const [aptSuggestions, setAptSuggestions] = useState<string[]>([])

  const [activeIdx, setActiveIdx] = useState(-1)
  const aptInputRef = useRef<HTMLInputElement>(null)
  const dongInputRef = useRef<HTMLInputElement>(null)

  // Update dong suggestions as user types
  useEffect(() => {
    if (selectedDong) { setDongSuggestions([]); return }
    setDongSuggestions(getDongSuggestions(dongQuery, bjdong))
    setActiveIdx(-1)
  }, [dongQuery, bjdong, selectedDong])

  // Fetch apt list when dong is selected
  useEffect(() => {
    if (!selectedDong) { setAptList([]); return }
    setAptLoading(true)
    fetch(`/api/apt-list?dongCode=${selectedDong.code}`)
      .then(r => r.json())
      .then((names: string[]) => { setAptList(names); setAptLoading(false) })
      .catch(() => setAptLoading(false))
  }, [selectedDong])

  // Update apt suggestions as user types
  useEffect(() => {
    if (!selectedDong) return
    setAptSuggestions(getAptSuggestions(aptQuery, aptList))
    setActiveIdx(-1)
  }, [aptQuery, aptList, selectedDong])

  const selectDong = (entry: BjdongEntry) => {
    setSelectedDong(entry)
    setDongQuery('')
    setDongSuggestions([])
    setAptQuery('')
    setActiveIdx(-1)
    setTimeout(() => aptInputRef.current?.focus(), 50)
  }

  const clearDong = () => {
    setSelectedDong(null)
    setDongQuery('')
    setAptQuery('')
    setAptList([])
    setAptSuggestions([])
    setTimeout(() => dongInputRef.current?.focus(), 50)
  }

  const selectApt = (name: string) => {
    setAptQuery(name)
    setAptSuggestions([])
    setActiveIdx(-1)
    if (selectedDong) onSearch(selectedDong.code, name)
  }

  const handleSubmit = () => {
    if (!selectedDong || !aptQuery.trim()) return
    onSearch(selectedDong.code, aptQuery.trim())
  }

  // Keyboard nav — shared for both dropdowns
  const activeSuggestions: string[] = selectedDong
    ? aptSuggestions.map(s => s)
    : dongSuggestions.map(e => e.fullNm)

  const handleDongKeyDown = (e: React.KeyboardEvent) => {
    if (dongSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, dongSuggestions.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
      else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); selectDong(dongSuggestions[activeIdx]) }
    }
  }

  const handleAptKeyDown = (e: React.KeyboardEvent) => {
    if (aptSuggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, aptSuggestions.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)) }
      else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); selectApt(aptSuggestions[activeIdx]) }
      else if (e.key === 'Enter') handleSubmit()
    } else if (e.key === 'Enter') handleSubmit()
  }

  const chipStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    background: '#e8f5e9', border: '1px solid #4caf50', borderRadius: 3,
    padding: '2px 7px', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 6,
  }

  return (
    <>
      {/* 데스크톱: Formula Bar */}
      <div className="xl-fbar">
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, position: 'relative', overflow: 'visible' }}>

          {/* Phase 1: 동 검색 */}
          {!selectedDong ? (
            <>
              <input
                ref={dongInputRef}
                className="xl-finput"
                placeholder="동 검색 (예: 평촌동, ㅍㅊ)"
                value={dongQuery}
                onChange={e => setDongQuery(e.target.value)}
                onKeyDown={handleDongKeyDown}
                style={{ flex: 1 }}
              />
              {dongSuggestions.length > 0 && (
                <div className="autocomplete-list" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, width: 300 }}>
                  {dongSuggestions.map((e, i) => (
                    <div key={e.fullNm} className={`autocomplete-item${i === activeIdx ? ' active' : ''}`} onClick={() => selectDong(e)}>
                      <span className="ac-symbol">{e.emdNm}</span>
                      <span className="ac-name">{e.sidoNm} {e.sigunguNm}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Phase 2: 동 선택됨 → 아파트명 입력 */}
              <span style={chipStyle}>
                {selectedDong.emdNm}
                <button onClick={clearDong} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#555', fontSize: 14, lineHeight: 1 }}>×</button>
              </span>
              <input
                ref={aptInputRef}
                className="xl-finput"
                placeholder={aptLoading ? '아파트 목록 불러오는 중…' : '아파트명 또는 초성 (예: ㅇㄹㅍ)'}
                value={aptQuery}
                onChange={e => setAptQuery(e.target.value)}
                onKeyDown={handleAptKeyDown}
                style={{ flex: 1 }}
                disabled={aptLoading}
              />
              {aptSuggestions.length > 0 && (
                <div className="autocomplete-list" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, width: 320 }}>
                  {aptSuggestions.map((name, i) => (
                    <div key={name} className={`autocomplete-item${i === activeIdx ? ' active' : ''}`} onClick={() => selectApt(name)}>
                      <span className="ac-symbol">{name}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <button
          className="xl-addbtn"
          onClick={handleSubmit}
          disabled={!selectedDong || !aptQuery.trim() || loading || aptLoading}
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
          {!selectedDong ? (
            <input
              placeholder="동 검색 (예: ㅍㅊ, 평촌동)"
              value={dongQuery}
              onChange={e => setDongQuery(e.target.value)}
              onKeyDown={handleDongKeyDown}
            />
          ) : (
            <>
              <span style={{ ...chipStyle, fontSize: 11, marginLeft: 0 }}>
                {selectedDong.emdNm}
                <button onClick={clearDong} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#555' }}>×</button>
              </span>
              <input
                placeholder={aptLoading ? '불러오는 중…' : '아파트명 (ㄱㄴㄷ 초성 가능)'}
                value={aptQuery}
                onChange={e => setAptQuery(e.target.value)}
                onKeyDown={handleAptKeyDown}
                disabled={aptLoading}
              />
            </>
          )}
          <button className="mob-addbtn" onClick={handleSubmit} disabled={!selectedDong || !aptQuery.trim() || loading}>
            {loading ? '…' : '조회'}
          </button>
        </div>

        {/* 모바일 드롭다운 */}
        {!selectedDong && dongSuggestions.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #ccc', borderTop: 'none' }}>
            {dongSuggestions.map((e, i) => (
              <div key={e.fullNm} style={{ padding: '7px 10px', cursor: 'pointer', background: i === activeIdx ? '#f0f7f0' : 'transparent', fontSize: 13 }} onClick={() => selectDong(e)}>
                <strong>{e.emdNm}</strong> <span style={{ color: '#888', fontSize: 11 }}>{e.sidoNm} {e.sigunguNm}</span>
              </div>
            ))}
          </div>
        )}
        {selectedDong && aptSuggestions.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #ccc', borderTop: 'none' }}>
            {aptSuggestions.map((name, i) => (
              <div key={name} style={{ padding: '7px 10px', cursor: 'pointer', background: i === activeIdx ? '#f0f7f0' : 'transparent', fontSize: 13 }} onClick={() => selectApt(name)}>
                {name}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
