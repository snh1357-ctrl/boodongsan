export interface RawDeal {
  aptNm: string
  excluUseAr: string   // "84.99"
  dealAmount: string   // "120,000" (만원, 쉼표 포함)
  dealYear: string
  dealMonth: string
  dealDay: string
  floor: string
}

export interface DealPoint {
  price: number   // 만원
  date: string    // "YYYY-MM-DD"
}

export interface AptUnit {
  area: number          // 전용면적 (소수 2자리)
  lastDeal: DealPoint
  avg3m: number         // 만원
  allTimeHigh: DealPoint
  changeRate: number    // (lastDeal.price / allTimeHigh.price - 1) * 100
  dealCount3m: number
}

export interface AptResult {
  aptName: string
  dongCode: string
  units: AptUnit[]      // area 오름차순 정렬
}

export interface BjdongEntry {
  code: string        // 5자리 시군구코드 (API 호출용)
  sidoNm: string      // "서울특별시"
  sigunguNm: string   // "강남구"
  emdNm: string       // "대치동"
  fullNm: string      // "서울특별시 강남구 대치동"
}
