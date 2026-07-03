export interface RawDeal {
  aptNm: string
  excluUseAr: string   // "84.99"
  dealAmount: string   // "120,000" (만원, 쉼표 포함)
  dealYear: string
  dealMonth: string
  dealDay: string
  floor: string
  buildYear?: string   // 건축년도 (MOLIT 제공)
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
  isNewHigh: boolean    // 최근 거래가 역대 최고가를 갱신(동일 포함)했는지
}

export interface AptResult {
  aptName: string       // MOLIT 실제 저장 이름 (표시용)
  searchTerm: string    // 사용자 검색어 (재검색/삭제 그룹 키)
  dongCode: string
  units: AptUnit[]      // area 오름차순 정렬
  athLoaded?: boolean      // ATH 전체 기간 조회 완료 여부
  buildYear?: string       // 건축년도
  houseHoldCnt?: number    // 총 세대수 (AptListService2)
  exclusiveRatio?: number  // 단지 전용률 (전용면적합 ÷ 관리비부과면적, AptBasisInfoServiceV3)
}

export interface StockData {
  symbol: string
  market: 'US' | 'KR'
  name: string
  currency: string
  currentPrice: number
  prePostPrice?: number
  prePostLabel?: 'Pre' | 'After'
  dailyChange: number
  dailyChangePct: number
  ath: number
  athDate: string
  athDiff: number
  athDiffPct: number
  week52High: number
  week52HighPct: number
  week52Low: number
  week52LowPct: number
}

export interface StockSearchResult {
  symbol: string
  name: string
  type: string
  exchange: string
}

export interface BjdongEntry {
  code: string        // 5자리 시군구코드 (API 호출용)
  sidoNm: string      // "서울특별시"
  sigunguNm: string   // "강남구"
  emdNm: string       // "대치동"
  fullNm: string      // "서울특별시 강남구 대치동"
}
