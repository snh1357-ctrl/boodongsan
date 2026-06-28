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

const BASE_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade'

function molitUrl(apiKey: string, dongCode: string, ym: string, page: number): string {
  // serviceKey는 이미 인코딩된 키이므로 직접 붙임 (URLSearchParams 사용 시 이중인코딩 발생)
  return `${BASE_URL}?serviceKey=${apiKey}&LAWD_CD=${dongCode}&DEAL_YMD=${ym}&numOfRows=1000&pageNo=${page}&_type=json`
}

async function fetchMonth(apiKey: string, dongCode: string, ym: string): Promise<MolitItem[]> {
  try {
    const res = await fetch(molitUrl(apiKey, dongCode, ym, 1))
    if (!res.ok) return []
    const data = await res.json() as any
    const body = data?.response?.body
    if (!body) return []

    const items = body.items?.item
    const firstPage: MolitItem[] = !items ? [] : Array.isArray(items) ? items : [items]

    const totalCount: number = body.totalCount ?? 0
    const totalPages = Math.ceil(totalCount / 1000)

    if (totalPages <= 1) return firstPage

    const pagePromises = Array.from({ length: totalPages - 1 }, (_, i) =>
      fetch(molitUrl(apiKey, dongCode, ym, i + 2))
        .then(r => r.ok ? r.json() : null)
        .then((d: any) => {
          const it = d?.response?.body?.items?.item
          if (!it) return [] as MolitItem[]
          return (Array.isArray(it) ? it : [it]) as MolitItem[]
        })
        .catch(() => [] as MolitItem[])
    )
    const rest = await Promise.all(pagePromises)
    return [...firstPage, ...rest.flat()]
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
  const cache = (caches as any).default as Cache
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
