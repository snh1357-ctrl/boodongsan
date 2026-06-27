# 부동산 아파트 실거래가 조회 사이트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 국토교통부 공공 API 기반 아파트 실거래가 조회 웹앱 (최근 거래가·3개월 평균·역대 최고가·등락률)

**Architecture:** React 프론트엔드가 `/api/search` (Cloudflare Pages Function)를 호출 → Function은 API 키를 Secret으로 보관하고 국토교통부 API를 프록시 + 24시간 캐싱 → 응답(raw deals)을 클라이언트가 집계.

**Tech Stack:** React 18, TypeScript (strict), Vite, Vitest, Cloudflare Pages Functions, Wrangler

## Global Constraints
- Node.js ≥ 18
- TypeScript strict mode (`strict: true`)
- API 키: Cloudflare Secret `MOLIT_API_KEY` / 로컬: `.dev.vars`
- 배포: Cloudflare Pages (`boodongsan.pages.dev`)
- 디자인 원본: `C:\Users\skh96\OneDrive\claude\index.html` (Excel UI, `#107c41` 초록 테마)
- 모바일 640px 이하 반응형 (Excel 크롬 숨김, 테이블 가로 스크롤 유지)

---

## 파일 구조

```
boodongsan/
├── functions/
│   └── api/
│       └── search.ts          ← Pages Function (API 프록시 + 캐싱)
├── scripts/
│   └── gen-bjdong.mjs         ← 법정동코드 JSON 생성 스크립트 (1회 실행)
├── src/
│   ├── components/
│   │   ├── ExcelShell.tsx     ← 전체 레이아웃 (타이틀바·리본·상태바)
│   │   ├── SearchBar.tsx      ← Formula Bar + 자동완성 드롭다운
│   │   ├── AptTable.tsx       ← 스프레드시트 테이블
│   │   └── RegionSearch.tsx   ← 지역검색 탭 (시도→시군구→동 드롭다운)
│   ├── data/
│   │   └── bjdong.json        ← 법정동코드 전체 (gen-bjdong.mjs로 생성)
│   ├── hooks/
│   │   └── useAptSearch.ts    ← /api/search 호출 + 상태 관리
│   ├── lib/
│   │   └── aggregate.ts       ← 순수 집계 함수 (테스트 대상)
│   ├── styles/
│   │   └── excel.css          ← 원본 HTML <style> 태그 내용 추출
│   ├── test/
│   │   └── setup.ts
│   ├── types.ts
│   ├── App.tsx
│   └── main.tsx
├── .dev.vars                  ← 로컬 Pages Functions Secret (gitignore)
└── vitest.config.ts
```

---

## Task 1: 개발 도구 설치 및 설정

**Files:**
- Modify: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `.dev.vars`
- Modify: `package.json` (scripts 추가)

**Interfaces:**
- Produces: `npm test` 명령으로 Vitest 실행 가능한 환경

- [ ] **Step 1: 패키지 설치**

```bash
cd "C:\Users\skh96\OneDrive\boodongsan"
npm install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
npm install -D wrangler @cloudflare/workers-types
```

- [ ] **Step 2: vitest.config.ts 생성**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

- [ ] **Step 3: src/test/setup.ts 생성**

```typescript
// src/test/setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 4: package.json scripts 추가**

`package.json`의 `scripts` 섹션에 추가:
```json
"test": "vitest run",
"test:watch": "vitest",
"pages:dev": "wrangler pages dev --proxy 5173 --compatibility-date=2024-09-23"
```

- [ ] **Step 5: .dev.vars 생성 (gitignore 이미 설정됨)**

```
# .dev.vars
MOLIT_API_KEY=여기에_발급받은_키_붙여넣기
```

- [ ] **Step 6: 동작 확인**

```bash
npm test
```
Expected: "No test files found" (오류 없이 종료)

- [ ] **Step 7: 커밋**

```bash
git add vitest.config.ts src/test/setup.ts package.json package-lock.json
git commit -m "chore: add Vitest and Wrangler dev tooling"
```

---

## Task 2: TypeScript 타입 + 집계 로직 (TDD)

**Files:**
- Create: `src/types.ts`
- Create: `src/lib/aggregate.ts`
- Create: `src/lib/aggregate.test.ts`

**Interfaces:**
- Produces:
  - `RawDeal`, `DealPoint`, `AptUnit`, `AptResult`, `BjdongEntry` 타입
  - `aggregateByArea(deals: RawDeal[]): AptUnit[]`
  - `parsePrice(amount: string): number`
  - `dealDate(d: RawDeal): string`

- [ ] **Step 1: src/types.ts 생성**

```typescript
// src/types.ts

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
```

- [ ] **Step 2: 실패 테스트 먼저 작성**

```typescript
// src/lib/aggregate.test.ts
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
})
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
npm test
```
Expected: FAIL — "Cannot find module './aggregate'"

- [ ] **Step 4: src/lib/aggregate.ts 구현**

```typescript
// src/lib/aggregate.ts
import type { RawDeal, AptUnit } from '../types'

