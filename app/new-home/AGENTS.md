# Agent Guide For New Home

## English

- Keep the Human/Agent toggle localized through `app/lib/i18n/locales`.
- The Agent mode should stay markdown-first: black background, monospace content, and only the bottom toggle as UI.
- The navbar is shared globally from this folder; test changes against regular pages, not only `/new-home`.
- Avoid adding heavy assets without checking mobile layout and loading impact.

## 한국어

- Human/Agent 토글 문구는 `app/lib/i18n/locales`를 통해 다국어 처리합니다.
- Agent mode는 markdown-first 경험으로 유지합니다. 검은 배경, monospace 콘텐츠, 하단 토글만 UI로 둡니다.
- 이 폴더의 navbar는 전역으로 공유됩니다. `/new-home`뿐 아니라 일반 페이지에서도 변경을 확인합니다.
- 모바일 레이아웃과 로딩 영향을 확인하지 않은 무거운 asset 추가를 피합니다.
