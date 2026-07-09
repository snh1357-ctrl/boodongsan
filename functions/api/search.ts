// functions/api/search.ts
import { matchDeals } from './_match'
import { edgeCache, cacheGet, cachePut } from './_cache'
// 캐시 전략 (2단: Cache API → KV):
//   - Cache API(무제한)가 앞단, KV(전역·영구)가 뒷단 → 반복 조회는 KV 미접근
//   - 과거 월 데이터: 영구 캐시 (MOLIT 확정 데이터는 변경 없음)
//   - 당월 데이터: 1시간 TTL (신고 지연분 반영)
//   - 캐시 키: `m:{dongCode}:{ym}` → 같은 동의 모든 아파트가 공유

interface Env {
  MOLIT_API_KEY: string
  APT_CACHE: KVNamespace   // wrangler.toml 또는 Pages 대시보드에서 바인딩
}

interface MolitItem {
  aptNm: string
  excluUseAr: string
  dealAmount: string
  dealYear: string
  dealMonth: string
  dealDay: string
  floor: string
  buildYear: string
}

const BASE_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade'

function currentYm(): string {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
}

function generateMonths(fromYear: number, toYear: number): string[] {
  const months: string[] = []
  const now = new Date()
  const limitYm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  let y = fromYear, m = 1
  while (y <= toYear) {
    const ym = `${y}${String(m).padStart(2, '0')}`
    if (ym <= limitYm) months.push(ym)
    if (++m > 12) { m = 1; y++ }
  }
  return months
}

function getXml(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`))
  return match ? match[1].trim() : ''
}

interface MonthResult {
  items: MolitItem[] | null  // null = 조회 실패 (캐시 금지)
  error?: string
}

// MOLIT는 오류(호출 한도 초과 등)도 HTTP 200 + 오류 XML로 반환하므로
// resultCode를 반드시 검사해야 함. 실패는 '거래 0건'과 구분해 null로 반환.
function checkResultCode(text: string): string | null {
  const code = getXml(text, 'resultCode')
  if (code === '' || code === '00' || code === '000') return null
  return `${code} ${getXml(text, 'resultMsg')}`.trim()
}

async function fetchMonthFromMolit(apiKey: string, dongCode: string, ym: string): Promise<MonthResult> {
  try {
    const base = `${BASE_URL}?serviceKey=${apiKey}&LAWD_CD=${dongCode}&DEAL_YMD=${ym}&numOfRows=1000`
    const res = await fetch(`${base}&pageNo=1`)
    if (!res.ok) return { items: null, error: `HTTP ${res.status}` }
    const text = await res.text()

    const apiError = checkResultCode(text)
    if (apiError) return { items: null, error: apiError }

    const parse = (t: string): MolitItem[] => {
      const items: MolitItem[] = []
      for (const m of t.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const x = m[1]
        // 계약 해제(취소)된 거래 제외 — 매매 확정 건만 반영
        if (getXml(x, 'cdealType') === 'O') continue
        items.push({
          aptNm:       getXml(x, 'aptNm'),
          excluUseAr:  getXml(x, 'excluUseAr'),
          dealAmount:  getXml(x, 'dealAmount').replace(/,/g, ''),
          dealYear:    getXml(x, 'dealYear'),
          dealMonth:   getXml(x, 'dealMonth'),
          dealDay:     getXml(x, 'dealDay'),
          floor:       getXml(x, 'floor'),
          buildYear:   getXml(x, 'buildYear'),
        })
      }
      return items
    }

    const items = parse(text)
    const totalPages = Math.ceil(parseInt(getXml(text, 'totalCount') || '0') / 1000)

    if (totalPages <= 1) return { items }

    // 추가 페이지 실패 시 전체를 실패 처리 (부분 데이터 영구 캐시 방지)
    const extras = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        fetch(`${base}&pageNo=${i + 2}`).then(r => r.text()).then(t => {
          if (checkResultCode(t)) throw new Error('page error')
          return parse(t)
        })
      )
    ).catch(() => null)
    if (extras === null) return { items: null, error: 'pagination failed' }
    return { items: [...items, ...extras.flat()] }
  } catch (e) {
    return { items: null, error: e instanceof Error ? e.message : 'fetch failed' }
  }
}

async function getMonthData(
  cache: Cache,
  kv: KVNamespace | undefined,
  apiKey: string,
  dongCode: string,
  ym: string,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<MonthResult> {
  const cacheKey = `m3:${dongCode}:${ym}`  // v3: API 오류가 빈 값으로 캐시되던 문제 수정하며 무효화
  // 당월: 1시간 TTL, 과거: 영구 (변경 없는 확정 데이터)
  const ttl = ym >= currentYm() ? 3600 : undefined

  // Cache API → KV 순 조회 (히트 시 MOLIT 호출·KV 쓰기 없음)
  const cached = await cacheGet<MolitItem[]>(cache, kv, cacheKey, ttl, waitUntil)
  if (cached !== null) return { items: cached }

  // MOLIT API 호출
  const result = await fetchMonthFromMolit(apiKey, dongCode, ym)

  // 성공한 응답만 저장 (실패를 빈 값으로 캐시하면 이후 조회가 전부 오염됨)
  if (result.items !== null) {
    cachePut(cache, kv, cacheKey, result.items, ttl, waitUntil)
  }

  return result
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url      = new URL(context.request.url)
  const dongCode = url.searchParams.get('dongCode')
  const aptName  = url.searchParams.get('aptName')
  const fromYear = parseInt(url.searchParams.get('fromYear') || '2022')
  const toYear   = parseInt(url.searchParams.get('toYear')   || String(new Date().getFullYear()))

  if (!dongCode || !aptName) {
    return new Response(JSON.stringify({ error: 'dongCode and aptName required' }), { status: 400 })
  }

  const kv = context.env.APT_CACHE  // 바인딩 없으면 undefined
  const cache = edgeCache()
  // Cloudflare 무료 플랜 서브요청 50개/요청 한도:
  // 콜드 캐시 시 월당 최대 3 서브요청(KV get + fetch + KV put)이므로 12개월로 제한
  const months = generateMonths(fromYear, toYear).slice(-12)

  // 모든 월을 병렬로 조회 (캐시 히트 시 MOLIT API 호출 없음 → 즉시 응답)
  const results = await Promise.all(
    months.map(ym => getMonthData(cache, kv, context.env.MOLIT_API_KEY, dongCode, ym, p => context.waitUntil(p)))
  )
  const allDeals = results.flatMap(r => r.items ?? [])
  const apiError = results.find(r => r.error)?.error

  const aptDeals = matchDeals(allDeals, aptName)

  // 진단용: debug=1 이면 이 동의 실제 단지명 목록도 함께 반환
  const body: Record<string, unknown> = { aptName, dongCode, deals: aptDeals }
  if (apiError) body.apiError = apiError
  if (url.searchParams.get('debug') === '1') {
    body.names = [...new Set(allDeals.map(d => d.aptNm))].sort()
    body.monthsQueried = months
  }

  return new Response(
    JSON.stringify(body),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  )
}
