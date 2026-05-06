# Article Components

## English

This directory contains modular components for the article reading experience.

Current component:

- `TranslationWarning.tsx`: warning shown after repeated Korean translation clicks. It auto-hides and uses animated entry/exit behavior.

Related constants:

- `constants/colors.ts`: local color palette for article components.

Keep article reading UI modular so `ArticleClient` remains focused on page state and orchestration.

## 한국어

이 폴더는 아티클 읽기 경험에 필요한 모듈형 컴포넌트를 담습니다.

현재 컴포넌트:

- `TranslationWarning.tsx`: 한국어 번역을 반복해서 클릭했을 때 표시되는 경고입니다. 자동으로 사라지고 진입/퇴장 애니메이션을 사용합니다.

관련 상수:

- `constants/colors.ts`: 아티클 컴포넌트용 로컬 색상 팔레트.

`ArticleClient`가 페이지 상태와 흐름 조정에 집중할 수 있도록 아티클 읽기 UI는 작은 컴포넌트로 유지합니다.