export function parsePrice(amount: string): number {
  return parseInt(amount.replace(/,/g, ''), 10)
}

export function dealDate(d: RawDeal): string {
  return `${d.dealYear}-${String(+d.dealMonth).padStart(2, '0')}-${String(+d.dealDay).padStart(2, '0')}`
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
      changeRate: ((lastPrice / athPrice) - 1) * 100,
      dealCount3m: recent3m.length,
    })
  }

  return units.sort((a, b) => a.area - b.area)
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npm test
```
Expected: PASS — 모든 테스트 통과

- [ ] **Step 6: 커밋**

```bash
git add src/types.ts src/lib/aggregate.ts src/lib/aggregate.test.ts
git commit -m "feat: add types and aggregation logic with tests"
```

---

## Task 3: 법정동코드 데이터 생성

**Files:**
- Create: `scripts/gen-bjdong.mjs`
- Create: `src/data/bjdong.json` (스크립트 실행 결과)

**Interfaces:**
- Produces: `BjdongEntry[]` 형태의 JSON 파일 (약 3,500개 읍면동)

- [ ] **Step 1: xlsx 패키지 설치**

```bash
npm install -D xlsx
```

- [ ] **Step 2: scripts/gen-bjdong.mjs 생성**

```javascript
// scripts/gen-bjdong.mjs
// 실행 전: https://www.code.go.kr/stdcode/regCodeL.do 에서
// "법정동코드 전체자료" Excel 파일을 다운로드하여 scripts/법정동코드_전체자료.xlsx 로 저장
import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const inputPath = resolve(__dirname, '법정동코드_전체자료.xlsx')
const outputPath = resolve(__dirname, '../src/data/bjdong.json')

const wb = XLSX.readFile(inputPath)
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

const entries = []
for (const row of rows.slice(1)) {
  const code10 = String(row[0] ?? '').trim()     // 10자리 법정동코드
  const fullNm = String(row[1] ?? '').trim()     // "서울특별시 강남구 대치동"
  const status = String(row[2] ?? '').trim()     // "존재" or "폐지"

  if (status !== '존재') continue
  if (code10.length !== 10) continue

  // 읍면동 단위만 (코드 8-10자리가 00이 아닌 것)
  if (code10.slice(5, 8) === '000') continue

  const parts = fullNm.split(' ')
  if (parts.length < 3) continue

  entries.push({
    code: code10.slice(0, 5),      // 시군구코드 5자리 (API 호출용)
    sidoNm: parts[0],
    sigunguNm: parts[1],
    emdNm: parts.slice(2).join(' '),
    fullNm,
  })
}

// 중복 제거 (같은 fullNm)
const unique = entries.filter((e, i, arr) => arr.findIndex(x => x.fullNm === e.fullNm) === i)

writeFileSync(outputPath, JSON.stringify(unique, null, 0))
console.log(`생성 완료: ${unique.length}개 항목 → src/data/bjdong.json`)
```

- [ ] **Step 3: 법정동코드 Excel 다운로드**

브라우저에서 `https://www.code.go.kr/stdcode/regCodeL.do` 접속 →
"법정동코드 전체자료" 다운로드 →
`C:\Users\skh96\OneDrive\boodongsan\scripts\법정동코드_전체자료.xlsx` 로 저장

- [ ] **Step 4: 스크립트 실행**

```bash
node scripts/gen-bjdong.mjs
```
Expected: "생성 완료: 약 3500개 항목 → src/data/bjdong.json"

- [ ] **Step 5: 결과 확인**

`src/data/bjdong.json` 첫 항목 형태 확인:
```json
[{"code":"11110","sidoNm":"서울특별시","sigunguNm":"종로구","emdNm":"청운동","fullNm":"서울특별시 종로구 청운동"},...]
```

