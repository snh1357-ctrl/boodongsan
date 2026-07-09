// functions/api/_cache.ts
// KV 앞단에 Cloudflare Cache API(caches.default)를 두는 공용 캐시 레이어.
//
//   Cache API : 과금·일일 한도가 없음(사실상 무제한). 단 엣지(데이터센터)별·휘발성.
//   KV        : 전역·영구. 단 무료 플랜은 쓰기 1,000/일·읽기 100,000/일 한도.
//
// 조회를 Cache API → KV 순으로 하고 KV 히트를 Cache API로 승격시키면,
// 반복 조회가 KV를 거의 건드리지 않아 KV 한도 소모가 급감한다.
// (콜드 데이터일 때만 KV 쓰기가 1회 발생)

const CACHE_ORIGIN = 'https://apt-cache.internal/'
const YEAR = 31536000  // 영구 캐시용 max-age (1년) — 사실상 무기한

// caches.default는 표준 lib 타입에 없어 캐스팅으로 얻는다.
export function edgeCache(): Cache {
  return (caches as unknown as { default: Cache }).default
}

function req(key: string): Request {
  return new Request(CACHE_ORIGIN + encodeURIComponent(key))
}

function body(raw: string, ttl: number | undefined): Response {
  return new Response(raw, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${ttl ?? YEAR}`,
    },
  })
}

// Cache API → KV 순으로 조회. 히트 시 파싱값을, 미스면 null.
// KV 히트는 Cache API로 승격해 다음 조회부터 KV를 건드리지 않게 한다.
// ttl: 승격 시 Cache API 항목의 max-age (undefined = 영구).
export async function cacheGet<T>(
  cache: Cache,
  kv: KVNamespace | undefined,
  key: string,
  ttl: number | undefined,
  waitUntil: (p: Promise<unknown>) => void,
): Promise<T | null> {
  const hit = await cache.match(req(key))
  if (hit) {
    try { return (await hit.json()) as T } catch { /* 손상 캐시는 무시하고 아래로 */ }
  }
  if (kv) {
    const raw = await kv.get(key)  // 문자열로 받아 Cache API 저장에 그대로 재사용
    if (raw !== null) {
      waitUntil(cache.put(req(key), body(raw, ttl)))
      try { return JSON.parse(raw) as T } catch { return null }
    }
  }
  return null
}

// Cache API와 KV에 함께 저장. ttl 미지정 = 영구(과거 확정 데이터).
export function cachePut(
  cache: Cache,
  kv: KVNamespace | undefined,
  key: string,
  value: unknown,
  ttl: number | undefined,
  waitUntil: (p: Promise<unknown>) => void,
): void {
  const raw = JSON.stringify(value)
  waitUntil(cache.put(req(key), body(raw, ttl)))
  if (kv) {
    const opts = ttl ? { expirationTtl: ttl } : undefined
    waitUntil(kv.put(key, raw, opts).catch(() => {}))
  }
}
