import type { RawDeal, AptUnit } from '../types'

export function parsePrice(amount: string): number {
  return parseInt(amount.replace(/,/g, ''), 10)
}

export function dealDate(d: RawDeal): string {
  return `${d.dealYear}-${String(+d.dealMonth).padStart(2, '0')}-${String(+d.dealDay).padStart(2, '0')}`
}

// 여러 기간을 겹쳐 조회할 때 생기는 중복 거래 제거
export function dedupeDeals(deals: RawDeal[]): RawDeal[] {
  const seen = new Set<string>()
  return deals.filter(d => {
    const k = `${d.aptNm}|${d.dealYear}-${d.dealMonth}-${d.dealDay}|${d.dealAmount}|${d.floor}|${d.excluUseAr}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

export function aggregateByArea(deals: RawDeal[]): AptUnit[] {
  if (deals.length === 0) return []

  const byArea = new Map<number, RawDeal[]>()
  for (const d of deals) {
    const area = Math.round(parseFloat(d.excluUseAr) * 100) / 100
    const arr = byArea.get(area) ?? []
    arr.push(d)
    byArea.set(area, arr)
  }

  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())

  const units: AptUnit[] = []
  for (const [area, areaDeals] of byArea) {
    const sorted = [...areaDeals].sort((a, b) => dealDate(a).localeCompare(dealDate(b)))

    const lastDeal = sorted[sorted.length - 1]
    const lastPrice = parsePrice(lastDeal.dealAmount)

    const recent3m = sorted.filter(d => new Date(dealDate(d)) >= threeMonthsAgo)
    const avg3m =
      recent3m.length > 0
        ? Math.round(recent3m.reduce((s, d) => s + parsePrice(d.dealAmount), 0) / recent3m.length)
        : lastPrice

    const athDeal = sorted.reduce((max, d) =>
      parsePrice(d.dealAmount) > parsePrice(max.dealAmount) ? d : max,
    )
    const athPrice = parsePrice(athDeal.dealAmount)

    units.push({
      area,
      lastDeal: { price: lastPrice, date: dealDate(lastDeal) },
      avg3m,
      allTimeHigh: { price: athPrice, date: dealDate(athDeal) },
      changeRate: athPrice > 0 ? ((lastPrice / athPrice) - 1) * 100 : 0,
      dealCount3m: recent3m.length,
      isNewHigh: athPrice > 0 && lastPrice >= athPrice,
    })
  }

  return units.sort((a, b) => a.area - b.area)
}
