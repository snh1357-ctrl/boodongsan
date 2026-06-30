// functions/api/search.ts
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
        items.push({
          aptNm:       getXml(x, 'aptNm'),
          excluUseAr:  getXml(x, 'excluUseAr'),
          dealAmount:  getXml(x, 'dealAmount').replace(/,/g, ''),
          dealYear:    getXml(x, 'dealYear'),
          dealMonth:   getXml(x, 'dealMonth'),
          dealDay:     getXml(x, 'dealDay'),
          floor:       getXml(x, 'floor'),
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
): Promise<MolitItem[]> {
  const cacheKey = `m:${dongCode}:${ym}`

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
    // 저장은 응답 후 비동기로 (latency 추가 없음)
    kv.put(cacheKey, JSON.stringify(data), opts).catch(() => {})
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
    months.map(ym => getMonthData(kv, context.env.MOLIT_API_KEY, dongCode, ym))
  )
  const allDeals = results.flat()

  // 이름 정규화: 공백·"아파트" 접미사·괄호 반복 표기 제거
  // MOLIT은 "래미안퍼스티지(래미안퍼스티지)" 같은 형식 사용
  const normalize = (s: string) =>
    s.replace(/\s/g, '')
     .replace(/\([^)]*\)/g, '')   // (괄호 내용) 제거
     .replace(/아파트$/, '')
     .toLowerCase()

  const normTarget = normalize(aptName)

  // MOLIT 이름에서 뒤쪽 차수/단지 번호 제거한 기본명
  // 예: "현대1차" → "현대", "신현대2단지" → "신현대"
  const stripSuffix = (s: string) => s.replace(/\d+[차단지동블럭호]?$/, '').replace(/\d+$/, '')

  const aptDeals = allDeals.filter(d => {
    const n = normalize(d.aptNm ?? '')
    if (!n) return false
    if (n === normTarget) return true
    if (n.includes(normTarget)) return true           // MOLIT이 뒤에 접미사 추가 (예: "1단지")
    if (n.length >= 3 && normTarget.includes(n)) return true   // MOLIT이 지역명 없이 저장 (예: "신현대")
    // 차수 번호 제거 후 지역명 접두사 없이 저장된 경우 (예: "현대1차" → "현대", "압구정현대".endsWith("현대"))
    const nBase = stripSuffix(n)
    if (nBase.length >= 2 && normTarget.endsWith(nBase)) return true
    return false
  })

  return new Response(
    JSON.stringify({ aptName, dongCode, deals: aptDeals }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  )
}
