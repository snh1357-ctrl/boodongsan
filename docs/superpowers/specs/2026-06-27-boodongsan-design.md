# 부동산 아파트 실거래가 조회 사이트 설계

**날짜**: 2026-06-27  
**배포**: Cloudflare Pages (https://boodongsan.pages.dev)

---

## 개요

국토교통부 공공 API 기반 아파트 실거래가 조회 웹앱.  
기존 ATH Tracker(주식 Excel UI)의 디자인을 그대로 재활용하고, 주식 데이터를 아파트 실거래가 데이터로 교체한다.

---

## 아키텍처

```
브라우저 (React + Vite)
  ↓ fetch("/api/search?name=래미안&dongCode=11650106")
Cloudflare Pages Functions  ← functions/api/search.ts
  ↓ Secret: MOLIT_API_KEY (CF 대시보드에서 관리)
  ↓ 법정동코드 기준으로 국토교통부 API 월별 호출 (2006~현재)
  ↓ 집계: 최근 거래가, 3개월 평균, 역대 최고가, 등락률, 거래건수
  → JSON 반환 (CF Cache API, 24시간 TTL)
```

- API 키는 Cloudflare Secret에만 존재 — 코드/브라우저 어디에도 노출 안 됨
- 전체 기간(2006~) 데이터: 첫 조회 시 느리지만 캐싱 후 즉시 응답

---

## 데이터 컬럼

| 컬럼 | 내용 |
|---|---|
| 아파트명 | 단지명, 클릭 시 면적별 하위 행 펼치기 |
| 전용면적 | 84㎡, 59㎡ 등 (펼쳤을 때 표시) |
| 최근 거래가 | 가장 최근 실거래가 + 계약일 |
| 3개월 평균 | 최근 3개월 평균 실거래가 |
| 역대 최고가 | 2006년~현재 최고 거래가 + 날짜 |
| 현재 등락률 | (최근 거래가 / 역대 최고가 - 1) × 100, 바 차트 |
| 거래 건수 | 최근 3개월 거래 건수 |

호가(매물가) 컬럼 없음 — 공식 API 미제공, 크롤링 법적 리스크로 제외.

---

## 검색 흐름

### A. 아파트명 직접 입력 (Formula Bar)
1. 사용자가 아파트명 입력
2. 클라이언트에서 `bjdong.json` 기반 자동완성 드롭다운 표시
3. 선택 시 법정동코드 확정 → `/api/search` 호출
4. 결과 행이 테이블에 추가됨

### B. 지역 탐색 (리본 탭)
1. "지역검색" 탭 클릭
2. 시/도 → 시/군/구 → 읍/면/동 드롭다운 선택
3. 해당 동의 전체 아파트 목록 로드
4. 단지 클릭 시 면적별 하위 행 펼치기

### 법정동코드 자동완성
- 전체 법정동 목록(~4만건)을 빌드 시 `bjdong.json`으로 번들링
- 입력 시 클라이언트 필터링 — 추가 API 호출 없음

---

## 파일 구조

```
boodongsan/
├── functions/
│   └── api/
│       └── search.ts          ← Pages Function 백엔드
├── src/
│   ├── components/
│   │   ├── ExcelShell.tsx     ← 전체 레이아웃 (타이틀바, 리본, 상태바)
│   │   ├── SearchBar.tsx      ← Formula Bar + 자동완성
│   │   ├── AptTable.tsx       ← 스프레드시트 테이블
│   │   ├── RegionSearch.tsx   ← 지역검색 탭
│   │   └── MobileLayout.tsx   ← 모바일 상단바 (640px 이하)
│   ├── data/
│   │   └── bjdong.json        ← 법정동코드 전체 목록
│   ├── hooks/
│   │   └── useAptSearch.ts    ← API 호출 + 상태 관리
│   ├── types.ts
│   └── App.tsx
├── .env                       ← 로컬 개발용 (gitignore)
└── .dev.vars                  ← 로컬 Pages Functions용 Secret
```

---

## 모바일 (640px 이하)

- Excel 크롬(타이틀바, 리본) 숨김
- 초록 상단 검색바만 표시
- 테이블은 Excel 표 형식 유지, 가로 스크롤
- 주요 컬럼(아파트명, 최근 거래가, 등락률)이 먼저 보이도록 컬럼 순서/너비 조정

---

## 보안

- `MOLIT_API_KEY`: Cloudflare Pages 대시보드 Secret 저장
- 로컬 개발: `.dev.vars` 파일 (gitignore됨)
- 프론트엔드 코드에 API 키 없음

---

## 데이터 소스

- **국토교통부 아파트 매매 실거래가 상세 자료**: https://www.data.go.kr/data/15126469/openapi.do
- 요청 파라미터: 법정동코드(5자리) + 계약년월(YYYYMM)
- 응답: 아파트명, 전용면적, 층, 거래금액, 계약일
