// scripts/gen-bjdong.mjs
// 실행 전: https://www.code.go.kr/stdcode/regCodeL.do 에서
// "법정동코드 전체자료" TXT 파일을 다운로드하여 scripts/법정동코드_전체자료.txt 로 저장
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { TextDecoder } from 'util'

const __dirname = dirname(fileURLToPath(import.meta.url))
const inputPath = resolve(__dirname, '법정동코드_전체자료.txt')
const outputPath = resolve(__dirname, '../src/data/bjdong.json')

const buf = readFileSync(inputPath)
const text = new TextDecoder('euc-kr').decode(buf)
const lines = text.split('\n').slice(1) // 첫 줄(헤더) 제거

const entries = []
for (const line of lines) {
  const cols = line.split('\t')
  const code10 = cols[0]?.trim() ?? ''
  const fullNm = cols[1]?.trim() ?? ''
  const status = cols[2]?.trim() ?? ''

  if (status !== '존재') continue
  if (code10.length !== 10) continue

  // 읍면동 단위만 (5~8번째 자리가 000이 아닌 것)
  if (code10.slice(5, 8) === '000') continue

  const parts = fullNm.split(' ')
  if (parts.length < 3) continue

  entries.push({
    code: code10.slice(0, 5),       // 시군구코드 5자리 (API 호출용)
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
