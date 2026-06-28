// scripts/gen-apt-index.mjs
// 공동주택 단지 기본정보 엑셀 → public/apt-index.json 변환
// 실행: node scripts/gen-apt-index.mjs
import XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// bjdong.json에서 법정동명 → 5자리코드 매핑
const bjdong = JSON.parse(readFileSync(resolve(__dirname, '../src/data/bjdong.json'), 'utf-8'))

// "서울특별시 강남구 대치동" → code 매핑
const fullNmToCode = {}
const emdToCode = {}  // "시군구|동리" → code
for (const e of bjdong) {
  fullNmToCode[e.fullNm] = e.code
  const key = `${e.sigunguNm}|${e.emdNm}`
  if (!emdToCode[key]) emdToCode[key] = e.code
}

// 엑셀 읽기
const inputPath = resolve(__dirname, '20260626_단지_기본정보.xlsx')
const wb = XLSX.readFile(inputPath)
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

// 헤더 행 찾기 (첫 번째 데이터 행 = 두 번째 행)
const headers = rows[1]
const colIdx = (name) => headers.indexOf(name)

const 시도Col = colIdx('시도')
const 시군구Col = colIdx('시군구')
const 읍면Col = colIdx('읍면')
const 동리Col = colIdx('동리')
const 단지명Col = colIdx('단지명')
const 단지분류Col = colIdx('단지분류')
const 법정동주소Col = colIdx('법정동주소')

console.log('컬럼 인덱스:', { 시도: 시도Col, 시군구: 시군구Col, 동리: 동리Col, 단지명: 단지명Col })

const result = []
let notFound = 0

for (const row of rows.slice(2)) {
  const name = String(row[단지명Col] ?? '').trim()
  if (!name) continue

  // 아파트만 (단지분류가 있으면 필터)
  const 분류 = String(row[단지분류Col] ?? '').trim()
  if (분류 && !분류.includes('아파트') && !분류.includes('주상복합')) continue

  const 시도 = String(row[시도Col] ?? '').trim()
  const 시군구 = String(row[시군구Col] ?? '').trim()
  const 읍면 = String(row[읍면Col] ?? '').trim()
  const 동리 = String(row[동리Col] ?? '').trim()

  // 법정동코드 매핑 시도
  let code = ''

  // 시도+시군구+동리로 매핑
  const key1 = `${시군구}|${동리}`
  const key2 = `${시군구}|${읍면}`
  if (emdToCode[key1]) code = emdToCode[key1]
  else if (emdToCode[key2]) code = emdToCode[key2]

  // 법정동주소로 매핑
  if (!code && 법정동주소Col >= 0) {
    const addr = String(row[법정동주소Col] ?? '').trim()
    for (const [fullNm, c] of Object.entries(fullNmToCode)) {
      if (addr.includes(fullNm.split(' ').slice(-1)[0])) {
        code = c; break
      }
    }
  }

  if (!code) { notFound++; continue }

  result.push({ name, code, emdNm: 동리 || 읍면 })
}

// 중복 제거
const seen = new Set()
const unique = result.filter(a => {
  const key = `${a.name}|${a.code}`
  if (seen.has(key)) return false
  seen.add(key); return true
})

const outputPath = resolve(__dirname, '../public/apt-index.json')
writeFileSync(outputPath, JSON.stringify(unique))
console.log(`✅ 완료: ${unique.length}개 아파트 → public/apt-index.json`)
console.log(`   코드 매핑 실패: ${notFound}개`)