- [ ] **Step 6: .gitignore에 Excel 파일 추가**

`.gitignore`에 추가:
```
scripts/*.xlsx
```

- [ ] **Step 7: 커밋**

```bash
git add src/data/bjdong.json scripts/gen-bjdong.mjs .gitignore
git commit -m "feat: add bjdong code data and generation script"
```

---

## Task 4: Cloudflare Pages Function (API 프록시)

**Files:**
- Create: `functions/api/search.ts`

**Interfaces:**
- Consumes: `GET /api/search?dongCode=11680&aptName=래미안대치팰리스`
- Produces: `{ aptName: string, dongCode: string, deals: RawDeal[] }` JSON
- Env Secret: `MOLIT_API_KEY`

- [ ] **Step 1: functions/api/search.ts 생성**

```typescript
// functions/api/search.ts

interface Env {
  MOLIT_API_KEY: string
}

interface MolitItem {
  aptNm: string
  excluUseAr: string
  dealAmount: string
  dealYear: string
  dealMonth: string
  dealDay: string
  floor: string
}

function generateMonths(from: string, to: string): string[] {
  const months: string[] = []
  let year = parseInt(from.slice(0, 4))
  let month = parseInt(from.slice(4, 6))
  const toYear = parseInt(to.slice(0, 4))
  const toMonth = parseInt(to.slice(4, 6))
  while (year < toYear || (year === toYear && month <= toMonth)) {
    months.push(`${year}${String(month).padStart(2, '0')}`)
    month++
    if (month > 12) { month = 1; year++ }
  }
  return months
}

function currentYYYYMM(): string {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
}

async function fetchMonth(apiKey: string, dongCode: string, ym: string): Promise<MolitItem[]> {
  const url = new URL('https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev')
  url.searchParams.set('serviceKey', apiKey)
  url.searchParams.set('LAWD_CD', dongCode)
  url.searchParams.set('DEAL_YMD', ym)
  url.searchParams.set('numOfRows', '1000')
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('_type', 'json')

  try {
    const res = await fetch(url.toString())
    if (!res.ok) return []
    const data = await res.json() as any
    const items = data?.response?.body?.items?.item
    if (!items) return []
    return Array.isArray(items) ? items : [items]
  } catch {
    return []
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const dongCode = url.searchParams.get('dongCode')
  const aptName = url.searchParams.get('aptName')

  if (!dongCode || !aptName) {
    return new Response(JSON.stringify({ error: 'dongCode and aptName required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const cacheKey = new Request(
    `https://boodongsan-cache.internal/${dongCode}/${encodeURIComponent(aptName)}`
  )
  const cache = caches.default
  const cached = await cache.match(cacheKey)
  if (cached) return cached

  const months = generateMonths('200601', currentYYYYMM())

  // 20개씩 배치 처리 (API 레이트 리밋 방지)
  const BATCH = 20
  const allDeals: MolitItem[] = []
  for (let i = 0; i < months.length; i += BATCH) {
    const batch = months.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(ym => fetchMonth(context.env.MOLIT_API_KEY, dongCode, ym))
    )
    allDeals.push(...results.flat())
  }

  const aptDeals = allDeals.filter(d => d.aptNm?.trim() === aptName.trim())

  const response = new Response(
    JSON.stringify({ aptName, dongCode, deals: aptDeals }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )

  context.waitUntil(cache.put(cacheKey, response.clone()))
  return response
}
```

- [ ] **Step 2: .dev.vars에 실제 키 입력**

`C:\Users\skh96\OneDrive\boodongsan\.dev.vars` 파일 열어서
`MOLIT_API_KEY=` 뒤에 발급받은 API 키 입력 후 저장

- [ ] **Step 3: 로컬 테스트**

터미널 1 (Vite 개발 서버):
```bash
npm run dev
```

터미널 2 (Pages Functions):
```bash
npm run pages:dev
```

브라우저에서 확인 (포트는 wrangler가 출력하는 포트 사용, 보통 8788):
```
http://localhost:8788/api/search?dongCode=11680&aptName=래미안대치팰리스1차
```
Expected: JSON 응답 `{ aptName, dongCode, deals: [...] }`

- [ ] **Step 4: 커밋**

```bash
git add functions/
git commit -m "feat: add Pages Function API proxy for MOLIT real estate data"
```

---

## Task 5: CSS 추출 + 기존 파일 정리

**Files:**
- Create: `src/styles/excel.css`
- Modify: `src/App.css` (비움)
- Modify: `src/index.css` (비움)
- Modify: `src/main.tsx` (css import 변경)

**Interfaces:**
- Produces: 원본 HTML의 Excel 스타일 클래스 (`xl-*`, `cell`, `hcell`, `rnum`, `pct-*` 등)를 React에서 사용 가능한 CSS 파일

- [ ] **Step 1: 원본 HTML에서 CSS 추출**

`C:\Users\skh96\OneDrive\claude\index.html` 파일을 에디터로 열어서
`<style>` 태그 시작부터 `</style>` 태그까지의 내용을 전체 복사 →
`src/styles/excel.css` 파일에 붙여넣기 (태그 자체는 제외, CSS 내용만)

- [ ] **Step 2: src/App.css 내용 비우기**

`src/App.css` 파일 내용을 전부 삭제 (빈 파일로 만들기)

- [ ] **Step 3: src/index.css 내용 비우기**

`src/index.css` 파일 내용을 전부 삭제

- [ ] **Step 4: src/main.tsx에서 import 변경**

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/excel.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 5: 커밋**

```bash
git add src/styles/excel.css src/App.css src/index.css src/main.tsx
git commit -m "style: extract Excel CSS from original HTML design"
```

---

## Task 6: useAptSearch 훅 + ExcelShell + SearchBar

**Files:**
- Create: `src/hooks/useAptSearch.ts`
- Create: `src/components/ExcelShell.tsx`
- Create: `src/components/SearchBar.tsx`

**Interfaces:**
- Consumes:
  - `BjdongEntry[]` (bjdong.json)
  - `GET /api/search?dongCode&aptName` → `{ deals: RawDeal[] }`
  - `aggregateByArea(deals: RawDeal[]): AptUnit[]`
- Produces:
  - `useAptSearch()` → `{ search, results, loading, error }`
  - `<ExcelShell>` — 전체 레이아웃 (children으로 sheet content 받음)
  - `<SearchBar onSearch, bjdong>` — 자동완성 검색창

- [ ] **Step 1: src/hooks/useAptSearch.ts 생성**

```typescript
// src/hooks/useAptSearch.ts
import { useState, useCallback } from 'react'
import type { AptResult, RawDeal } from '../types'
import { aggregateByArea } from '../lib/aggregate'

