import { describe, it, expect } from 'vitest'
import { parsePrice, dealDate, aggregateByArea } from './aggregate'
import type { RawDeal } from '../types'

const makeDeal = (overrides: Partial<RawDeal>): RawDeal => ({
  aptNm: '테스트아파트',
  excluUseAr: '84.99',
  dealAmount: '100,000',
  dealYear: '2024',
  dealMonth: '1',
  dealDay: '1',
  floor: '10',
  ...overrides,
})

describe('parsePrice', () => {
  it('쉼표 포함 금액을 정수로 파싱', () => {
    expect(parsePrice('120,000')).toBe(120000)
    expect(parsePrice('85,500')).toBe(85500)
    expect(parsePrice('1,200,000')).toBe(1200000)
  })
})

describe('dealDate', () => {
  it('RawDeal에서 YYYY-MM-DD 문자열 생성', () => {
    expect(dealDate(makeDeal({ dealYear: '2024', dealMonth: '3', dealDay: '5' }))).toBe('2024-03-05')
    expect(dealDate(makeDeal({ dealYear: '2021', dealMonth: '12', dealDay: '31' }))).toBe('2021-12-31')
  })
})

describe('aggregateByArea', () => {
  it('면적별로 그룹화하고 최근 거래가 반환', () => {
    const deals = [
      makeDeal({ excluUseAr: '84.99', dealAmount: '100,000', dealYear: '2024', dealMonth: '1', dealDay: '1' }),
      makeDeal({ excluUseAr: '84.99', dealAmount: '110,000', dealYear: '2024', dealMonth: '6', dealDay: '15' }),
    ]
    const units = aggregateByArea(deals)
    expect(units).toHaveLength(1)
    expect(units[0].lastDeal.price).toBe(110000)
    expect(units[0].lastDeal.date).toBe('2024-06-15')
  })

  it('역대 최고가 계산', () => {
    const deals = [
      makeDeal({ dealAmount: '150,000', dealYear: '2021', dealMonth: '8', dealDay: '1' }),
      makeDeal({ dealAmount: '110,000', dealYear: '2024', dealMonth: '6', dealDay: '1' }),
    ]
    const units = aggregateByArea(deals)
    expect(units[0].allTimeHigh.price).toBe(150000)
    expect(units[0].allTimeHigh.date).toBe('2021-08-01')
  })

  it('등락률 계산: 현재가가 최고가의 73%이면 -27%', () => {
    const deals = [
      makeDeal({ dealAmount: '100,000', dealYear: '2021', dealMonth: '1', dealDay: '1' }),
      makeDeal({ dealAmount: '73,000', dealYear: '2024', dealMonth: '1', dealDay: '1' }),
    ]
    const units = aggregateByArea(deals)
    expect(units[0].changeRate).toBeCloseTo(-27, 0)
  })

  it('여러 면적을 area 오름차순으로 정렬', () => {
    const deals = [
      makeDeal({ excluUseAr: '114.98', dealAmount: '200,000' }),
      makeDeal({ excluUseAr: '59.9', dealAmount: '80,000' }),
      makeDeal({ excluUseAr: '84.99', dealAmount: '120,000' }),
    ]
    const units = aggregateByArea(deals)
    expect(units.map(u => u.area)).toEqual([59.9, 84.99, 114.98])
  })

  it('빈 배열이면 빈 결과 반환', () => {
    expect(aggregateByArea([])).toEqual([])
  })

  it('등락률은 역대최고가가 0일 때 0 반환', () => {
    const deals = [makeDeal({ dealAmount: '0', dealYear: '2024', dealMonth: '1', dealDay: '1' })]
    const units = aggregateByArea(deals)
    expect(units[0].changeRate).toBe(0)
  })
})
