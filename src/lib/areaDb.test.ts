import { describe, it, expect } from 'vitest'
import { pickSupply } from './areaDb'

describe('pickSupply', () => {
  const list = [
    { exclusiveArea: 59.92, supplyArea: 79.34 },
    { exclusiveArea: 84.43, supplyArea: 112.39 },
    { exclusiveArea: 114.51, supplyArea: 149.5 },
  ]

  it('정확히 일치하는 전용면적의 공급면적을 반환', () => {
    expect(pickSupply(list, 84.43)).toBe(112.39)
  })

  it('표기 오차(±1㎡ 이내)는 최근접으로 매칭', () => {
    expect(pickSupply(list, 84.99)).toBe(112.39) // 84.43과 0.56 차이 → 매칭
    expect(pickSupply(list, 59.98)).toBe(79.34)
  })

  it('허용오차를 벗어나면 undefined (폴백 유도)', () => {
    expect(pickSupply(list, 84.43 + 2)).toBeUndefined()
    expect(pickSupply(list, 100)).toBeUndefined()
  })

  it('여러 후보 중 가장 가까운 것 선택', () => {
    // 100㎡는 84.43(15.57)보다 114.51(14.51)에 더 가까움
    expect(pickSupply(list, 114.0)).toBe(149.5)
  })

  it('빈 목록은 undefined', () => {
    expect(pickSupply([], 84)).toBeUndefined()
  })
})
