// src/components/AptTable.tsx
import React, { useState } from 'react'
import type { AptResult, AptUnit } from '../types'

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

function UnitRow({ unit, rowNum }: { unit: AptUnit; rowNum: number }) {
  return (
    <tr className="srow">
      <td className="rnum">{rowNum}</td>
      <td className="cell" style={{ paddingLeft: 48 }}>{unit.area}㎡</td>
      <td className="cell r">
        <div>{formatPrice(unit.lastDeal.price)}</div>
        <div className="ext-row">{unit.lastDeal.date}</div>
      </td>
      <td className="cell r">{formatPrice(unit.avg3m)}</td>
      <td className="cell r">
        <div>{formatPrice(unit.allTimeHigh.price)}</div>
        <div className="ext-row">{unit.allTimeHigh.date}</div>
      </td>
      <ChangeCell rate={unit.changeRate} />
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
}: {
  result: AptResult
  rowNum: number
  expanded: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  const summary = result.units[0]
  return (
    <tr className="srow" style={{ cursor: 'pointer' }} onClick={onToggle}>
      <td className="rnum">{rowNum}</td>
      <td className="cell tick co-cell" style={{ paddingLeft: 24 }}>
        <span style={{ marginRight: 4 }}>{expanded ? '▾' : '▸'}</span>
        {result.aptName}
      </td>
      {summary ? (
        <>
          <td className="cell r">{formatPrice(summary.lastDeal.price)}<div className="ext-row">{summary.lastDeal.date}</div></td>
          <td className="cell r">{formatPrice(summary.avg3m)}</td>
          <td className="cell r">{formatPrice(summary.allTimeHigh.price)}<div className="ext-row">{summary.allTimeHigh.date}</div></td>
          <ChangeCell rate={summary.changeRate} />
          <td className="cell r">{result.units.reduce((s, u) => s + u.dealCount3m, 0)}건</td>
        </>
      ) : (
        <td className="cell er" colSpan={5}>거래 데이터 없음</td>
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
      <td className="cell" colSpan={5} />
      <td className="cell">
        <button className="del" onClick={e => { e.stopPropagation(); onRemove() }}>삭제</button>
      </td>
    </tr>
  )
}

export function AptTable({ results, onRemove, onRemoveGroup }: Props) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedApts, setExpandedApts] = useState<Set<string>>(new Set())

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

  let globalRow = 1

  return (
    <div className="xl-sheet">
      <table className="xl-table" style={{ width: '100%' }}>
        <colgroup>
          <col style={{ width: 38 }} />
          <col style={{ width: 200 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 70 }} />
        </colgroup>
        <thead>
          <tr>
            <td className="hcell" style={{ position: 'sticky', top: 0, zIndex: 10 }} />
            {['A','B','C','D','E','F','G'].map(c => (
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
            <td className="cell r" style={{ position: 'sticky', top: 20, zIndex: 9 }}>3개월 건수</td>
            <td className="cell" style={{ position: 'sticky', top: 20, zIndex: 9 }} />
          </tr>
        </thead>
        <tbody>
          {groups.map(group => {
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
                {isGroupExpanded && group.items.map(result => {
                  const aptKey = `${result.dongCode}-${result.aptName}`
                  const isAptExpanded = expandedApts.has(aptKey)
                  const aptRowNum = globalRow++
                  if (isAptExpanded) result.units.forEach(() => globalRow++)
                  return (
                    <React.Fragment key={aptKey}>
                      <AptRow
                        result={result}
                        rowNum={aptRowNum}
                        expanded={isAptExpanded}
                        onToggle={() => toggleApt(aptKey)}
                        onRemove={() => onRemove(result.aptName, result.dongCode)}
                      />
                      {isAptExpanded && result.units.map((unit, i) => (
                        <UnitRow
                          key={`${aptKey}-${unit.area}`}
                          unit={unit}
                          rowNum={aptRowNum + i + 1}
                        />
                      ))}
                    </React.Fragment>
                  )
                })}
              </React.Fragment>
            )
          })}
          {Array.from({ length: Math.max(0, 100 - globalRow + 1) }, (_, i) => (
            <tr key={`empty-${i}`} className="erow">
              <td className="rnum">{globalRow + i}</td>
              {Array.from({ length: 7 }, (_, j) => <td key={j} className="cell" />)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
