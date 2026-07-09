# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## 공급면적 데이터 (public/apt-area.json)

국토부 API는 전용면적만 제공하므로 공급면적/평형은 기본적으로 전용률로 추정합니다.
정확한 공급면적을 쓰려면 네이버 부동산에서 평형별 공급/전용면적을 수집해
`public/apt-area.json`을 채우면, 앱이 자동으로 실측값을 우선 사용합니다(없으면 추정 폴백).

```bash
# ⚠ 네이버 접속이 되는 로컬 PC에서만 동작 (클라우드/CI는 네이버가 차단)
# 1) 크롬에서 new.land.naver.com 접속 → 아무 단지 열기 → F12 → Network 탭
#    → 'complexes' 요청 클릭 → Request Headers의 authorization 값(Bearer ...) 복사
# 2) scripts/naver-token.txt 파일에 붙여넣고 저장 (git 커밋 제외됨)
# 3) 실행 (맥/윈도우 공통, 처음엔 50개만 테스트):
npm run gen:area -- --limit 50
# 4) 잘 채워지면 public/apt-area.json 커밋·푸시
```

자세한 옵션·주의사항은 `scripts/gen-apt-area.mjs` 상단 주석 참고.


Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
