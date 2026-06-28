// scripts/gen-apt-index.mjs
// 공동주택 단지 기본정보 엑셀 → public/apt-index.json 변환
// 실행: node scripts/gen-apt-index.mjs
import XLSX from 'xlsx'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const bjdong = JSON.parse(readFileSync(resolve(__dirname, '../src/data/bjdong.json'), 'utf-8'))

// 시도+동리로 후보 목록 구축 (동리 이름이 같은 것이 여러 시도에 있을 수 있음)
// key: "경기도|비산동" → [{code, sigunguNm, guNm}]
const sidoDongMap = {}
for (const e of bjdong) {
  // emdNm = "동안구 비산동" 또는 "비산동"
  const dongNm = e.emdNm.includes(' ') ? e.emdNm.split(' ').slice(-1)[0] : e.emdNm
  const guNm   = e.emdNm.includes(' ') ? e.emdNm.split(' ')[0] : ''
  const key = `${e.sidoNm}|${dongNm}`
  if (!sidoDongMap[key]) sidoDongMap[key] = []
  sidoDongMap[key].push({ code: e.code, sigunguNm: e.sigunguNm, guNm })
}

// 시군구 문자열 정규화: "안양동안구" → "안양동안구" (공백/특수문자 제거, 소문자)
function normalize(s) {
  return s.replace(/\s/g, '').toLowerCase()
}

// K-apt 시군구 "안양동안구"에서 bjdong 후보를 선택
// 후보의 sigunguNm="안양시", guNm="동안구" → "안양동안구"와 비교
function pickBest(candidates, kapt시군구) {
  if (candidates.length === 1) return candidates[0].code
  const norm = normalize(kapt시군구)
  for (const c of candidates) {
    const combined = normalize(c.sigunguNm.replace(/시$|군$|구$/, '') + c.guNm.replace(/구$|군$/, '') )
    const combined2 = normalize(c.sigunguNm + c.guNm)
    if (norm.includes(combined) || norm === combined2 || norm.includes(normalize(c.sigunguNm.replace(/시$|군$/,''))))
      return c.code
  }
  // fallback: 그냥 첫 번째
  return candidates[0].code
}

// 엑셀 읽기
const wb = XLSX.readFile(resolve(__dirname, '20260626_단지_기본정보.xlsx'))
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
const headers = rows[1]
const col = (name) => headers.indexOf(name)

const 시도Col    = col('시도')
const 시군구Col  = col('시군구')
const 읍면Col    = col('읍면')
const 동리Col    = col('동리')
const 단지명Col  = col('단지명')
const 단지분류Col = col('단지분류')

console.log('컬럼 인덱스:', { 시도: 시도Col, 시군구: 시군구Col, 동리: 동리Col, 단지명: 단지명Col })

const result = []
let notFound = 0

for (const row of rows.slice(2)) {
  const name = String(row[단지명Col] ?? '').trim()
  if (!name) continue

  const 분류 = String(row[단지분류Col] ?? '').trim()
  if (분류 && !분류.includes('아파트') && !분류.includes('주상복합')) continue

  const 시도   = String(row[시도Col]   ?? '').trim()
  const 시군구 = String(row[시군구Col] ?? '').trim()
  const 읍면   = String(row[읍면Col]   ?? '').trim()
  const 동리   = String(row[동리Col]   ?? '').trim()

  const dong = 동리 || 읍면
  if (!dong) { notFound++; continue }

  const key = `${시도}|${dong}`
  const candidates = sidoDongMap[key]

  if (!candidates || candidates.length === 0) { notFound++; continue }

  const code = pickBest(candidates, 시군구)
  result.push({ name, code, emdNm: dong })
}

// 중복 제거
const seen = new Set()
const unique = result.filter(a => {
  const key = `${a.name}|${a.code}`
  if (seen.has(key)) return false
  seen.add(key); return true
})

writeFileSync(resolve(__dirname, '../public/apt-index.json'), JSON.stringify(unique))
console.log(`✅ 완료: ${unique.length}개 아파트 → public/apt-index.json`)
console.log(`   코드 매핑 실패: ${notFound}개`)
