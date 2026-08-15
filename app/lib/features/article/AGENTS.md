# Agent Guide For Article Feature

## English

- Treat article documents as production content; avoid destructive migrations or writes without explicit user approval.
- Keep exported CSV workflows separate from runtime services.

## Current implementation record

- Admin ingestion accepts ordered pasted/uploaded figures. Figures are deterministically placed between paragraphs, have no visible captions, and must never be sent to a model for OCR or visual analysis.
- The generated cover is distinct from pasted figures and is required for a processed article.
- New processed articles carry English/Korean three-point summaries, advanced vocabulary, atypical terms, eight discussion topics, and stable discussion-topic IDs.

## 한국어

- 아티클 문서는 프로덕션 콘텐츠로 취급합니다. 명시적 승인 없이 파괴적인 migration/write를 하지 않습니다.
- CSV export 워크플로는 런타임 service와 분리합니다.

## 현재 구현 기록

- 관리자 입력은 붙여 넣거나 업로드한 그림의 순서를 유지합니다. 그림은 문단 사이에 결정적으로 배치하고, 보이는 캡션을 만들지 않으며, OCR이나 시각 분석을 위해 모델에 보내지 않습니다.
- 생성된 대표 이미지는 붙여 넣은 그림과 별개이며, 처리된 아티클에는 필수입니다.
- 새로 처리되는 아티클에는 한·영 3개 요약, 고급 어휘, 특이 용어, 8개 토론 주제, 안정적인 토론 주제 ID를 저장합니다.
