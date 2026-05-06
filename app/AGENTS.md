# Agent Guide For `app/`

## English

- Keep route files small. Move non-trivial client UI into `*Client.tsx`.
- New user-facing text must be localized through `app/lib/i18n`; avoid hard-coded Korean/English strings in components when a locale entry exists.
- Use `app/lib/constants/app_layout.ts` for shared page width and gutters.
- Use existing global layout wrappers rather than adding per-page nav/footer wrappers.
- For client components, keep `"use client"` at the top and avoid server-only imports such as Firebase Admin.

## 한국어

- 라우트 파일은 작게 유지합니다. 복잡한 클라이언트 UI는 `*Client.tsx`로 분리합니다.
- 사용자에게 보이는 새 문구는 `app/lib/i18n`을 통해 다국어 처리합니다. locale 항목이 있는 경우 컴포넌트에 한국어/영어를 직접 박지 않습니다.
- 공통 페이지 폭과 gutter는 `app/lib/constants/app_layout.ts`를 사용합니다.
- 페이지마다 nav/footer wrapper를 새로 만들지 말고 기존 글로벌 layout wrapper를 사용합니다.
- 클라이언트 컴포넌트는 `"use client"`를 최상단에 두고 Firebase Admin 같은 서버 전용 import를 피합니다.
