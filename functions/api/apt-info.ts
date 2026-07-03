// functions/api/apt-info.ts
// 국토교통부 공동주택단지목록정보 API로 세대수·건축년도 조회
// 캐시 키: `aptlist:{sigunguCd}` → 시군구 전체 단지 목록, 24시간 TTL

interface Env {
  MOLIT_API_KEY: string
  APT_CACHE: KVNamespace
}

interface KaptItem {
  kaptCode: string   // 단지코드
  kaptName: string   // 단지명
  kaptdaYyyy: string // 건축년도
  kaptdaCnt: string  // 세대수
  kaptdaDong: string // 동수
}

const LIST_URL = 'https://apis.data.go.kr/1613000/AptListService2/getAptList'
const BASIS_URL = 'https://apis.data.go.kr/1613000/AptBasisInfoServiceV3/getAphusBassInfoV3'

function getXml(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`))
  return m ? m[1].trim() : ''
}

interface BasisInfo {
  useDate: string | null        // 사용승인일 (YYYYMMDD)
  exclusiveRatio: number | null // 전용률 = 전용면적합(privArea) ÷ 관리비부과면적(kaptMarea)
  houseHoldCnt: number | null
}

// K-apt 공동주택 기본정보: 사용승인일·관리비부과면적·전용면적합 → 전용률 계산
async function fetchBasisInfo(apiKey: string, kaptCode: string): Promise<BasisInfo | null> {
  try {
    const res = await fetch(`${BASIS_URL}?serviceKey=${apiKey}&kaptCode=${kaptCode}`)
    if (!res.ok) return null
    const text = await res.text()
    const marea = parseFloat(getXml(text, 'kaptMarea'))    // 관리비부과면적 ≈ 공급면적 합
    const priv  = parseFloat(getXml(text, 'privArea'))     // 전용면적 합
    let ratio: number | null = null
    if (marea > 0 && priv > 0) {
      const r = priv / marea
      // 비정상 데이터 방어 (일반 아파트 전용률 0.6~0.95 범위)
      if (r >= 0.55 && r <= 0.98) ratio = Math.round(r * 1000) / 1000
    }
    return {
      useDate: getXml(text, 'kaptUsedate') || null,
      exclusiveRatio: ratio,
      houseHoldCnt: parseInt(getXml(text, 'kaptdaCnt')) || null,
    }
  } catch {
    return null
  }
}

async function fetchAptList(apiKey: string, sigunguCd: string): Promise<KaptItem[]> {
  try {
    const url = `${LIST_URL}?serviceKey=${apiKey}&sigunguCd=${sigunguCd}&numOfRows=1000&pageNo=1`
    const res = await fetch(url)
    if (!res.ok) return []
    const text = await res.text()

    const items: KaptItem[] = []
    for (const m of text.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1]
      items.push({
        kaptCode:   getXml(x, 'kaptCode'),
        kaptName:   getXml(x, 'kaptName'),
        kaptdaYyyy: getXml(x, 'kaptdaYyyy'),
        kaptdaCnt:  getXml(x, 'kaptdaCnt'),
        kaptdaDong: getXml(x, 'kaptdaDong'),
      })
    }

    // 페이지가 더 있으면 추가 조회
    const totalCount = parseInt(getXml(text, 'totalCount') || '0')
    const totalPages = Math.ceil(totalCount / 1000)
    if (totalPages > 1) {
      const extras = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fetch(`${url}&pageNo=${i + 2}`)
            .then(r => r.text())
            .then(t => {
              const list: KaptItem[] = []
              for (const m of t.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
                const x = m[1]
                list.push({
                  kaptCode:   getXml(x, 'kaptCode'),
                  kaptName:   getXml(x, 'kaptName'),
                  kaptdaYyyy: getXml(x, 'kaptdaYyyy'),
                  kaptdaCnt:  getXml(x, 'kaptdaCnt'),
                  kaptdaDong: getXml(x, 'kaptdaDong'),
                })
              }
              return list
            })
            .catch(() => [] as KaptItem[])
        )
      )
      items.push(...extras.flat())
    }

    return items
  } catch {
    return []
  }
}

function normalize(s: string) {
  return s.replace(/\s/g, '').replace(/\([^)]*\)/g, '').replace(/아파트$/, '').toLowerCase()
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url     = new URL(context.request.url)
  const aptName = url.searchParams.get('aptName')     // MOLIT 기준 단지명
  const dongCode = url.searchParams.get('dongCode')   // 5자리 시군구코드

  if (!aptName || !dongCode) {
    return new Response(JSON.stringify({ error: 'aptName and dongCode required' }), { status: 400 })
  }

  const kv = context.env.APT_CACHE
  const cacheKey = `aptlist:${dongCode}`

  // KV 캐시 조회 (24시간 TTL)
  let list: KaptItem[] | null = null
  if (kv) list = await kv.get<KaptItem[]>(cacheKey, 'json')

  if (!list) {
    list = await fetchAptList(context.env.MOLIT_API_KEY, dongCode)
    if (kv && list.length > 0) {
      // waitUntil: 응답 후에도 KV 쓰기가 중단되지 않도록 보장
      context.waitUntil(kv.put(cacheKey, JSON.stringify(list), { expirationTtl: 86400 }).catch(() => {}))
    }
  }

  // 이름 매칭
  const normTarget = normalize(aptName)
  const match = list.find(item => {
    const n = normalize(item.kaptName)
    return n === normTarget || n.includes(normTarget) || normTarget.includes(n)
  })

  if (!match) {
    return new Response(JSON.stringify({ aptName, found: false }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  // 기본정보(전용률·사용승인일) 조회 — kaptCode 단위로 30일 캐시
  let basis: BasisInfo | null = null
  const basisCacheKey = `basis:${match.kaptCode}`
  if (kv) basis = await kv.get<BasisInfo>(basisCacheKey, 'json')
  if (!basis) {
    basis = await fetchBasisInfo(context.env.MOLIT_API_KEY, match.kaptCode)
    if (kv && basis) {
      context.waitUntil(kv.put(basisCacheKey, JSON.stringify(basis), { expirationTtl: 86400 * 30 }).catch(() => {}))
    }
  }

  return new Response(
    JSON.stringify({
      aptName,
      found: true,
      kaptCode:  match.kaptCode,
      kaptName:  match.kaptName,
      houseHoldCnt: parseInt(match.kaptdaCnt) || basis?.houseHoldCnt || null,
      buildYear: match.kaptdaYyyy || basis?.useDate?.slice(0, 4) || null,
      useDate:   basis?.useDate ?? null,
      exclusiveRatio: basis?.exclusiveRatio ?? null,
      dongCnt:   parseInt(match.kaptdaDong) || null,
    }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  )
}
