// functions/api/apt-list.ts
// 특정 동의 아파트 목록 반환 (최근 6개월 거래 기준)

interface Env { MOLIT_API_KEY: string }

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const dongCode = url.searchParams.get('dongCode') ?? ''
  if (!dongCode) return new Response('missing dongCode', { status: 400 })

  const cacheKey = new Request(`https://cache/apt-list/v1/${dongCode}`)
  const cache = (caches as any).default as Cache
  const cached = await cache.match(cacheKey)
  if (cached) return cached

  // 최근 6개월
  const months: string[] = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const names = new Set<string>()
  await Promise.all(months.map(async ym => {
    const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade?serviceKey=${env.MOLIT_API_KEY}&LAWD_CD=${dongCode}&DEAL_YMD=${ym}&numOfRows=1000&pageNo=1`
    try {
      const res = await fetch(url)
      const text = await res.text()
      for (const m of text.matchAll(/<aptNm>([^<]+)<\/aptNm>/g)) {
        names.add(m[1].trim())
      }
    } catch {}
  }))

  const body = JSON.stringify([...names].sort((a, b) => a.localeCompare(b, 'ko')))
  const response = new Response(body, {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=86400' }
  })
  await cache.put(cacheKey, response.clone())
  return response
}
