// functions/api/search.ts
interface Env { MOLIT_API_KEY: string }

interface MolitItem {
  aptNm: string
  excluUseAr: string
  dealAmount: string
  dealYear: string
  dealMonth: string
  dealDay: string
  floor: string
}

const BASE_URL = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade'

function generateMonths(fromYear: number): string[] {
  const months: string[] = []
  const now = new Date()
  let y = fromYear, m = 1
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
    months.push(`${y}${String(m).padStart(2, '0')}`)
    if (++m > 12) { m = 1; y++ }
  }
  return months
}

function getXml(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`))
  return m ? m[1].trim() : ''
}

async function fetchMonth(apiKey: string, dongCode: string, ym: string): Promise<MolitItem[]> {
  try {
    const url = `${BASE_URL}?serviceKey=${apiKey}&LAWD_CD=${dongCode}&DEAL_YMD=${ym}&numOfRows=1000&pageNo=1`
    const res = await fetch(url)
    if (!res.ok) return []
    const text = await res.text()

    const parse = (t: string): MolitItem[] => {
      const items: MolitItem[] = []
      for (const m of t.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const x = m[1]
        items.push({
          aptNm: getXml(x, 'aptNm'),
          excluUseAr: getXml(x, 'excluUseAr'),
          dealAmount: getXml(x, 'dealAmount').replace(/,/g, ''),
          dealYear: getXml(x, 'dealYear'),
          dealMonth: getXml(x, 'dealMonth'),
          dealDay: getXml(x, 'dealDay'),
          floor: getXml(x, 'floor'),
        })
      }
      return items
    }

    const items = parse(text)
    const totalCount = parseInt(getXml(text, 'totalCount') || '0')
    const totalPages = Math.ceil(totalCount / 1000)

    if (totalPages <= 1) return items

    const extras = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        fetch(`${BASE_URL}?serviceKey=${apiKey}&LAWD_CD=${dongCode}&DEAL_YMD=${ym}&numOfRows=1000&pageNo=${i + 2}`)
          .then(r => r.text()).then(parse).catch(() => [] as MolitItem[])
      )
    )
    return [...items, ...extras.flat()]
  } catch {
    return []
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const dongCode  = url.searchParams.get('dongCode')
  const aptName   = url.searchParams.get('aptName')
  const fromYear  = parseInt(url.searchParams.get('fromYear') || '2022')
  const toYear    = parseInt(url.searchParams.get('toYear')   || String(new Date().getFullYear()))

  if (!dongCode || !aptName) {
    return new Response(JSON.stringify({ error: 'dongCode and aptName required' }), { status: 400 })
  }

  // 요청 연도 범위 내 월 목록 (최대 45개 = 서브요청 50개 안전 마진)
  const months = generateMonths(fromYear)
    .filter(ym => parseInt(ym.slice(0, 4)) <= toYear)
    .slice(-45)

  const results = await Promise.all(months.map(ym => fetchMonth(context.env.MOLIT_API_KEY, dongCode, ym)))
  const allDeals = results.flat()

  // MOLIT API는 "아파트" 접미사 없이 저장하는 경우 많음 → 양쪽 제거 후 비교 + 부분 매칭 폴백
  const normalize = (s: string) => s.replace(/\s/g, '').replace(/아파트$/, '').toLowerCase()
  const normTarget = normalize(aptName)
  const aptDeals = allDeals.filter(d => {
    const n = normalize(d.aptNm ?? '')
    return n === normTarget || n.includes(normTarget) || normTarget.includes(n)
  })

  const foundNames = [...new Set(allDeals.map(d => d.aptNm).filter(Boolean))].slice(0, 30)

  return new Response(
    JSON.stringify({ aptName, dongCode, deals: aptDeals, debug: { total: allDeals.length, months: months.length, foundNames } }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  )
}
