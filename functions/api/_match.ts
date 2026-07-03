// functions/api/_match.ts
// MOLIT 단지명 매칭 공용 로직 (search.ts / rent.ts 공유)
// K-apt 단지명과 MOLIT 단지명의 표기 차이(특수문자·접두어·차수)를 흡수

// 이름 정규화: 공백·"아파트" 접미사·괄호 반복 표기 제거
// MOLIT은 "래미안퍼스티지(래미안퍼스티지)" 같은 형식 사용
function normalize(s: string): string {
  return s.replace(/\s/g, '')
    .replace(/\([^)]*\)/g, '')   // (괄호 내용) 제거
    .replace(/아파트$/, '')
    .toLowerCase()
}

// 더 느슨한 정규화: 한글·영문·숫자만 남김 (·, -, . 등 특수문자 제거)
function looseNormalize(s: string): string {
  return s.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^가-힣a-z0-9]/g, '').replace(/아파트$/, '')
}

// 두 문자열의 최장 공통 부분문자열 길이
function lcsLength(a: string, b: string): number {
  let best = 0
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++
      if (k > best) best = k
    }
  }
  return best
}

// MOLIT 이름에서 뒤쪽 차수/단지 번호 제거한 기본명
// 예: "현대1차" → "현대", "신현대2단지" → "신현대"
function stripSuffix(s: string): string {
  return s.replace(/\d+[차단지동블럭호]?$/, '').replace(/\d+$/, '')
}

// 단계적 매칭: 엄격 → 느슨한 정규화 → 공통 부분문자열
export function matchDeals<T extends { aptNm?: string }>(allDeals: T[], aptName: string): T[] {
  const normTarget = normalize(aptName)

  // 1단계: 엄격 매칭
  const strict = allDeals.filter(d => {
    const n = normalize(d.aptNm ?? '')
    if (!n) return false
    if (n === normTarget) return true
    if (n.includes(normTarget)) return true           // MOLIT이 뒤에 접미사 추가 (예: "1단지")
    if (n.length >= 3 && normTarget.includes(n)) return true   // MOLIT이 지역명 없이 저장 (예: "신현대")
    const nBase = stripSuffix(n)
    if (nBase.length >= 2 && normTarget.endsWith(nBase)) return true
    return false
  })
  if (strict.length > 0) return strict

  // 2단계: 특수문자 제거 후 포함 관계
  const looseTarget = looseNormalize(aptName)
  if (looseTarget.length >= 3) {
    const loose = allDeals.filter(d => {
      const n = looseNormalize(d.aptNm ?? '')
      if (!n) return false
      return n === looseTarget || n.includes(looseTarget) || (n.length >= 3 && looseTarget.includes(n))
    })
    if (loose.length > 0) return loose
  }

  // 3단계: 최장 공통 부분문자열 (4자 이상 & 검색어의 60% 이상)
  if (looseTarget.length >= 4) {
    const minLen = Math.max(4, Math.ceil(looseTarget.length * 0.6))
    return allDeals.filter(d => {
      const n = looseNormalize(d.aptNm ?? '')
      return n.length > 0 && lcsLength(n, looseTarget) >= minLen
    })
  }

  return []
}
