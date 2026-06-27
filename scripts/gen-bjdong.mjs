// scripts/gen-bjdong.mjs
// 실행 전: https://www.code.go.kr/stdcode/regCodeL.do 에서
// "법정동코드 전체자료" Excel 파일을 다운로드하여 scripts/법정동코드_전체자료.xlsx 로 저장
import * as XLSX from 'xlsx'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const inputPath = resolve(__dirname, '법정동코드_전체자료.xlsx')
const outputPath = resolve(__dirname, '../src/data/bjdong.json')

const wb = XLSX.readFile(inputPath)
const ws = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

const entries = []
for (const row of rows.slice(1)) {
  const code10 = String(row[0] ?? '').trim()     // 10자리 법정동코드
  const fullNm = String(row[1] ?? '').trim()     // "서울특별시 강남구 대치동"
  const status = String(row[2] ?? '').trim()     // "존재" or "폐지"

  if (status !== '존재') continue
  if (code10.length !== 10) continue

  // 읍면동 단위만 (코드 8-10자리가 00이 아닌 것)
  if (code10.slice(5, 8) === '000') continue

  const parts = fullNm.split(' ')
  if (parts.length < 3) continue

  entries.push({
    code: code10.slice(0, 5),      // 시군구코드 5자리 (API 호출용)
    sidoNm: parts[0],
    sigunguNm: parts[1],
    emdNm: parts.slice(2).join(' '),
    fullNm,
  })
}

// 중복 제거 (같은 fullNm)
const unique = entries.filter((e, i, arr) => arr.findIndex(x => x.fullNm === e.fullNm) === i)

writeFileSync(outputPath, JSON.stringify(unique, null, 0))
console.log(`생성 완료: ${unique.length}개 항목 → src/data/bjdong.json`)
