# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

## 공급면적 데이터 (public/apt-area.json)

국토부 API는 전용면적만 제공하므로 공급면적/평형은 기본적으로 전용률로 추정합니다.
정확한 공급면적을 쓰려면 네이버 부동산에서 평형별 공급/전용면적을 수집해
`public/apt-area.json`을 채우면, 앱이 자동으로 실측값을 우선 사용합니다(없으면 추정 폴백).

```bash
# ⚠ 네이버 접속이 되는 로컬 PC에서만 동작 (클라우드/CI는 네이버가 차단)
# 브라우저 개발자도구 Network 탭에서 authorization 헤더(Bearer ...)를 복사해 넣으세요.
NAVER_AUTH="Bearer eyJ..." npm run gen:area -- --limit 50
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
