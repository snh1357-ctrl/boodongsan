// functions/api/rent.ts
import { matchDeals } from './_match'
import { edgeCache, cacheGet, cachePut } from './_cache'
// 아파트 전월세 실거래 조회 (RTMSDataSvcAptRent)
// 캐시: `r:{dongCode}:{ym}` — Cache API(무제한) → KV 2단, 과거 영구·당월 1시간 TTL

interface Env {
  MOLIT_API_KEY: string
  APT_CACHE: KVNamespace
}

interface RentItem {
  aptNm: string
  excluUseAr: string
  deposit: string      // 보증금 (만원, 쉼표 제거)
  monthlyRent: string  // 월세 (만원)
  dealYear: string
  dealMonth: string
  dealDay: string
}

const BASE_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent'

function currentYm(): string {
  const now = new Date()
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
}

function recentMonths(count: number): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function getXml(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`))
  return match ? match[1].trim() : ''
}

// MOLIT는 오류(호출 한도 초과 등)도 HTTP 200 + 오류 XML로 반환하므로 resultCode 검사 필수
function checkResultCode(text: string): string | null {
  const code = getXml(text, 'resultCode')
  if (code === '' || code === '00' || code === '000') return null
  return `${code} ${getXml(text, 'resultMsg')}`.trim()
}

function parseItems(text: string): RentItem[] {
  const items: RentItem[] = []
  for (const m of text.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const x = m[1]
    items.push({
      aptNm:       getXml(x, 'aptNm'),
      excluUseAr:  getXml(x, 'excluUseAr'),
      deposit:     getXml(x, 'deposit').replace(/,/g, ''),
      monthlyRent: getXml(x, 'monthlyRent').replace(/,/g, ''),
      dealYear:    getXml(x, 'dealYear'),
      dealMonth:   getXml(x, 'dealMonth'),
      dealDay:     getXml(x, 'dealDay'),
    })
  }
  return items
}

interface MonthResult { items: RentItem[] | null; error?: string }

async function fetchMonthFromMolit(apiKey: string, dongCode: string, ym: string): Promise<MonthResult> {
  try {
    const base = `${BASE_URL}?serviceKey=${apiKey}&LAWD_CD=${dongCode}&DEAL_YMD=${ym}&numOfRows=1000`
    const res = await fetch(`${base}&pageNo=1`)
    if (!res.ok) return { items: null, error: `HTTP ${res.status}` }
    const text = await res.text()
    const apiError = checkResultCode(text)
    if (apiError) return { items: null, error: apiError }
    const items = parseItems(text)
    const totalPages = Math.ceil(parseInt(getXml(text, 'totalCount') || '0') / 1000)
    if (totalPages <= 1) return { items }
    const extras = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        fetch(`${base}&pageNo=${i + 2}`).then(r => r.text()).then(t => {
          if (checkResultCode(t)) throw new Error('page error')
          return parseItems(t)
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
  const cacheKey = `r2:${dongCode}:${ym}`  // v2: API 오류 캐시 오염 수정하며 무효화
  const ttl = ym >= currentYm() ? 3600 : undefined
  const cached = await cacheGet<RentItem[]>(cache, kv, cacheKey, ttl, waitUntil)
  if (cached !== null) return { items: cached }
  const result = await fetchMonthFromMolit(apiKey, dongCode, ym)
  // 성공한 응답만 캐시 (실패를 빈 값으로 캐시하면 오염됨)
  if (result.items === null) return { items: [], error: result.error }
  cachePut(cache, kv, cacheKey, result.items, ttl, waitUntil)
  return { items: result.items }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url      = new URL(context.request.url)
  const dongCode = url.searchParams.get('dongCode')
  const aptName  = url.searchParams.get('aptName')
  // 서브요청 한도(월당 최대 3개) 때문에 12개월로 제한
  const months   = Math.min(parseInt(url.searchParams.get('months') || '12'), 12)

  if (!dongCode || !aptName) {
    return new Response(JSON.stringify({ error: 'dongCode and aptName required' }), { status: 400 })
  }

  const kv = context.env.APT_CACHE
  const cache = edgeCache()
  const results = await Promise.all(
    recentMonths(months).map(ym =>
      getMonthData(cache, kv, context.env.MOLIT_API_KEY, dongCode, ym, p => context.waitUntil(p))
    )
  )
  const allRents = results.flatMap(r => r.items ?? [])
  const apiError = results.find(r => r.error)?.error

  // search.ts와 동일한 단계적 이름 매칭 (공용 로직)
  const rents = matchDeals(allRents, aptName)

  // 전세가율이 안 보일 때 원인 파악용:
  //   apiError 있으면 → 전월세 API 미등록/호출한도 등 (매매와 별개 서비스라 활용신청 필요)
  //   apiError 없고 rents 0 → 실제 신고분 없음
  const body: Record<string, unknown> = { aptName, dongCode, rents }
  if (apiError) body.apiError = apiError
  if (url.searchParams.get('debug') === '1') {
    body.names = [...new Set(allRents.map(d => d.aptNm))].sort()
    body.totalRents = allRents.length
  }

  return new Response(
    JSON.stringify(body),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  )
}
