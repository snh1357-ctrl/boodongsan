// src/components/AptTable.tsx
import React, { useState, useEffect, useRef } from 'react'
import type { AptResult, AptUnit } from '../types'
import bjdongData from '../data/bjdong.json'

// 시군구코드(5자리) → "시도 시군구" 지역명 (지도 검색어 구성용)
const regionByCode = new Map<string, string>()
for (const b of bjdongData as { code: string; sidoNm: string; sigunguNm: string }[]) {
  if (!regionByCode.has(b.code)) regionByCode.set(b.code, `${b.sidoNm} ${b.sigunguNm}`)
}

// 아파트명 클릭 시 네이버페이 부동산 지도를 새 탭으로 연다.
// (API 키·좌표 불필요. m.land 검색 URL은 비공식이라 데스크톱/모바일 모두 동작 확인됨)
function openMap(aptName: string, dongCode: string) {
  const region = regionByCode.get(dongCode) ?? ''
  const q = `${region} ${aptName}`.trim()
  window.open(`https://m.land.naver.com/search/result/${encodeURIComponent(q)}`, '_blank', 'noopener')
}

interface Props {
  results: AptResult[]
  onRemove: (aptName: string, dongCode: string) => void
  onRemoveGroup: (searchTerm: string, dongCode: string) => void
}

function formatPrice(manwon: number): string {
  if (manwon >= 10000) {
    const eok = Math.floor(manwon / 10000)
    const rem = manwon % 10000
    return rem > 0 ? `${eok}억 ${rem.toLocaleString()}` : `${eok}억`
  }
  return `${manwon.toLocaleString()}만`
}

function ChangeCell({ rate }: { rate: number }) {
  const sign = rate >= 0 ? '+' : ''
  const cls = rate >= 0 ? 'pct-p' : 'pct-n'
  const barWidth = Math.min(Math.abs(rate), 100)
  return (
    <td className={`cell r bc ${cls}`}>
      <div className="pct-wrap">
        <div className="pct-top">{sign}{rate.toFixed(1)}%</div>
        <div className="pct-bot">
          <div className="pct-bar" style={{ width: `${barWidth}%` }} />
        </div>
      </div>
    </td>
  )
}

function toPyeong(area: number): number {
  return Math.round(area / 3.305785)
}

// 전용면적 → 공급면적 (단지 전용률 우선, 없으면 일반적인 전용률 ~0.78로 추정)
const DEFAULT_EXCLUSIVE_RATIO = 0.78
function isValidRatio(ratio?: number): ratio is number {
  return !!ratio && ratio >= 0.55 && ratio <= 0.98
}
function toSupply(exclusive: number, ratio?: number): number {
  return Math.round(exclusive / (isValidRatio(ratio) ? ratio : DEFAULT_EXCLUSIVE_RATIO))
}

function NewHighBadge() {
  return <span className="nh-badge">신고가</span>
}

// 대표 평형: 국민평형(전용 84㎡ ≈ 공급 34평)에 가장 가까운 평형.
// 34평이 없으면 가장 가까운 면적, 동률이면 최근 3개월 거래가 많은 쪽.
const NATIONAL_AREA = 84  // 전용 84㎡ = 흔히 말하는 '국평'(공급 34평)
function pickRepresentative(units: AptUnit[]): AptUnit | undefined {
  if (units.length === 0) return undefined
  return [...units].sort((a, b) =>
    Math.abs(a.area - NATIONAL_AREA) - Math.abs(b.area - NATIONAL_AREA) ||
    b.dealCount3m - a.dealCount3m
  )[0]
}

// 기본 표시 평형: 4개 이하면 전체, 많으면 거래 활발한 상위 4개
function defaultVisibleAreas(units: AptUnit[]): Set<number> {
  if (units.length <= 4) return new Set(units.map(u => u.area))
  const top = [...units].sort((a, b) =>
    b.dealCount3m - a.dealCount3m ||
    b.lastDeal.date.localeCompare(a.lastDeal.date) ||
    a.area - b.area
  ).slice(0, 4)
  return new Set(top.map(u => u.area))
}