interface SearchParams {
  dongCode: string
  aptName: string
}

interface SearchState {
  results: AptResult[]
  loading: boolean
  error: string | null
}

export function useAptSearch() {
  const [state, setState] = useState<SearchState>({
    results: [],
    loading: false,
    error: null,
  })

  const search = useCallback(async ({ dongCode, aptName }: SearchParams) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const res = await fetch(
        `/api/search?dongCode=${encodeURIComponent(dongCode)}&aptName=${encodeURIComponent(aptName)}`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { deals: RawDeal[] }
      const units = aggregateByArea(data.deals)
      const result: AptResult = { aptName, dongCode, units }
      setState(prev => ({
        results: [result, ...prev.results.filter(r => !(r.aptName === aptName && r.dongCode === dongCode))],
        loading: false,
        error: null,
      }))
    } catch (e) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : '조회 실패',
      }))
    }
  }, [])

  const removeResult = useCallback((aptName: string, dongCode: string) => {
    setState(prev => ({
      ...prev,
      results: prev.results.filter(r => !(r.aptName === aptName && r.dongCode === dongCode)),
    }))
  }, [])

  return { ...state, search, removeResult }
}
```

- [ ] **Step 2: src/components/ExcelShell.tsx 생성**

```tsx
// src/components/ExcelShell.tsx
import type { ReactNode } from 'react'

interface Tab {
  id: string
  label: string
}

interface Props {
  activeTab: string
  onTabChange: (id: string) => void
  children: ReactNode
  statusText?: string
  resultCount?: number
}

const TABS: Tab[] = [
  { id: 'home', label: '홈' },
  { id: 'region', label: '지역검색' },
]

