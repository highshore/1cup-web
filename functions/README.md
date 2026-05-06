# Firebase Functions

## English

`functions/` contains Firebase Functions backend code. The current service area is Payple payment integration and related backend callbacks.

## Payment Flow

1. The frontend `/payment` page starts a Payple payment request.
2. Payple calls backend function endpoints with authentication or payment result data.
3. Functions validate and store payment-related information in Firestore.
4. The frontend payment result page displays the final user-facing state.

## Common Endpoints

- `paymentService`: grouped payment service entrypoint.
- Payment auth: provides Payple partner authentication.
- Payment result: receives Payple result callbacks and records them.
- Payment status/refund helpers: support operational payment checks.

Check `functions/src` for the current exported function names before changing routes or deploy settings.

## Environment

Set Payple and Firebase credentials in Firebase/Vercel environments. Do not commit production credential values.

## Local Development

```bash
cd functions
npm install
npm run serve
```

Deploy functions only when backend code changes:

```bash
npm run deploy:functions
```

## 한국어

`functions/`는 Firebase Functions 백엔드 코드를 담습니다. 현재 주요 영역은 Payple 결제 연동과 관련 callback 처리입니다.

## 결제 흐름

1. 프론트엔드 `/payment` 페이지에서 Payple 결제 요청을 시작합니다.
2. Payple이 인증 또는 결제 결과 데이터를 backend function endpoint로 전달합니다.
3. Functions가 결제 관련 정보를 검증하고 Firestore에 저장합니다.
4. 프론트엔드 결제 결과 페이지가 사용자에게 최종 상태를 보여줍니다.

## 주요 엔드포인트

- `paymentService`: 결제 서비스 그룹 entrypoint.
- 결제 인증: Payple partner 인증 제공.
- 결제 결과: Payple 결과 callback 수신과 기록.
- 결제 상태/refund helper: 운영용 결제 확인을 지원합니다.

라우트나 배포 설정을 바꾸기 전에 `functions/src`의 현재 export 이름을 확인하세요.

## 환경 변수

Payple과 Firebase 인증 정보는 Firebase/Vercel 환경에 설정합니다. 프로덕션 credential 값을 커밋하지 않습니다.

## 로컬 개발

```bash
cd functions
npm install
npm run serve
```

백엔드 코드 변경 시에만 Functions를 배포합니다.

```bash
npm run deploy:functions
```
