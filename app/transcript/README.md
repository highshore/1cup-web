# Transcript Page

## English

The transcript page provides real-time Soniox speech-to-text transcription and live AI copilot feedback.

## Features

- Live microphone transcription.
- Automatic language identification during live transcription.
- Speaker diarization with speaker labels and endpoint-based turn boundaries.
- Recognition context/custom dictionary terms, including article keywords.
- Confidence-based word highlighting.
- Partial and final transcript display.
- Live copilot receives finalized speaker turns and selects one best action: gentle speech correction, feedback, a follow-up question, or no interruption.
- Optional target sentence input for practice.
- Saved transcript detail view.

## Setup

Set the Soniox key and Vertex AI credentials in the environment:

```bash
SONIOX_API_KEY=your_soniox_api_key_here
VERTEX_AI_PROJECT_ID=one-cup-eng
VERTEX_AI_LOCATION=global
# Existing Firebase service-account credentials are used by default.
# Optionally set VERTEX_AI_CLIENT_EMAIL and VERTEX_AI_PRIVATE_KEY instead.
```

The browser will request microphone permission when recording starts.

## Technical Notes

- Audio uses the Web Audio API and an AudioWorklet loaded from `/scripts/audio-processor.js`.
- `RecordTranscriptClient.tsx` contains the main recording UI.
- `TranscriptDetailClient.tsx` renders saved transcript details.
- `hooks/useSoniox.ts` manages Soniox websocket integration.
- `hooks/useTranscriptCopilot.ts` detects finalized turn switches and queues context-aware live AI copilot decisions.

## 한국어

transcript 페이지는 Soniox 기반 실시간 음성-텍스트 변환과 AI copilot 피드백을 제공합니다.

## 기능

- 마이크 기반 실시간 전사.
- 실시간 전사 중 자동 언어 감지.
- 화자 분리와 speaker label 표시, endpoint 기반 발화 전환 감지.
- 아티클 키워드를 포함한 인식 컨텍스트/custom dictionary term 지원.
- confidence 기반 단어 강조.
- partial/final transcript 표시.
- 실시간 copilot은 확정된 화자 발화를 받아 문장 교정, 피드백, 후속 질문, 개입 없음 중 최적의 행동 하나를 선택합니다.
- 연습용 target sentence 입력.
- 저장된 transcript 상세 보기.

## 설정

환경 변수에 Soniox key와 Vertex AI 인증 정보를 설정합니다.

```bash
SONIOX_API_KEY=your_soniox_api_key_here
VERTEX_AI_PROJECT_ID=one-cup-eng
VERTEX_AI_LOCATION=global
# 기존 Firebase service-account 인증 정보를 기본으로 사용합니다.
# 필요 시 VERTEX_AI_CLIENT_EMAIL, VERTEX_AI_PRIVATE_KEY를 대신 설정할 수 있습니다.
```

녹음을 시작할 때 브라우저가 마이크 권한을 요청합니다.

## 기술 메모

- 오디오는 Web Audio API와 `/scripts/audio-processor.js`의 AudioWorklet을 사용합니다.
- `RecordTranscriptClient.tsx`는 메인 녹음 UI입니다.
- `TranscriptDetailClient.tsx`는 저장된 transcript 상세 화면을 렌더링합니다.
- `hooks/useSoniox.ts`는 Soniox websocket 연동을 관리합니다.
- `hooks/useTranscriptCopilot.ts`는 확정된 발화 전환을 감지하고 문맥 기반 실시간 AI copilot 결정을 대기열로 처리합니다.
