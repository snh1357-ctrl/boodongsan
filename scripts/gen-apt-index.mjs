// scripts/gen-apt-index.mjs
// 전국 아파트 단지 목록 API → public/apt-index.json 생성
// 실행 전: .dev.vars 에 실제 MOLIT_API_KEY 입력
// 실행: node scripts/gen-apt-index.mjs
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// .dev.vars에서 API 키 읽기
let apiKey = process.env.MOLIT_API_KEY
if (!apiKey) {
  try {
    const devVars = readFileSync(resolve(__dirname, '../.dev.vars'), 'utf-8')
    const match = devVars.match(/MOLIT_API_KEY=(.+)/)
    if (match) apiKey = match[1].trim()
  } catch {}
}
if (!apiKey || apiKey.includes('여기에')) {
  console.error('❌ .dev.vars 파일에 실제 MOLIT_API_KEY를 입력하세요')
  process.exit(1)
}

const bjdong = JSON.parse(readFileSync(resolve(__dirname, '../src/data/bjdong.json'), 'utf-8'))
// 시군구 단위로 deduplicate (동 여러 개여도 코드 동일)
const codeToInfo = {}
for (const e of bjdong) {
  if (!codeToInfo[e.code]) codeToInfo[e.code] = { sidoNm: e.sidoNm, sigunguNm: e.sigunguNm }
}
const codes = Object.keys(codeToInfo)
console.log(`총 ${codes.length}개 시군구 → API 호출 시작`)

function getTag(xml, tag) {
  return xml.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`))?.[1]?.trim() ?? ''
}

async function fetchAptListForCode(lawdCd) {
  const apts = []
  let page = 1
  while (true) {
    const params = new URLSearchParams({
      serviceKey: apiKey,
      LAWD_CD: lawdCd,
      numOfRows: '1000',
      pageNo: String(page),
    })
    let text
    try {
      const res = await fetch(`https://apis.data.go.kr/1613000/AptListService2/getRTMSDataSvcAptList?${params}`)
      text = await res.text()
    } catch (e) {
      break
    }

    // 첫 호출시 필드명 디버그 (첫 item만)
    if (page === 1 && apts.length === 0 && lawdCd === codes[0]) {
      const firstItem = text.match(/<item>([\s\S]*?)<\/item>/)?.[1] ?? ''
      if (firstItem) console.log('[DEBUG] 첫 번째 아이템 필드:', firstItem.replace(/\s+/g, ' '))
    }

    const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    if (items.length === 0) break

    for (const [, body] of items) {
      // 여러 가능한 필드명 시도
      const name = getTag(body, 'kaptName') || getTag(body, 'aptNm') || getTag(body, '단지명')
      const bjdCode = getTag(body, 'bjdCode') || getTag(body, 'lawdCd') || getTag(body, '법정동코드')
      const emdNm = getTag(body, 'emdNm') || getTag(body, 'umdNm') || getTag(body, '읍면동')

      if (name && (bjdCode || lawdCd)) {
        apts.push({
          name,
          code: bjdCode ? bjdCode.slice(0, 5) : lawdCd,
          emdNm: emdNm || '',
        })
      }
    }

    const totalCount = parseInt(getTag(text, 'totalCount') || '0')
    if (page * 1000 >= totalCount || items.length < 1000) break
    page++
  }
  return apts
}

const all = []
let done = 0
// 5개씩 병렬 처리
for (let i = 0; i < codes.length; i += 5) {
  const batch = codes.slice(i, i + 5)
  const results = await Promise.all(batch.map(fetchAptListForCode))
  for (const list of results) all.push(...list)
  done += batch.length
  process.stdout.write(`\r진행중: ${done}/${codes.length} (${all.length}개 아파트)`)
}

// 중복 제거 (같은 name+code)
const seen = new Set()
const unique = all.filter(a => {
  const key = `${a.name}|${a.code}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})

const outputPath = resolve(__dirname, '../public/apt-index.json')
writeFileSync(outputPath, JSON.stringify(unique))
console.log(`\n✅ 완료: ${unique.length}개 아파트 → public/apt-index.json`)
