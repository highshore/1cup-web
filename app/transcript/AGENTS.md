# Agent Guide For Transcript

## English

- Do not break microphone permission flow or AudioWorklet loading from `/scripts/audio-processor.js`.
- Keep Speechmatics API keys in environment variables.
- Preserve clear user-facing errors for permission, websocket, and audio failures.

## 한국어

- 마이크 권한 흐름과 `/scripts/audio-processor.js` AudioWorklet 로딩을 깨지 않게 유지합니다.
- Speechmatics API key는 환경 변수에 둡니다.
- 권한, websocket, audio 실패에 대한 사용자용 오류 메시지를 명확하게 유지합니다.
