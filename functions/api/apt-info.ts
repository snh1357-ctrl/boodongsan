// functions/api/apt-info.ts
import { matchDeals } from './_match'
// 국토교통부 공동주택단지목록정보 API로 세대수·건축년도 조회
// 캐시 키: `aptlist:{sigunguCd}` → 시군구 전체 단지 목록, 24시간 TTL

interface Env {
  MOLIT_API_KEY: string
  APT_CACHE: KVNamespace
}

interface KaptItem {
  kaptCode: string   // 단지코드
  kaptName: string   // 단지명
}

// 시군구별 단지 목록 (kaptCode·kaptName만 제공; 세대수 등은 기본정보 API에서 조회)
const LIST_URL = 'https://apis.data.go.kr/1613000/AptListService2/getSigunguAptList'
const BASIS_URL = 'https://apis.data.go.kr/1613000/AptBasisInfoServiceV3/getAphusBassInfoV3'
const DETAIL_URL = 'https://apis.data.go.kr/1613000/AptBasisInfoServiceV3/getAphusDtlInfoV3'

function getXml(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`))
  return m ? m[1].trim() : ''
}

// MOLIT는 오류(호출 한도 초과 등)도 HTTP 200 + 오류 XML로 반환하므로 resultCode 검사 필수
function isApiError(text: string): boolean {
  const code = getXml(text, 'resultCode')
  return !(code === '' || code === '00' || code === '000')
}

interface BasisInfo {
  useDate: string | null        // 사용승인일 (YYYYMMDD)
  exclusiveRatio: number | null // 전용률 = 전용면적합(privArea) ÷ 관리비부과면적(kaptMarea)
  houseHoldCnt: number | null
  parkingPerHousehold: number | null // 세대당 주차대수 (지상+지하)
}

// K-apt 상세정보: 주차대수 (지상 kaptdPcnt + 지하 kaptdPcntu)
async function fetchParkingCnt(apiKey: string, kaptCode: string): Promise<number | null> {
  try {
    const res = await fetch(`${DETAIL_URL}?serviceKey=${apiKey}&kaptCode=${kaptCode}`)
    if (!res.ok) return null
    const text = await res.text()
    if (isApiError(text)) return null
    const ground = parseInt(getXml(text, 'kaptdPcnt')) || 0
    const under  = parseInt(getXml(text, 'kaptdPcntu')) || 0
    const total = ground + under
    return total > 0 ? total : null
  } catch {
    return null
  }
}

// K-apt 공동주택 기본정보: 사용승인일·관리비부과면적·전용면적합 → 전용률 계산
async function fetchBasisInfo(apiKey: string, kaptCode: string): Promise<BasisInfo | null> {
  try {
    const [res, parkingCnt] = await Promise.all([
      fetch(`${BASIS_URL}?serviceKey=${apiKey}&kaptCode=${kaptCode}`),
      fetchParkingCnt(apiKey, kaptCode),
    ])
    if (!res.ok) return null
    const text = await res.text()
    if (isApiError(text)) return null
    const marea = parseFloat(getXml(text, 'kaptMarea'))    // 관리비부과면적 ≈ 공급면적 합
    const priv  = parseFloat(getXml(text, 'privArea'))     // 전용면적 합
    let ratio: number | null = null
    if (marea > 0 && priv > 0) {
      const r = priv / marea
      // 비정상 데이터 방어 (일반 아파트 전용률 0.6~0.95 범위)
      if (r >= 0.55 && r <= 0.98) ratio = Math.round(r * 1000) / 1000
    }
    const houseHoldCnt = parseInt(getXml(text, 'kaptdaCnt')) || null
    return {
      useDate: getXml(text, 'kaptUsedate') || null,
      exclusiveRatio: ratio,
      houseHoldCnt,
      parkingPerHousehold: parkingCnt && houseHoldCnt
        ? Math.round((parkingCnt / houseHoldCnt) * 100) / 100
        : null,
    }
  } catch {
    return null
  }
}

function parseKaptItems(text: string): KaptItem[] {
  const items: KaptItem[] = []
  for (const m of text.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const x = m[1]
    items.push({
      kaptCode: getXml(x, 'kaptCode'),
      kaptName: getXml(x, 'kaptName'),
    })
  }
  return items
}

async function fetchAptList(apiKey: string, sigunguCd: string): Promise<KaptItem[]> {
  try {
    const base = `${LIST_URL}?serviceKey=${apiKey}&sigunguCode=${sigunguCd}&numOfRows=1000`
    const res = await fetch(`${base}&pageNo=1`)
    if (!res.ok) return []
    const text = await res.text()
    if (isApiError(text)) return []
    const items = parseKaptItems(text)

    // 페이지가 더 있으면 추가 조회
    const totalCount = parseInt(getXml(text, 'totalCount') || '0')
    const totalPages = Math.ceil(totalCount / 1000)
    if (totalPages > 1) {
      const extras = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, i) =>
          fetch(`${base}&pageNo=${i + 2}`)
            .then(r => r.text())
            .then(parseKaptItems)
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url     = new URL(context.request.url)
  const aptName = url.searchParams.get('aptName')     // MOLIT 기준 단지명
  const dongCode = url.searchParams.get('dongCode')   // 5자리 시군구코드

  if (!aptName || !dongCode) {
    return new Response(JSON.stringify({ error: 'aptName and dongCode required' }), { status: 400 })
  }

  const kv = context.env.APT_CACHE
  const cacheKey = `aptlist3:${dongCode}`  // v3: API 오류 캐시 오염 수정하며 무효화

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

  // 이름 매칭 (search.ts와 동일한 단계적 완화 매칭)
  const match = matchDeals(list.map(i => ({ ...i, aptNm: i.kaptName })), aptName)[0]

  if (!match) {
    return new Response(JSON.stringify({ aptName, found: false }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }

  // 기본정보(전용률·사용승인일) 조회 — kaptCode 단위로 30일 캐시
  let basis: BasisInfo | null = null
  const basisCacheKey = `basis3:${match.kaptCode}`  // v3: API 오류 캐시 오염 수정하며 무효화
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
      houseHoldCnt: basis?.houseHoldCnt ?? null,
      buildYear: basis?.useDate?.slice(0, 4) || null,
      useDate:   basis?.useDate ?? null,
      exclusiveRatio: basis?.exclusiveRatio ?? null,
      parkingPerHousehold: basis?.parkingPerHousehold ?? null,
    }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  )
}
