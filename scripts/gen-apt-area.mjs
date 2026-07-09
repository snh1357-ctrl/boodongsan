// scripts/gen-apt-area.mjs
// 네이버 부동산에서 단지별 "평형별 공급/전용면적"을 수집해 public/apt-area.json 생성.
//
// ⚠️ 반드시 "네이버 접속이 가능한 로컬 PC"에서 실행하세요.
//    (클라우드/CI, Cloudflare 환경은 네이버가 IP를 차단해 동작하지 않습니다.)
//
// 왜 필요한가:
//   국토부 실거래가 API는 전용면적만 주고, 공급면적/평형을 주는 공개 API가 없습니다.
//   앱은 공급면적을 전용률로 "추정"하는데 부정확합니다. 네이버 부동산은 평형별
//   공급/전용면적을 정확히 제공하므로, 이를 한 번(또는 주기적으로) 수집해 정적
//   JSON으로 저장하고 앱(src/lib/areaDb.ts)이 조회하도록 합니다.
//
// ── 사용법 (맥/윈도우 공통) ─────────────────────────────────────────
// 1) 크롬에서 https://new.land.naver.com 접속 → 아무 아파트 단지 하나 열기
// 2) F12(개발자도구) → 상단 Network 탭 → 왼쪽 목록에서 'complexes' 들어간
//    요청 클릭 → 오른쪽 Headers → Request Headers의
//    "authorization: Bearer eyJ..." 에서 값(Bearer 포함 전체)을 복사
// 3) scripts/naver-token.txt 파일을 만들어 그 값을 붙여넣고 저장
// 4) 터미널에서 실행 (처음엔 50개만 테스트):
//
//    npm run gen:area -- --limit 50
//
//    옵션:
//      --limit N     처리할 단지 수 (기본 전체) — 처음엔 작게 잡아 동작 확인 권장
//      --code 11680  특정 시군구코드만
//      --delay 400   요청 간 지연(ms, 기본 400) — 너무 빠르면 차단됩니다
//      --out PATH    출력 경로 (기본 public/apt-area.json)
//
// (환경변수 NAVER_AUTH 로 넣어도 됩니다. 파일보다 우선 적용)
//
// 중간 저장/재개: 기존 apt-area.json을 읽어 이어서 채웁니다(이미 수집된 단지는 건너뜀).
// Naver가 응답 구조를 바꾸면 SEARCH_URL/DETAIL_URL·필드 파싱을 조정하세요.
// ────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// ── CLI 파싱 ──
const args = process.argv.slice(2)
const getArg = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : def
}
const LIMIT = parseInt(getArg('limit', '0')) || Infinity
const ONLY_CODE = getArg('code', '')
const DELAY = parseInt(getArg('delay', '400'))
const OUT = resolve(root, getArg('out', 'public/apt-area.json'))

// 토큰 읽기: ① 환경변수 NAVER_AUTH, 없으면 ② scripts/naver-token.txt 파일
// (파일 방식이면 OS별 명령 차이가 없어 붙여넣기만 하면 됨. 이 파일은 .gitignore 처리)
const TOKEN_FILE = resolve(__dirname, 'naver-token.txt')
let AUTH = process.env.NAVER_AUTH || ''
if (!AUTH && existsSync(TOKEN_FILE)) AUTH = readFileSync(TOKEN_FILE, 'utf-8').trim()
if (AUTH && !/^Bearer /i.test(AUTH)) AUTH = `Bearer ${AUTH}`  // 'Bearer ' 빠뜨려도 보정
const COOKIE = process.env.NAVER_COOKIE || ''
if (!AUTH) {
  console.error('❌ 네이버 인증 토큰이 없습니다.')
  console.error('   방법: scripts/naver-token.txt 파일을 만들어 authorization 값을 붙여넣으세요.')
  console.error('   (크롬 F12 → Network 탭 → api/complexes 요청 → Request Headers의')
  console.error('    "authorization: Bearer eyJ..." 값 전체를 복사)')
  process.exit(1)
}

