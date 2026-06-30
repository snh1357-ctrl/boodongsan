import type { StockData } from '../types'

interface Props {
  stocks: StockData[]
  loading: Set<string>
  filter: 'all' | 'US' | 'KR'
  onRemove: (symbol: string) => void
}

function fmtPrice(price: number, currency: string): string {
  if (currency === 'KRW') return `₩${price.toLocaleString('ko-KR')}`
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDiff(diff: number, currency: string): string {
  const abs = Math.abs(diff)
  const sign = diff >= 0 ? '+' : '-'
  if (currency === 'KRW') return `${sign}₩${abs.toLocaleString('ko-KR')}`
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function AthPctCell({ pct }: { pct: number }) {
  const barWidth = Math.min(Math.abs(pct), 100)
  const cls = pct >= 0 ? 'pct-p' : 'pct-n'
  return (
    <td className={`cell r bc ${cls}`} style={{ minWidth: 90 }}>
      <div className="pct-wrap">
        <div className="pct-top">{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</div>
        <div className="pct-bot">
          <div className="pct-bar" style={{ width: `${barWidth}%` }} />
        </div>
      </div>
    </td>
  )
}

function DailyChangeCell({ change, pct }: { change: number; pct: number }) {
  const up = change >= 0
  const cls = up ? 'pct-p' : 'pct-n'
  const arrow = up ? '▲' : '▼'
  return (
    <td className={`cell r ${cls}`} style={{ minWidth: 90 }}>
      <div style={{ fontWeight: 600 }}>{arrow} {Math.abs(pct).toFixed(2)}%</div>
      <div className="ext-row">{up ? '+' : ''}{change.toFixed(2)}</div>
    </td>
  )
}

function StockRow({ stock, rowNum, onRemove }: { stock: StockData; rowNum: number; onRemove: () => void }) {
  return (
    <tr className="srow">
      <td className="rnum">{rowNum}</td>
      <td className="cell tick co-cell">
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span className={`mkt-badge ${stock.market === 'US' ? 'us' : 'kr'}`}>{stock.market}</span>
          <strong style={{ fontSize: 13 }}>{stock.symbol}</strong>
        </div>
      </td>
      <td className="cell" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span style={{ fontSize: 12 }}>{stock.name}</span>
      </td>
      <td className="cell r">
        <div style={{ fontWeight: 600 }}>{fmtPrice(stock.currentPrice, stock.currency)}</div>
        {stock.prePostPrice != null && (
          <div className="ext-row">
            <span style={{ fontSize: 9, background: '#e0e0e0', padding: '0 3px', borderRadius: 2, marginRight: 2 }}>{stock.prePostLabel}</span>
            {fmtPrice(stock.prePostPrice, stock.currency)}
          </div>
        )}
      </td>
      <DailyChangeCell change={stock.dailyChange} pct={stock.dailyChangePct} />
      <AthPctCell pct={stock.athDiffPct} />
      <td className="cell r">
        <div style={{ fontWeight: 500 }}>{fmtPrice(stock.ath, stock.currency)}</div>
        {stock.athDate && <div className="ext-row">{stock.athDate}</div>}
      </td>
      <td className={`cell r ${stock.athDiff < 0 ? 'pct-n' : 'pct-p'}`}>
        {fmtDiff(stock.athDiff, stock.currency)}
      </td>
      <td className="cell r">
        <div>{fmtPrice(stock.week52High, stock.currency)}</div>
        <div className="ext-row" style={{ color: stock.week52HighPct < 0 ? '#c00' : '#080' }}>
          {stock.week52HighPct >= 0 ? '+' : ''}{stock.week52HighPct.toFixed(2)}%
        </div>
      </td>
      <td className="cell r">
        <div>{fmtPrice(stock.week52Low, stock.currency)}</div>
        <div className="ext-row" style={{ color: '#080' }}>
          +{stock.week52LowPct.toFixed(2)}%
        </div>
      </td>
      <td className="cell">
        <button className="del" onClick={onRemove}>Delete</button>
      </td>
    </tr>
  )
}

function LoadingRow({ symbol, rowNum }: { symbol: string; rowNum: number }) {
  return (
    <tr className="srow">
      <td className="rnum">{rowNum}</td>
      <td className="cell tick co-cell"><strong>{symbol}</strong></td>
      <td className="cell er" colSpan={9} style={{ color: '#888', fontStyle: 'italic' }}>조회중…</td>
    </tr>
  )
}

export function StockTable({ stocks, loading, filter, onRemove }: Props) {
  const filtered = filter === 'all' ? stocks : stocks.filter(s => s.market === filter)
  let rowNum = 1

  return (
    <div className="xl-sheet">
      <table className="xl-table" style={{ width: '100%' }}>
        <colgroup>
          <col style={{ width: 38 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 180 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 100 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 120 }} />
          <col style={{ width: 110 }} />
          <col style={{ width: 70 }} />
        </colgroup>
        <thead>
          <tr>
            <td className="hcell" style={{ position: 'sticky', top: 0, zIndex: 10 }} />
            {['A','B','C','D','E','F','G','H','I','J'].map(c => (
              <td key={c} className="hcell" style={{ position: 'sticky', top: 0, zIndex: 10, textAlign: 'center' }}>{c}</td>
            ))}
          </tr>
          <tr className="hdr-row">
            <td className="rnum" style={{ position: 'sticky', top: 20, zIndex: 9 }} />
            {['티커','종목명','현재가','일간변동','ATH 대비 %','역대최고가','차이 (ATH-현재)','52주 최고','52주 최저',''].map((h, i) => (
              <td key={i} className={`cell${i >= 2 ? ' r' : ''}`} style={{ position: 'sticky', top: 20, zIndex: 9 }}>{h}</td>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Loading rows for symbols being fetched but not yet in list */}
          {[...loading].filter(sym => !stocks.find(s => s.symbol === sym)).map(sym => (
            <LoadingRow key={sym} symbol={sym} rowNum={rowNum++} />
          ))}
          {filtered.map(stock => (
            <StockRow
              key={stock.symbol}
              stock={stock}
              rowNum={rowNum++}
              onRemove={() => onRemove(stock.symbol)}
            />
          ))}
          {Array.from({ length: Math.max(0, 100 - rowNum + 1) }, (_, i) => (
            <tr key={`e-${i}`} className="erow">
              <td className="rnum">{rowNum + i}</td>
              {Array.from({ length: 10 }, (_, j) => <td key={j} className="cell" />)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
