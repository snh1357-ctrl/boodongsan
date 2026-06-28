// scripts/gen-apt-index.mjs
// 기존 거래 API(이미 승인됨)로 최근 12개월 아파트 목록 수집 → public/apt-index.json
// 실행: node scripts/gen-apt-index.mjs
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

let apiKey = process.env.MOLIT_API_KEY
if (!apiKey) {
  try {
    const devVars = readFileSync(resolve(__dirname, '../.dev.vars'), 'utf-8')
    apiKey = devVars.match(/MOLIT_API_KEY=(.+)/)?.[1]?.trim()
  } catch {}
}
if (!apiKey || apiKey.includes('여기에')) {
  console.error('❌ .dev.vars 파일에 실제 MOLIT_API_KEY를 입력하세요')
  process.exit(1)
}

const bjdong = JSON.parse(readFileSync(resolve(__dirname, '../src/data/bjdong.json'), 'utf-8'))
const codes = [...new Set(bjdong.map(e => e.code))]

// 최근 12개월 YYYYMM 목록
const months = []
const now = new Date()
for (let i = 0; i < 12; i++) {
  const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
  months.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`)
}

console.log(`총 ${codes.length}개 시군구 × ${months.length}개월 → 수집 시작`)
console.log('예상 소요 시간: 5~10분\n')

// bjdong에서 동 이름 빠르게 찾기
const codeToEmd = {}
for (const e of bjdong) {
  if (!codeToEmd[e.code]) codeToEmd[e.code] = e.emdNm
}

async function fetchMonth(code, ym) {
  const params = new URLSearchParams({
    serviceKey: apiKey,
    LAWD_CD: code,
    DEAL_YMD: ym,
    numOfRows: '1000',
    pageNo: '1',
  })
  try {
    const url = `https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade?serviceKey=${apiKey}&LAWD_CD=${code}&DEAL_YMD=${ym}&numOfRows=1000&pageNo=1`
    const res = await fetch(url)
    const text = await res.text()
    return [...text.matchAll(/<aptNm>([^<]+)<\/aptNm>/g)].map(m => m[1].trim())
  } catch {
    return []
  }
}

const index = new Map() // "name|code" → { name, code, emdNm }
let done = 0

for (let i = 0; i < codes.length; i += 10) {
  const batch = codes.slice(i, i + 10)
  await Promise.all(batch.map(async code => {
    // 최근 3개월만 (속도 우선, 충분한 커버리지)
    const results = await Promise.all(months.slice(0, 3).map(ym => fetchMonth(code, ym)))
    const names = [...new Set(results.flat())]
    for (const name of names) {
      const key = `${name}|${code}`
      if (!index.has(key)) {
        index.set(key, { name, code, emdNm: codeToEmd[code] ?? '' })
      }
    }
  }))
  done += batch.length
  process.stdout.write(`\r진행: ${done}/${codes.length} 시군구 | ${index.size}개 아파트`)
}

const result = [...index.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
const outputPath = resolve(__dirname, '../public/apt-index.json')
writeFileSync(outputPath, JSON.stringify(result))
console.log(`\n\n✅ 완료: ${result.length}개 아파트 → public/apt-index.json`)
