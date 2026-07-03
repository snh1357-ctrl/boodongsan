// functions/api/search.ts
import { matchDeals } from './_match'
// KV 캐시 전략:
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

async function fetchMonthFromMolit(apiKey: string, dongCode: string, ym: string): Promise<MolitItem[]> {
  try {
    const base = `${BASE_URL}?serviceKey=${apiKey}&LAWD_CD=${dongCode}&DEAL_YMD=${ym}&numOfRows=1000`
    const res = await fetch(`${base}&pageNo=1`)
    if (!res.ok) return []
    const text = await res.text()

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

    if (totalPages <= 1) return items

    const extras = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        fetch(`${base}&pageNo=${i + 2}`).then(r => r.text()).then(parse).catch(() => [] as MolitItem[])
      )
    )
    return [...items, ...extras.flat()]
  } catch {
    return []
  }
}

async function getMonthData(
  kv: KVNamespace | undefined,
  apiKey: string,
  dongCode: string,
  ym: string,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<MolitItem[]> {
  const cacheKey = `m2:${dongCode}:${ym}`  // v2: 해제거래 필터 추가하며 캐시 무효화

  // KV 캐시 조회
  if (kv) {
    const cached = await kv.get<MolitItem[]>(cacheKey, 'json')
    if (cached !== null) return cached
  }

  // MOLIT API 호출
  const data = await fetchMonthFromMolit(apiKey, dongCode, ym)

  // KV에 저장
  if (kv) {
    const isCurrent = ym >= currentYm()
    // 당월: 1시간 TTL, 과거: 영구 저장 (변경 없는 확정 데이터)
    const opts = isCurrent ? { expirationTtl: 3600 } : undefined
    // waitUntil: 응답 반환 후에도 KV 쓰기가 완료되도록 보장 (캐시 유실 방지)
    waitUntil(kv.put(cacheKey, JSON.stringify(data), opts).catch(() => {}))
  }

  return data
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
  const months = generateMonths(fromYear, toYear).slice(-45)  // Worker 서브요청 50개 한도

  // 모든 월을 병렬로 조회 (캐시 히트 시 MOLIT API 호출 없음 → 즉시 응답)
  const results = await Promise.all(
    months.map(ym => getMonthData(kv, context.env.MOLIT_API_KEY, dongCode, ym, p => context.waitUntil(p)))
  )
  const allDeals = results.flat()

  const aptDeals = matchDeals(allDeals, aptName)

  // 진단용: debug=1 이면 이 동의 실제 단지명 목록도 함께 반환
  const body: Record<string, unknown> = { aptName, dongCode, deals: aptDeals }
  if (url.searchParams.get('debug') === '1') {
    body.names = [...new Set(allDeals.map(d => d.aptNm))].sort()
  }

  return new Response(
    JSON.stringify(body),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  )
}