const HEADERS = {
  'authorization': AUTH,
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
  'referer': 'https://new.land.naver.com/',
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'ko-KR,ko;q=0.9',
  ...(COOKIE ? { cookie: COOKIE } : {}),
}

const SEARCH_URL = (kw) => `https://new.land.naver.com/api/search?keyword=${encodeURIComponent(kw)}`
const DETAIL_URL = (no) => `https://new.land.naver.com/api/complexes/${no}?sameAddressGroup=false`

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// 이름으로 검색해 complexNo 후보를 얻고, 법정동(emdNm)으로 최대한 일치시킴
async function resolveComplexNo(name, emdNm) {
  const data = await getJson(SEARCH_URL(name)).catch(() => null)
  if (!data) return null
  // 응답 구조는 버전에 따라 다를 수 있어 여러 경로를 방어적으로 탐색
  const list = data.complexes || data.complexList || data.result?.complexes || []
  if (!Array.isArray(list) || list.length === 0) return null
  const norm = (s) => String(s || '').replace(/\s/g, '')
  const dong = norm(emdNm).replace(/[동읍면리]$/, '')
  // 주소에 법정동이 포함된 후보 우선, 없으면 첫 후보
  const hit = list.find(c => norm(c.cortarAddress || c.address || c.roadAddress).includes(dong))
  const chosen = hit || list[0]
  return chosen?.complexNo || chosen?.complexNumber || chosen?.no || null
}

// 단지 상세 → 평형별 [{exclusiveArea, supplyArea}]
async function fetchAreas(complexNo) {
  const data = await getJson(DETAIL_URL(complexNo)).catch(() => null)
  if (!data) return null
  const detail = data.complexPyeongDetailList || data.complexDetail?.complexPyeongDetailList || []
  const out = []
  for (const p of detail) {
    const exclusiveArea = parseFloat(p.exclusiveArea ?? p.exclusiveSpace ?? p.전용면적)
    const supplyArea = parseFloat(p.supplyArea ?? p.supplySpace ?? p.공급면적)
    if (exclusiveArea > 0 && supplyArea > 0) out.push({ exclusiveArea, supplyArea })
  }
  return out.length > 0 ? out : null
}

// ── 실행 ──
const index = JSON.parse(readFileSync(resolve(root, 'public/apt-index.json'), 'utf-8'))
const db = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf-8')) : {}

let targets = index
if (ONLY_CODE) targets = targets.filter(a => a.code === ONLY_CODE)

let done = 0, ok = 0, fail = 0, skip = 0
for (const apt of targets) {
  if (done >= LIMIT) break
  const key = `${apt.code}|${apt.name}`
  if (db[key]) { skip++; continue }
  done++
  try {
    const no = await resolveComplexNo(apt.name, apt.emdNm)
    if (!no) { fail++; console.log(`  ✗ ${apt.name} (${apt.emdNm}) — 단지 못 찾음`); await sleep(DELAY); continue }
    const areas = await fetchAreas(no)
    if (!areas) { fail++; console.log(`  ✗ ${apt.name} — 면적 없음 (complexNo ${no})`); await sleep(DELAY); continue }
    db[key] = areas
    ok++
    console.log(`  ✓ ${apt.name} — ${areas.length}개 평형`)
  } catch (e) {
    fail++
    console.log(`  ✗ ${apt.name} — ${e.message}`)
    // 401/403이면 토큰 만료·차단 → 즉시 중단하고 지금까지 저장
    if (String(e.message).match(/40[13]/)) { console.error('⚠ 인증 만료 또는 차단. 토큰을 새로 발급받으세요.'); break }
  }
  // 주기적 저장(중단돼도 진행분 보존)
  if (ok % 20 === 0) writeFileSync(OUT, JSON.stringify(db))
  await sleep(DELAY)
}

writeFileSync(OUT, JSON.stringify(db))
console.log(`\n완료: 성공 ${ok} · 실패 ${fail} · 건너뜀(이미 있음) ${skip} → ${OUT}`)
console.log(`총 DB 단지 수: ${Object.keys(db).length}`)