// 평형 선택 칩 행
function AreaChipsRow({
  rowNum,
  units,
  exclusiveRatio,
  visible,
  onToggleArea,
  onShowAll,
}: {
  rowNum: number
  units: AptUnit[]
  exclusiveRatio?: number
  visible: Set<number>
  onToggleArea: (area: number) => void
  onShowAll: () => void
}) {
  const allVisible = units.every(u => visible.has(u.area))
  // 같은 평수가 여러 타입이면 전용면적으로 구분
  const pyeongCount = new Map<number, number>()
  for (const u of units) {
    const p = toPyeong(toSupply(u.area, exclusiveRatio))
    pyeongCount.set(p, (pyeongCount.get(p) ?? 0) + 1)
  }
  const chipStyle = (on: boolean): React.CSSProperties => ({
    fontSize: 10, padding: '1px 7px', cursor: 'pointer', borderRadius: 10,
    border: on ? '1px solid #217346' : '1px solid #ccc',
    background: on ? '#e8f5e9' : '#fff',
    color: on ? '#217346' : '#888',
    fontWeight: on ? 700 : 400,
    lineHeight: '16px',
  })
  return (
    <tr className="srow">
      <td className="rnum">{rowNum}</td>
      <td className="cell" colSpan={8} style={{ paddingLeft: 48 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', padding: '2px 0' }}>
          <span style={{ fontSize: 10, color: '#888', marginRight: 2 }}>평형 선택:</span>
          {units.map(u => {
            const p = toPyeong(toSupply(u.area, exclusiveRatio))
            const label = (pyeongCount.get(p) ?? 0) > 1 ? `${p}평(${u.area})` : `${p}평`
            return (
              <button key={u.area} style={chipStyle(visible.has(u.area))}
                onClick={e => { e.stopPropagation(); onToggleArea(u.area) }}>
                {label}
              </button>
            )
          })}
          {!allVisible && (
            <button style={{ ...chipStyle(false), borderStyle: 'dashed' }}
              onClick={e => { e.stopPropagation(); onShowAll() }}>
              전체 보기
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

// 전세가율 셀: 전세가율 % + 최근 순수 전세 보증금
function JeonseCell({ unit }: { unit?: AptUnit }) {
  if (!unit?.jeonse) return <td className="cell r" />
  return (
    <td className="cell r">
      <div>{unit.jeonseRatio != null ? `${unit.jeonseRatio}%` : '-'}</div>
      <div className="ext-row">전세 {formatPrice(unit.jeonse.price)}</div>
    </td>
  )
}

function UnitRow({ unit, rowNum, exclusiveRatio }: { unit: AptUnit; rowNum: number; exclusiveRatio?: number }) {
  const estimated = !isValidRatio(exclusiveRatio)
  const supply = toSupply(unit.area, exclusiveRatio)
  const supplyPyeong = toPyeong(supply)
  const perPyeong = supplyPyeong > 0 ? Math.round(unit.lastDeal.price / supplyPyeong) : 0
  return (
    <tr className="srow">
      <td className="rnum">{rowNum}</td>
      <td className="cell" style={{ paddingLeft: 48 }}>
        <span>{supplyPyeong}평</span>
        <div className="ext-row">전용 {unit.area}㎡ / 공급 {estimated ? '약 ' : ''}{supply}㎡</div>
      </td>
      <td className="cell r">
        <div>{unit.isNewHigh && <NewHighBadge />}{formatPrice(unit.lastDeal.price)}</div>
        <div className="ext-row">{unit.lastDeal.date}{perPyeong > 0 ? ` · 평당 ${formatPrice(perPyeong)}` : ''}</div>
      </td>
      <td className="cell r">{formatPrice(unit.avg3m)}</td>
      <td className="cell r">
        <div>{formatPrice(unit.allTimeHigh.price)}</div>
        <div className="ext-row">{unit.allTimeHigh.date}{unit.isNewHigh ? ' 갱신' : ''}</div>
      </td>
      <ChangeCell rate={unit.changeRate} />
      <JeonseCell unit={unit} />
      <td className="cell r">{unit.dealCount3m}건</td>
      <td className="cell" />
    </tr>
  )
}

// 차수 행 (2단계: 현대1차, 현대2차 ...)
function AptRow({
  result,
  rowNum,
  expanded,
  onToggle,
  onRemove,
  topLevel = false,
}: {
  result: AptResult
  rowNum: number
  expanded: boolean
  onToggle: () => void
  onRemove: () => void
  topLevel?: boolean
}) {
  const summary = pickRepresentative(result.units)
  const repPyeong = summary ? toPyeong(toSupply(summary.area, result.exclusiveRatio)) : 0
  return (
    <tr className="srow" style={{ cursor: 'pointer', ...(topLevel ? { fontWeight: 600 } : {}) }} onClick={onToggle}>
      <td className="rnum">{rowNum}</td>
      <td className="cell tick co-cell" style={{ paddingLeft: topLevel ? undefined : 24 }}>
        <span style={{ marginRight: 4 }}>{expanded ? '▾' : '▸'}</span>
        {/* 아파트명 클릭 → 네이버 부동산 지도 (행 펼침과 겹치지 않게 stopPropagation) */}
        <span
          onClick={e => { e.stopPropagation(); openMap(result.aptName, result.dongCode) }}
          title="네이버 부동산 지도에서 위치 보기"
          style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#c7c7c7', textUnderlineOffset: 2 }}
        >
          {result.aptName}
          <span style={{ marginLeft: 3, fontSize: 11, opacity: 0.7 }}>🗺</span>
        </span>
        {/* 접힘 상태에서 대표 행이 몇 평 기준인지 이름 옆에 표기 */}
        {summary && repPyeong > 0 && (
          <span style={{
            marginLeft: 6, fontSize: 10, fontWeight: 600, color: '#217346',
            background: '#e8f5e9', border: '1px solid #b5dcc0', borderRadius: 8,
            padding: '0 6px', lineHeight: '15px', display: 'inline-block', verticalAlign: 'middle',
          }}>
            {repPyeong}평
          </span>
        )}
        <div className="ext-row">
          {[
            result.buildYear ? `${result.buildYear}년 준공 (${Math.max(0, new Date().getFullYear() - parseInt(result.buildYear))}년차)` : '',
            result.houseHoldCnt ? `${result.houseHoldCnt.toLocaleString()}세대` : '',
            result.parkingPerHousehold ? `주차 ${result.parkingPerHousehold}대/세대` : '',
          ].filter(Boolean).join(' · ')}
        </div>
      </td>
      {summary ? (
        <>
          <td className="cell r">{summary.isNewHigh && <NewHighBadge />}{formatPrice(summary.lastDeal.price)}<div className="ext-row">{summary.lastDeal.date}</div></td>
          <td className="cell r">{formatPrice(summary.avg3m)}</td>
          <td className="cell r">{formatPrice(summary.allTimeHigh.price)}<div className="ext-row">{summary.allTimeHigh.date}{summary.isNewHigh ? ' 갱신' : ''}</div></td>
          <ChangeCell rate={summary.changeRate} />
          <JeonseCell unit={summary} />
          <td className="cell r">{result.units.reduce((s, u) => s + u.dealCount3m, 0)}건</td>
        </>
      ) : (
        <td className="cell er" colSpan={6}>거래 데이터 없음</td>
      )}
      <td className="cell">
        <button className="del" onClick={e => { e.stopPropagation(); onRemove() }}>삭제</button>
      </td>
    </tr>
  )
}

// 검색 그룹 행 (1단계: 검색어 기준)
function GroupRow({
  searchTerm,
  count,
  rowNum,
  expanded,
  athLoaded,
  onToggle,
  onRemove,
}: {
  searchTerm: string
  count: number
  rowNum: number
  expanded: boolean
  athLoaded: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  return (
    <tr className="srow" style={{ cursor: 'pointer', fontWeight: 600 }} onClick={onToggle}>
      <td className="rnum">{rowNum}</td>
      <td className="cell tick co-cell">
        <span style={{ marginRight: 4 }}>{expanded ? '▾' : '▸'}</span>
        {searchTerm}
        <div className="ext-row">{count}개 단지{athLoaded ? '' : ' · ATH 로딩중…'}</div>

      </td>
      <td className="cell" colSpan={6} />
      <td className="cell">
        <button className="del" onClick={e => { e.stopPropagation(); onRemove() }}>삭제</button>
      </td>
    </tr>
  )
}

export function AptTable({ results, onRemove, onRemoveGroup }: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedApts, setExpandedApts] = useState<Set<string>>(new Set())
  // 단지별 표시 평형 선택 (없으면 거래 활발한 상위 4개 기본값)
  const [visibleAreas, setVisibleAreas] = useState<Map<string, Set<number>>>(new Map())

  const getVisible = (aptKey: string, units: AptUnit[]): Set<number> =>
    visibleAreas.get(aptKey) ?? defaultVisibleAreas(units)

  const toggleArea = (aptKey: string, area: number, units: AptUnit[]) =>
    setVisibleAreas(prev => {
      const next = new Map(prev)
      const cur = new Set(next.get(aptKey) ?? defaultVisibleAreas(units))
      cur.has(area) ? cur.delete(area) : cur.add(area)
      next.set(aptKey, cur)
      return next
    })

  const showAllAreas = (aptKey: string, units: AptUnit[]) =>
    setVisibleAreas(prev => {
      const next = new Map(prev)
      next.set(aptKey, new Set(units.map(u => u.area)))
      return next
    })

  const toggleGroup = (key: string) =>
    setExpandedGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  const toggleApt = (key: string) =>
    setExpandedApts(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  // searchTerm+dongCode 기준으로 그룹핑 (순서 유지)
  const groups: { groupKey: string; searchTerm: string; dongCode: string; items: AptResult[] }[] = []
  const seen = new Map<string, number>()
  for (const r of results) {
    const gk = `${r.searchTerm}__${r.dongCode}`
    if (!seen.has(gk)) {
      seen.set(gk, groups.length)
      groups.push({ groupKey: gk, searchTerm: r.searchTerm, dongCode: r.dongCode, items: [] })
    }
    groups[seen.get(gk)!].items.push(r)
  }

  // 새로 추가된 그룹은 자동 펼침 (한 번 더 클릭하지 않아도 단지명이 바로 보이도록)
  // 사용자가 직접 접은 그룹은 다시 펼치지 않도록 최초 등장한 그룹만 처리
  const seenGroupsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const newKeys = groups.map(g => g.groupKey).filter(k => !seenGroupsRef.current.has(k))
    if (newKeys.length === 0) return
    newKeys.forEach(k => seenGroupsRef.current.add(k))
    setExpandedGroups(prev => new Set([...prev, ...newKeys]))
  }, [results]) // eslint-disable-line react-hooks/exhaustive-deps

  // 단지가 1개인 그룹: 차수 행 최초 등장 시 1회만 자동 펼침.
  // (results가 ATH·전세·단지정보 로딩으로 자주 갱신되는데, 매번 펼치면
  //  사용자가 접어도 다시 펴져버리므로 seenAptsRef로 최초 1회만 처리)
  const seenAptsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const newKeys = groups
      .filter(g => g.items.length === 1)
      .map(g => `${g.items[0].dongCode}-${g.items[0].aptName}`)
      .filter(k => !seenAptsRef.current.has(k))
    if (newKeys.length === 0) return
    newKeys.forEach(k => seenAptsRef.current.add(k))
    setExpandedApts(prev => new Set([...prev, ...newKeys]))
  }, [results]) // eslint-disable-line react-hooks/exhaustive-deps

  let globalRow = 1

  // 단지 행 + (평형 칩) + 평형별 행 렌더링 (단일 그룹/다중 그룹 공용)
  const renderAptBlock = (result: AptResult, topLevel: boolean, onRemoveFn: () => void) => {
    const aptKey = `${result.dongCode}-${result.aptName}`
    const isAptExpanded = expandedApts.has(aptKey)
    const aptRowNum = globalRow++
    const showChips = isAptExpanded && result.units.length > 3
    const visible = getVisible(aptKey, result.units)
    const filteredUnits = isAptExpanded ? result.units.filter(u => visible.has(u.area)) : []
    if (isAptExpanded) globalRow += (showChips ? 1 : 0) + filteredUnits.length
    let rowCursor = aptRowNum
    return (
      <React.Fragment key={aptKey}>
        <AptRow
          result={result}
          rowNum={aptRowNum}
          expanded={isAptExpanded}
          topLevel={topLevel}
          onToggle={() => toggleApt(aptKey)}
          onRemove={onRemoveFn}
        />
        {showChips && (
          <AreaChipsRow
            rowNum={++rowCursor}
            units={result.units}
            exclusiveRatio={result.exclusiveRatio}
            visible={visible}
            onToggleArea={area => toggleArea(aptKey, area, result.units)}
            onShowAll={() => showAllAreas(aptKey, result.units)}
          />
        )}
        {filteredUnits.map(unit => (
          <UnitRow
            key={`${aptKey}-${unit.area}`}
            unit={unit}
            rowNum={++rowCursor}
            exclusiveRatio={result.exclusiveRatio}
          />
        ))}
      </React.Fragment>
    )
  }

  return (
    <div className="xl-sheet">
      <table className="xl-table" style={{ width: '100%' }}>
        <colgroup>
          <col style={{ width: 28 }} />
          <col style={{ width: 200 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 70 }} />
        </colgroup>
        <thead>
          <tr>
            <td className="hcell" style={{ position: 'sticky', top: 0, zIndex: 10 }} />
            {['A','B','C','D','E','F','G','H'].map(c => (
              <td key={c} className="hcell" style={{ position: 'sticky', top: 0, zIndex: 10, textAlign: 'center' }}>{c}</td>
            ))}
          </tr>
          <tr className="hdr-row">
            <td className="rnum" style={{ position: 'sticky', top: 20, zIndex: 9 }} />
            <td className="cell" style={{ position: 'sticky', top: 20, zIndex: 9 }}>아파트명</td>
            <td className="cell r" style={{ position: 'sticky', top: 20, zIndex: 9 }}>최근 거래가</td>
            <td className="cell r" style={{ position: 'sticky', top: 20, zIndex: 9 }}>3개월 평균</td>
            <td className="cell r" style={{ position: 'sticky', top: 20, zIndex: 9 }}>역대 최고가</td>
            <td className="cell r" style={{ position: 'sticky', top: 20, zIndex: 9 }}>최고가 대비</td>
            <td className="cell r" style={{ position: 'sticky', top: 20, zIndex: 9 }}>전세가율</td>
            <td className="cell r" style={{ position: 'sticky', top: 20, zIndex: 9 }}>3개월 건수</td>
            <td className="cell" style={{ position: 'sticky', top: 20, zIndex: 9 }} />
          </tr>
        </thead>
        <tbody>
          {groups.map(group => {
            // 단지가 1개뿐인 그룹: 그룹 행 없이 단지 행 + 평형별 행을 바로 표시
            if (group.items.length === 1) {
              return renderAptBlock(group.items[0], true, () => onRemoveGroup(group.searchTerm, group.dongCode))
            }

            const isGroupExpanded = expandedGroups.has(group.groupKey)
            const groupRowNum = globalRow++
            const athLoaded = group.items.every(r => r.athLoaded)

            return (
              <React.Fragment key={group.groupKey}>
                <GroupRow
                  searchTerm={group.searchTerm}
                  count={group.items.length}
                  rowNum={groupRowNum}
                  expanded={isGroupExpanded}
                  athLoaded={athLoaded}
                  onToggle={() => toggleGroup(group.groupKey)}
                  onRemove={() => onRemoveGroup(group.searchTerm, group.dongCode)}
                />
                {isGroupExpanded && group.items.map(result =>
                  renderAptBlock(result, false, () => onRemove(result.aptName, result.dongCode))
                )}
              </React.Fragment>
            )
          })}
          {Array.from({ length: Math.max(0, 100 - globalRow + 1) }, (_, i) => (
            <tr key={`empty-${i}`} className="erow">
              <td className="rnum">{globalRow + i}</td>
              {Array.from({ length: 8 }, (_, j) => <td key={j} className="cell" />)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
