import { describe, it, expect } from 'vitest'
import aptIndexData from '../../public/apt-index.json'
import { filterApt, type AptEntry } from './useAptIndex'

const index = aptIndexData as AptEntry[]

describe('filterApt (실제 인덱스)', () => {
  it('아크로베스티뉴 정확 검색', () => {
    const r = filterApt(index, '아크로베스티뉴')
    expect(r.length).toBeGreaterThan(0)
    expect(r[0].name).toBe('아크로베스티뉴')
  })

  it('띄어쓰기 포함 검색: 아크로 베스티뉴', () => {
    const r = filterApt(index, '아크로 베스티뉴')
    expect(r.some(a => a.name === '아크로베스티뉴')).toBe(true)
  })

  it('부분 검색: 베스티뉴', () => {
    const r = filterApt(index, '베스티뉴')
    expect(r.some(a => a.name === '아크로베스티뉴')).toBe(true)
  })

  it('지역+이름 조합: 호계동 아크로', () => {
    const r = filterApt(index, '호계동 아크로')
    expect(r.some(a => a.name === '아크로베스티뉴')).toBe(true)
  })

  it('초성 검색: ㄹㅁㅇ', () => {
    const r = filterApt(index, 'ㄹㅁㅇ')
    expect(r.length).toBeGreaterThan(0)
    expect(r.every(a => a.name.length > 0)).toBe(true)
  })

  it('접두어 일치가 포함 일치보다 우선', () => {
    const r = filterApt(index, '아크로')
    expect(r[0].name.replace(/\s/g, '').startsWith('아크로')).toBe(true)
  })
})
