// src/hooks/useAptIndex.ts
import { useState, useEffect } from 'react'

export interface AptEntry { name: string; code: string; emdNm: string }

const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']

function toChosung(str: string): string {
  return [...str].map(c => {
    const code = c.charCodeAt(0) - 0xAC00
    if (code < 0 || code > 11171) return c
    return CHOSUNG[Math.floor(code / (21 * 28))]
  }).join('')
}

function matchToken(target: string, tok: string): boolean {
  if (target.includes(tok)) return true
  if ([...tok].every(c => CHOSUNG.includes(c))) return toChosung(target).includes(tok)
  return false
}

export function filterApt(index: AptEntry[], query: string, max = 10): AptEntry[] {
  const tokens = query.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []
  const results: AptEntry[] = []
  for (const apt of index) {
    if (tokens.every(tok => matchToken(apt.name, tok) || matchToken(apt.emdNm, tok))) {
      results.push(apt)
      if (results.length >= max) break
    }
  }
  return results
}

let cached: AptEntry[] | null = null

export function useAptIndex() {
  const [aptIndex, setAptIndex] = useState<AptEntry[]>(cached ?? [])
  const [loaded, setLoaded] = useState(cached !== null)

  useEffect(() => {
    if (cached !== null) return
    fetch('/apt-index.json')
      .then(r => r.ok ? r.json() : [])
      .then((data: AptEntry[]) => { cached = data; setAptIndex(data); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [])

  return { aptIndex, loaded }
}
