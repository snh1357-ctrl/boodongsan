// src/hooks/useAptIndex.ts
// 호갱노노식 아파트 검색: 정확일치 > 접두어 > 포함 > 초성 순으로 랭킹.
// 지역명(동) 토큰과 조합 검색 지원, 초성·정규화 문자열은 로딩 시 1회만 계산.
import { useState, useEffect } from 'react'

export interface AptEntry { name: string; code: string; emdNm: string }

interface IndexedApt extends AptEntry {
  norm: string     // 이름 정규화 (공백 제거, 소문자)
  cho: string      // 이름 초성
  normEmd: string  // 동 이름 정규화
  choEmd: string   // 동 이름 초성
}

const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']

function toChosung(str: string): string {
  return [...str].map(c => {
    const code = c.charCodeAt(0) - 0xAC00
    if (code < 0 || code > 11171) return c
    return CHOSUNG[Math.floor(code / (21 * 28))]
  }).join('')
}

const normalize = (s: string) => s.replace(/\s/g, '').toLowerCase()

function buildIndex(entries: AptEntry[]): IndexedApt[] {
  return entries.map(e => {
    const norm = normalize(e.name)
    const normEmd = normalize(e.emdNm)
    return { ...e, norm, cho: toChosung(norm), normEmd, choEmd: toChosung(normEmd) }
  })
}

const isChosungToken = (tok: string) => [...tok].every(c => CHOSUNG.includes(c))

// 토큰 1개가 이름/지역에 얼마나 잘 맞는지 점수화. 0 = 불일치
function scoreToken(apt: IndexedApt, tok: string): number {
  const cho = isChosungToken(tok)
  if (!cho) {
    // 이름 매칭이 지역 매칭보다 우선
    if (apt.norm === tok) return 100
    if (apt.norm.startsWith(tok)) return 80
    if (apt.norm.includes(tok)) return 60
    if (apt.normEmd === tok) return 55
    if (apt.normEmd.startsWith(tok)) return 45
    if (apt.normEmd.includes(tok)) return 35
    return 0
  }
  if (apt.cho.startsWith(tok)) return 40
  if (apt.cho.includes(tok)) return 30
  if (apt.choEmd.startsWith(tok)) return 20
  if (apt.choEmd.includes(tok)) return 15
  return 0
}

export function filterApt(index: AptEntry[], query: string, max = 15): AptEntry[] {
  const tokens = normalize(query).length > 0
    ? query.trim().split(/\s+/).filter(Boolean).map(normalize)
    : []
  if (tokens.length === 0) return []

  const idx = index as IndexedApt[]
  const scored: { apt: IndexedApt; score: number }[] = []

  for (const apt of idx) {
    // 인덱스가 미리 계산되지 않은 경우(테스트 등) 즉석 계산
    const a = apt.norm !== undefined ? apt : (buildIndex([apt])[0] as IndexedApt)
    let total = 0
    let ok = true
    for (const tok of tokens) {
      const s = scoreToken(a, tok)
      if (s === 0) { ok = false; break }
      total += s
    }
    if (ok) scored.push({ apt, score: total })
  }

  // 점수 내림차순 → 이름 짧은 순 → 가나다순
  scored.sort((x, y) =>
    y.score - x.score ||
    x.apt.name.length - y.apt.name.length ||
    x.apt.name.localeCompare(y.apt.name, 'ko')
  )
  return scored.slice(0, max).map(s => s.apt)
}

let cached: IndexedApt[] | null = null

export function useAptIndex() {
  const [aptIndex, setAptIndex] = useState<AptEntry[]>(cached ?? [])
  const [loaded, setLoaded] = useState(cached !== null)

  useEffect(() => {
    if (cached !== null) return
    fetch('/apt-index.json')
      .then(r => r.ok ? r.json() : [])
      .then((data: AptEntry[]) => { cached = buildIndex(data); setAptIndex(cached); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  return { aptIndex, loaded }
}
