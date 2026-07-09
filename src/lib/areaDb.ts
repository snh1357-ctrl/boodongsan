// src/lib/areaDb.ts
// 정적 공급면적 DB(public/apt-area.json) 로더 + 조회.
//
// 국토부 실거래가 API는 전용면적만 제공하고, 공급면적(=전용+주거공용)이나 평형을
// 직접 주는 공개 API가 없다. 정확한 공급면적은 네이버 부동산에서 평형별로 수집해
// 정적 JSON으로 저장해 두고(scripts/gen-apt-area.mjs), 여기서 조회한다.
// DB에 없는 단지·면적은 호출부에서 전용률 추정으로 폴백한다.
//
// 데이터 형식: { "<시군구코드>|<단지명>": [{ exclusiveArea, supplyArea }, ...] }

export interface AreaEntry {
  exclusiveArea: number  // 전용면적(㎡)
  supplyArea: number     // 공급면적(㎡)
}

type AreaDb = Record<string, AreaEntry[]>

let db: AreaDb | null = null
let loading: Promise<void> | null = null

// public/apt-area.json 1회 로드 (실패·404여도 빈 DB로 처리 → 전부 폴백)
export function loadAreaDb(): Promise<void> {
  if (!loading) {
    loading = fetch('/apt-area.json')
      .then(r => (r.ok ? r.json() : {}))
      .then((d: AreaDb) => { db = d && typeof d === 'object' ? d : {} })
      .catch(() => { db = {} })
  }
  return loading
}

// 전용면적 목록에서 목표 전용면적에 가장 가까운 항목의 공급면적.
// 매매·수집 데이터의 전용면적 표기 오차를 흡수하기 위해 허용오차 내 최근접 매칭.
export function pickSupply(list: AreaEntry[], exclusiveArea: number, tol = 1.0): number | undefined {
  let best: number | undefined
  let bestDiff = Infinity
  for (const e of list) {
    const diff = Math.abs(e.exclusiveArea - exclusiveArea)
    if (diff <= tol && diff < bestDiff) { bestDiff = diff; best = e.supplyArea }
  }
  return best
}

// 시군구코드+단지명+전용면적 → 공급면적(㎡). 없으면 undefined(호출부에서 추정 폴백).
export function lookupSupply(dongCode: string, aptName: string, exclusiveArea: number): number | undefined {
  if (!db) return undefined
  const list = db[`${dongCode}|${aptName}`]
  if (!list || list.length === 0) return undefined
  return pickSupply(list, exclusiveArea)
}