export function ExcelShell({ activeTab, onTabChange, children, statusText, resultCount = 0 }: Props) {
  return (
    <div className="xl">
      {/* 타이틀바 */}
      <div id="xlTopScroll">
        <div id="xlTopInner">
          <div className="xl-title">
            <div className="xl-logo" />
            <div className="xl-qat">
              <span className="xl-autosave-lbl">부동산</span>
            </div>
            <div className="xl-title-text">아파트 실거래가 대시보드</div>
            <div className="xl-title-right" />
          </div>

          {/* 리본 탭 */}
          <div className="xl-rtabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`xl-rtab${activeTab === tab.id ? ' on' : ''}`}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 시트 영역 */}
      {children}

      {/* 시트 탭 */}
      <div className="xl-tabs">
        {TABS.map(tab => (
          <div
            key={tab.id}
            className={`xl-tab${activeTab === tab.id ? ' on' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {/* 상태바 */}
      <div className="xl-status">
        <span>{statusText ?? '아파트명을 검색하거나 지역을 선택하세요'}</span>
        <div className="sr">
          {resultCount > 0 && <span>조회 결과: {resultCount}개 단지</span>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: src/components/SearchBar.tsx 생성**

```tsx
// src/components/SearchBar.tsx
import { useState, useRef, useEffect } from 'react'
import type { BjdongEntry } from '../types'

interface Props {
  bjdong: BjdongEntry[]
  onSearch: (dongCode: string, aptName: string) => void
  loading: boolean
}

export function SearchBar({ bjdong, onSearch, loading }: Props) {
  const [query, setQuery] = useState('')
  const [aptName, setAptName] = useState('')
  const [suggestions, setSuggestions] = useState<BjdongEntry[]>([])
  const [selected, setSelected] = useState<BjdongEntry | null>(null)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (query.length < 1) { setSuggestions([]); return }
    const q = query.trim().toLowerCase()
    setSuggestions(bjdong.filter(e => e.fullNm.includes(q) || e.emdNm.includes(q)).slice(0, 8))
  }, [query, bjdong])

  const handleSelect = (entry: BjdongEntry) => {
    setSelected(entry)
    setQuery(entry.fullNm)
    setSuggestions([])
    setActiveIdx(-1)
  }

  const handleSubmit = () => {
    if (!selected || !aptName.trim()) return
    onSearch(selected.code, aptName.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    else if (e.key === 'ArrowUp') setActiveIdx(i => Math.max(i - 1, -1))
    else if (e.key === 'Enter' && activeIdx >= 0) handleSelect(suggestions[activeIdx])
    else if (e.key === 'Enter') handleSubmit()
  }

  return (
    <>
      {/* 데스크톱: Formula Bar */}
      <div className="xl-fbar">
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, position: 'relative' }}>
          <input
            ref={inputRef}
            className="xl-finput"
            style={{ width: 240, borderRight: '1px solid #d7d7d7' }}
            placeholder="동 검색 (예: 대치동)"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null) }}
            onKeyDown={handleKeyDown}
          />
          <input
            className="xl-finput"
            placeholder="아파트명 입력 (예: 래미안대치팰리스1차)"
            value={aptName}
            onChange={e => setAptName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          {suggestions.length > 0 && (
            <div className="autocomplete-list" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 100, width: 280 }}>
              {suggestions.map((s, i) => (
                <div
                  key={s.fullNm}
                  className={`autocomplete-item${i === activeIdx ? ' active' : ''}`}
                  onClick={() => handleSelect(s)}
                >
                  <span className="ac-symbol">{s.emdNm}</span>
                  <span className="ac-name">{s.sidoNm} {s.sigunguNm}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          className="xl-addbtn"
          onClick={handleSubmit}
          disabled={!selected || !aptName.trim() || loading}
        >
          {loading ? '조회중…' : '조회'}
        </button>
      </div>

      {/* 모바일 헤더 */}
      <div id="mobileHeader">
        <div className="mob-row1">
          <span className="mob-title">🏢 아파트 실거래가</span>
        </div>
        <div className="mob-row2">
          <input
            placeholder="동 검색"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(null) }}
          />
          <input
            placeholder="아파트명"
            value={aptName}
            onChange={e => setAptName(e.target.value)}
          />
          <button className="mob-addbtn" onClick={handleSubmit} disabled={!selected || !aptName.trim() || loading}>
            {loading ? '…' : '조회'}
          </button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 4: 커밋**

```bash
git add src/hooks/useAptSearch.ts src/components/ExcelShell.tsx src/components/SearchBar.tsx
git commit -m "feat: add useAptSearch hook, ExcelShell layout, SearchBar with autocomplete"
```

---

## Task 7: AptTable 컴포넌트

**Files:**
- Create: `src/components/AptTable.tsx`

**Interfaces:**
- Consumes: `results: AptResult[]`, `onRemove: (aptName, dongCode) => void`
- Produces: Excel 스타일 스프레드시트 테이블 (단지별 행, 클릭 시 면적별 하위 행 펼치기)

- [ ] **Step 1: src/components/AptTable.tsx 생성**

```tsx
// src/components/AptTable.tsx
import { useState } from 'react'
import type { AptResult, AptUnit } from '../types'

interface Props {
  results: AptResult[]
  onRemove: (aptName: string, dongCode: string) => void
}

function formatPrice(manwon: number): string {
  if (manwon >= 10000) {
    const eok = Math.floor(manwon / 10000)
    const rem = manwon % 10000
    return rem > 0 ? `${eok}억 ${rem.toLocaleString()}` : `${eok}억`
  }
  return `${manwon.toLocaleString()}만`
}

function ChangeCell({ rate }: { rate: number }) {
  const sign = rate >= 0 ? '+' : ''
  const cls = rate >= 0 ? 'pct-p' : 'pct-n'
  const barWidth = Math.min(Math.abs(rate), 100)
  return (
    <td className={`cell r bc ${cls}`}>
      <div className="pct-wrap">
        <div className="pct-top">{sign}{rate.toFixed(1)}%</div>
        <div className="pct-bot">
          <div className="pct-bar" style={{ width: `${barWidth}%` }} />
        </div>
      </div>
    </td>
  )
}

function UnitRow({ unit, rowNum }: { unit: AptUnit; rowNum: number }) {
  return (
    <tr className="srow">
      <td className="rnum">{rowNum}</td>
      <td className="cell" style={{ paddingLeft: 24 }}>{unit.area}㎡</td>
      <td className="cell r">
        <div>{formatPrice(unit.lastDeal.price)}</div>
        <div className="ext-row">{unit.lastDeal.date}</div>
      </td>
      <td className="cell r">{formatPrice(unit.avg3m)}</td>
      <td className="cell r">
        <div>{formatPrice(unit.allTimeHigh.price)}</div>
        <div className="ext-row">{unit.allTimeHigh.date}</div>
      </td>
      <ChangeCell rate={unit.changeRate} />
      <td className="cell r">{unit.dealCount3m}건</td>
      <td className="cell" />
    </tr>
  )
}

function AptRow({
  result,
  rowNum,
  expanded,
  onToggle,
  onRemove,
}: {
  result: AptResult
  rowNum: number
  expanded: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  const summary = result.units[0]
  return (
    <tr className="srow" style={{ cursor: 'pointer' }} onClick={onToggle}>
      <td className="rnum">{rowNum}</td>
      <td className="cell tick co-cell">
        <span style={{ marginRight: 4 }}>{expanded ? '▾' : '▸'}</span>
        {result.aptName}
        <div className="ext-row">{result.dongCode}</div>
      </td>
      {summary ? (
        <>
          <td className="cell r">{formatPrice(summary.lastDeal.price)}<div className="ext-row">{summary.lastDeal.date}</div></td>
          <td className="cell r">{formatPrice(summary.avg3m)}</td>
          <td className="cell r">{formatPrice(summary.allTimeHigh.price)}<div className="ext-row">{summary.allTimeHigh.date}</div></td>
          <ChangeCell rate={summary.changeRate} />
          <td className="cell r">{result.units.reduce((s, u) => s + u.dealCount3m, 0)}건</td>
        </>
      ) : (
        <td className="cell er" colSpan={5}>거래 데이터 없음</td>
      )}
      <td className="cell">
        <button className="del" onClick={e => { e.stopPropagation(); onRemove() }}>삭제</button>
      </td>
    </tr>
  )
}

export function AptTable({ results, onRemove }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  let globalRow = 1

  return (
    <div className="xl-sheet">
      <table className="xl-table" style={{ width: '100%' }}>
        <colgroup>
          <col style={{ width: 38 }} />
          <col style={{ width: 200 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 130 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 70 }} />
        </colgroup>
        <thead>
          <tr className="hdr-row">
            <td className="rnum" />
            <td className="cell">아파트명</td>
            <td className="cell r">최근 거래가</td>
            <td className="cell r">3개월 평균</td>
            <td className="cell r">역대 최고가</td>
            <td className="cell r">최고가 대비</td>
            <td className="cell r">3개월 건수</td>
            <td className="cell" />
          </tr>
        </thead>
        <tbody>
          {results.length === 0 && (
            <tr className="erow">
              <td className="rnum">1</td>
              <td className="cell ld" colSpan={7}>아파트명을 검색하면 여기에 결과가 표시됩니다</td>
            </tr>
          )}
          {results.map(result => {
            const key = `${result.dongCode}-${result.aptName}`
            const isExpanded = expanded.has(key)
            const aptRowNum = globalRow++
            const unitRows = isExpanded ? result.units : []
            unitRows.forEach(() => globalRow++)
            return (
              <>
                <AptRow
                  key={key}
                  result={result}
                  rowNum={aptRowNum}
                  expanded={isExpanded}
                  onToggle={() => toggle(key)}
                  onRemove={() => onRemove(result.aptName, result.dongCode)}
                />
                {isExpanded && result.units.map((unit, i) => (
                  <UnitRow
                    key={`${key}-${unit.area}`}
                    unit={unit}
                    rowNum={aptRowNum + i + 1}
                  />
                ))}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/AptTable.tsx
git commit -m "feat: add AptTable spreadsheet component with expand/collapse"
```

---

## Task 8: RegionSearch 컴포넌트

**Files:**
- Create: `src/components/RegionSearch.tsx`

**Interfaces:**
- Consumes: `bjdong: BjdongEntry[]`, `onSearch: (dongCode, aptName) => void`, `loading: boolean`
- Produces: 시도 → 시군구 → 읍면동 드롭다운, 아파트명 입력 후 조회 버튼

- [ ] **Step 1: src/components/RegionSearch.tsx 생성**

```tsx
// src/components/RegionSearch.tsx
import { useState, useMemo } from 'react'
import type { BjdongEntry } from '../types'

interface Props {
  bjdong: BjdongEntry[]
  onSearch: (dongCode: string, aptName: string) => void
  loading: boolean
}

export function RegionSearch({ bjdong, onSearch, loading }: Props) {
  const [sido, setSido] = useState('')
  const [sigungu, setSigungu] = useState('')
  const [emd, setEmd] = useState('')
  const [aptName, setAptName] = useState('')

  const sidos = useMemo(() => [...new Set(bjdong.map(e => e.sidoNm))].sort(), [bjdong])
  const sigungus = useMemo(
    () => [...new Set(bjdong.filter(e => e.sidoNm === sido).map(e => e.sigunguNm))].sort(),
    [bjdong, sido],
  )
  const emds = useMemo(
    () => bjdong.filter(e => e.sidoNm === sido && e.sigunguNm === sigungu),
    [bjdong, sido, sigungu],
  )

  const selectedEntry = emds.find(e => e.emdNm === emd)

  const handleSearch = () => {
    if (!selectedEntry || !aptName.trim()) return
    onSearch(selectedEntry.code, aptName.trim())
  }

  return (
    <div className="xl-sheet" style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1a5c2e' }}>지역으로 아파트 검색</h2>

        <div style={{ display: 'flex', gap: 8 }}>
          <select className="rsel wide" value={sido} onChange={e => { setSido(e.target.value); setSigungu(''); setEmd('') }}>
            <option value="">시/도 선택</option>
            {sidos.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select className="rsel wide" value={sigungu} onChange={e => { setSigungu(e.target.value); setEmd('') }} disabled={!sido}>
            <option value="">시/군/구 선택</option>
            {sigungus.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select className="rsel wide" value={emd} onChange={e => setEmd(e.target.value)} disabled={!sigungu}>
            <option value="">읍/면/동 선택</option>
            {emds.map(e => <option key={e.emdNm} value={e.emdNm}>{e.emdNm}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="xl-finput"
            style={{ flex: 1, border: '1px solid #d0d0d0', borderRadius: 2, padding: '0 8px', height: 28 }}
            placeholder="아파트명 입력 (예: 래미안)"
            value={aptName}
            onChange={e => setAptName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button
            className="xl-addbtn"
            style={{ padding: '0 16px' }}
            onClick={handleSearch}
            disabled={!selectedEntry || !aptName.trim() || loading}
          >
            {loading ? '조회중…' : '조회'}
          </button>
        </div>

        {selectedEntry && (
          <div style={{ fontSize: 12, color: '#666' }}>
            선택된 지역: <strong>{selectedEntry.fullNm}</strong> (코드: {selectedEntry.code})
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/RegionSearch.tsx
git commit -m "feat: add RegionSearch component with cascading dropdowns"
```

---

## Task 9: App.tsx 조립 + 모바일 반응형

**Files:**
- Modify: `src/App.tsx` (전체 교체)

**Interfaces:**
- Consumes: 모든 컴포넌트 + hooks + bjdong.json
- Produces: 완성된 앱

- [ ] **Step 1: src/App.tsx 전체 교체**

```tsx
// src/App.tsx
import { useState } from 'react'
import bjdongData from './data/bjdong.json'
import type { BjdongEntry } from './types'
import { ExcelShell } from './components/ExcelShell'
import { SearchBar } from './components/SearchBar'
import { AptTable } from './components/AptTable'
import { RegionSearch } from './components/RegionSearch'
import { useAptSearch } from './hooks/useAptSearch'

const bjdong = bjdongData as BjdongEntry[]

export default function App() {
  const [activeTab, setActiveTab] = useState('home')
  const { results, loading, error, search, removeResult } = useAptSearch()

  return (
    <ExcelShell
      activeTab={activeTab}
      onTabChange={setActiveTab}
      resultCount={results.length}
      statusText={
        loading ? '데이터 조회중… (전체 기간 최초 조회는 20~40초 소요)' :
        error ? `오류: ${error}` :
        undefined
      }
    >
      {activeTab === 'home' && (
        <>
          <SearchBar bjdong={bjdong} onSearch={search} loading={loading} />
          <AptTable results={results} onRemove={removeResult} />
        </>
      )}
      {activeTab === 'region' && (
        <>
          <RegionSearch bjdong={bjdong} onSearch={(code, name) => { search({ dongCode: code, aptName: name }); setActiveTab('home') }} loading={loading} />
        </>
      )}
    </ExcelShell>
  )
}
```

- [ ] **Step 2: 앱 빌드 확인**

```bash
npm run build
```
Expected: `dist/` 폴더 생성, 오류 없음

- [ ] **Step 3: 로컬 전체 동작 확인**

```bash
npm run dev
```
브라우저 `http://localhost:5173` 에서:
1. 동 검색창에 "대치동" 입력 → 자동완성 확인
2. 아파트명 "래미안대치팰리스1차" 입력 → 조회 버튼 클릭
3. 테이블에 결과 표시 확인
4. 행 클릭 시 면적별 하위 행 펼치기 확인
5. 지역검색 탭 전환 확인

- [ ] **Step 4: Pages Functions 포함 통합 테스트**

```bash
npm run pages:dev
```
`http://localhost:8788` 에서 동일 동작 확인

- [ ] **Step 5: Cloudflare 환경변수 설정**

Cloudflare 대시보드 → Pages → boodongsan → 설정 → 환경 변수:
- 변수명: `MOLIT_API_KEY`
- 값: 발급받은 API 키
- 프로덕션 + 프리뷰 모두 설정

- [ ] **Step 6: 배포**

```bash
git add src/App.tsx
git commit -m "feat: wire up full app with all components"
git push origin main
```
Cloudflare Pages가 자동으로 빌드 + 배포 시작

- [ ] **Step 7: 배포된 사이트 확인**

`https://boodongsan.pages.dev` 에서 동작 확인

---

## 자기 검토 (Spec Coverage)

| 요구사항 | 구현 태스크 |
|---|---|
| 아파트명 직접 검색 | Task 6 (SearchBar) |
| 지역 드롭다운 검색 | Task 8 (RegionSearch) |
| 최근 실거래가 | Task 2 (aggregate.ts) + Task 7 (AptTable) |
| 3개월 평균가 | Task 2 + Task 7 |
| 역대 최고가 (2006~) | Task 2 + Task 7 |
| 최고가 대비 등락률 + 바 차트 | Task 2 + Task 7 |
| 단지 단위 + 면적별 펼치기 | Task 7 |
| API 키 서버 측 보호 | Task 4 (Pages Function) |
| 24시간 캐싱 | Task 4 |
| Excel UI 디자인 재활용 | Task 5 + Task 6 + Task 7 |
| 모바일 가로 스크롤 테이블 | CSS (excel.css) |
| 호가 없음 | ✓ (의도적으로 제외) |
