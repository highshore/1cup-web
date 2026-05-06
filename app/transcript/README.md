# Transcript Page

## English

The transcript page provides real-time Speechmatics speech-to-text transcription.

## Features

- Live microphone transcription.
- Speaker diarization with speaker labels.
- Confidence-based word highlighting.
- Partial and final transcript display.
- Optional target sentence input for practice.
- Saved transcript detail view.

## Setup

Set the Speechmatics API key in the environment:

```bash
NEXT_PUBLIC_SPEECHMATICS_API_KEY=your_speechmatics_api_key_here
```

The browser will request microphone permission when recording starts.

## Technical Notes

- Audio uses the Web Audio API and an AudioWorklet loaded from `/scripts/audio-processor.js`.
- `RecordTranscriptClient.tsx` contains the main recording UI.
- `TranscriptDetailClient.tsx` renders saved transcript details.
- `hooks/useSpeechmatics.ts` manages Speechmatics websocket integration.

## 한국어

transcript 페이지는 Speechmatics 기반 실시간 음성-텍스트 변환 기능을 제공합니다.

## 기능

- 마이크 기반 실시간 전사.
- 화자 분리와 speaker label 표시.
- confidence 기반 단어 강조.
- partial/final transcript 표시.
- 연습용 target sentence 입력.
- 저장된 transcript 상세 보기.

## 설정

환경 변수에 Speechmatics API key를 설정합니다.

```bash
NEXT_PUBLIC_SPEECHMATICS_API_KEY=your_speechmatics_api_key_here
```

녹음을 시작할 때 브라우저가 마이크 권한을 요청합니다.

## 기술 메모

- 오디오는 Web Audio API와 `/scripts/audio-processor.js`의 AudioWorklet을 사용합니다.
- `RecordTranscriptClient.tsx`는 메인 녹음 UI입니다.
- `TranscriptDetailClient.tsx`는 저장된 transcript 상세 화면을 렌더링합니다.
- `hooks/useSpeechmatics.ts`는 Speechmatics websocket 연동을 관리합니다.
