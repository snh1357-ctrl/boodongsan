// functions/api/rent.ts
import { matchDeals } from './_match'
// 아파트 전월세 실거래 조회 (RTMSDataSvcAptRent)
// KV 캐시: `r:{dongCode}:{ym}` — 과거 월 영구, 당월 1시간 TTL (search.ts와 동일 전략)

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

async function fetchMonthFromMolit(apiKey: string, dongCode: string, ym: string): Promise<RentItem[] | null> {
  try {
    const base = `${BASE_URL}?serviceKey=${apiKey}&LAWD_CD=${dongCode}&DEAL_YMD=${ym}&numOfRows=1000`
    const res = await fetch(`${base}&pageNo=1`)
    if (!res.ok) return null
    const text = await res.text()
    if (checkResultCode(text)) return null
    const items = parseItems(text)
    const totalPages = Math.ceil(parseInt(getXml(text, 'totalCount') || '0') / 1000)
    if (totalPages <= 1) return items
    const extras = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        fetch(`${base}&pageNo=${i + 2}`).then(r => r.text()).then(t => {
          if (checkResultCode(t)) throw new Error('page error')
          return parseItems(t)
        })
      )
    ).catch(() => null)
    if (extras === null) return null
    return [...items, ...extras.flat()]
  } catch {
    return null
  }
}

async function getMonthData(
  kv: KVNamespace | undefined,
  apiKey: string,
  dongCode: string,
  ym: string,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<RentItem[]> {
  const cacheKey = `r2:${dongCode}:${ym}`  // v2: API 오류 캐시 오염 수정하며 무효화
  if (kv) {
    const cached = await kv.get<RentItem[]>(cacheKey, 'json')
    if (cached !== null) return cached
  }
  const data = await fetchMonthFromMolit(apiKey, dongCode, ym)
  // 성공한 응답만 캐시 (실패를 빈 값으로 캐시하면 오염됨)
  if (data === null) return []
  if (kv) {
    const opts = ym >= currentYm() ? { expirationTtl: 3600 } : undefined
    waitUntil(kv.put(cacheKey, JSON.stringify(data), opts).catch(() => {}))
  }
  return data
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
  const results = await Promise.all(
    recentMonths(months).map(ym =>
      getMonthData(kv, context.env.MOLIT_API_KEY, dongCode, ym, p => context.waitUntil(p))
    )
  )
  const allRents = results.flat()

  // search.ts와 동일한 단계적 이름 매칭 (공용 로직)
  const rents = matchDeals(allRents, aptName)

  return new Response(
    JSON.stringify({ aptName, dongCode, rents }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  )
}
