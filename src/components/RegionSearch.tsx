// src/components/RegionSearch.tsx
import { useState, useMemo } from 'react'
import type { BjdongEntry } from '../types'

interface Props {
  bjdong: BjdongEntry[]
  onSearch: (dongCode: string, aptName: string) => void
  loading: boolean
}

export function RegionSearch({ bjdong, onSearch, loading }: Props) {
  const [sido, setSido] = useState('')
  const [sigungu, setSigungu] = useState('')
  const [emd, setEmd] = useState('')
  const [aptName, setAptName] = useState('')

  const sidos = useMemo(() => [...new Set(bjdong.map(e => e.sidoNm))].sort(), [bjdong])
  const sigungus = useMemo(
    () => [...new Set(bjdong.filter(e => e.sidoNm === sido).map(e => e.sigunguNm))].sort(),
    [bjdong, sido],
  )
  const emds = useMemo(
    () => bjdong.filter(e => e.sidoNm === sido && e.sigunguNm === sigungu),
    [bjdong, sido, sigungu],
  )

  const selectedEntry = emds.find(e => e.emdNm === emd)

  const handleSearch = () => {
    if (!selectedEntry || !aptName.trim()) return
    onSearch(selectedEntry.code, aptName.trim())
  }

  return (
    <div className="xl-sheet" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1a5c2e' }}>지역으로 아파트 검색</h2>

        <div style={{ display: 'flex', gap: 8 }}>
          <select className="rsel wide" value={sido} onChange={e => { setSido(e.target.value); setSigungu(''); setEmd('') }}>
            <option value="">시/도 선택</option>
            {sidos.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select className="rsel wide" value={sigungu} onChange={e => { setSigungu(e.target.value); setEmd('') }} disabled={!sido}>
            <option value="">시/군/구 선택</option>
            {sigungus.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select className="rsel wide" value={emd} onChange={e => setEmd(e.target.value)} disabled={!sigungu}>
            <option value="">읍/면/동 선택</option>
            {emds.map(e => <option key={e.emdNm} value={e.emdNm}>{e.emdNm}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="xl-finput"
            style={{ flex: 1, border: '1px solid #d0d0d0', borderRadius: 2, padding: '0 8px', height: 28 }}
            placeholder="아파트명 입력 (예: 래미안)"
            value={aptName}
            onChange={e => setAptName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button
            className="xl-addbtn"
            style={{ padding: '0 16px' }}
            onClick={handleSearch}
            disabled={!selectedEntry || !aptName.trim() || loading}
          >
            {loading ? '조회중…' : '조회'}
          </button>
        </div>

        {selectedEntry && (
          <div style={{ fontSize: 12, color: '#666' }}>
            선택된 지역: <strong>{selectedEntry.fullNm}</strong> (코드: {selectedEntry.code})
          </div>
        )}
      </div>
    </div>
  )
}
