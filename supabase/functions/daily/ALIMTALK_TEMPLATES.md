# 영어 한잔 Daily — Alimtalk templates to submit

Three templates for the `daily` Edge Function. Register them in **NHN Cloud Console →
Notification → KakaoTalk Bizmessage → 알림톡 → 템플릿 관리**, under the same sender
profile (발신 프로필) the existing `send-article` template uses.

Kakao reviews each one, usually in 1–3 business days. Once all three show **승인**, point
`daily_config` at their codes (bottom of this file). Until codes are set the delivery job
runs but sends nothing.

The variable names (`#{name}`, `#{token}`…) must stay exactly as written; the function
fills them by these names (`templateParameter` in `delivery.ts`). The fixed wording can
be edited before submitting, but if Kakao asks for a variable to be renamed, change the
code to match.

Common settings for all three:

| Field | Value |
| --- | --- |
| 메시지 유형 | 기본형 |
| 카테고리 | 서비스이용 → 이용안내/공지 |
| 보안 템플릿 | 아니오 |

---

## 1. Daily lesson

| Field | Value |
| --- | --- |
| 템플릿 코드 | `DAILY_LESSON` |
| 템플릿명 | 데일리 오늘의 표현 |
| 강조 유형 | 강조표기형 — 제목 `#{expression}`, 보조 문구 `오늘의 표현` |

**본문**

```
[#{track}] 오늘의 표현

#{expression}
#{meaning}

예문
#{example}

#{name}님이 신청하신 영어 한잔 Daily 레슨이 도착했어요. 아래 버튼을 누르면 발음, 예문 3개, 대화, 1분 퀴즈를 볼 수 있어요.

※ 이 메시지는 영어 한잔 Daily를 신청하신 분께 발송됩니다. 받는 시간 변경과 해지는 내 계정에서 할 수 있어요.
```

**버튼**

| 유형 | 버튼명 | Mobile / PC 링크 |
| --- | --- | --- |
| 웹링크 | 오늘의 레슨 보기 | `https://1cupenglish.com/daily/l/#{token}` |

---

## 2. Saturday review

| Field | Value |
| --- | --- |
| 템플릿 코드 | `DAILY_REVIEW` |
| 템플릿명 | 데일리 주간 복습 |
| 강조 유형 | 선택 안함 |

**본문**

```
[영어 한잔 Daily] 이번 주 복습

#{name}님, 이번 주에 받은 표현 #{count}개를 한 번에 복습해보세요.

#{expressions}

버튼을 누르면 표현별 예문과 복습 퀴즈가 열려요.

※ 이 메시지는 영어 한잔 Daily를 신청하신 분께 매주 토요일 발송됩니다. 받는 시간 변경과 해지는 내 계정에서 할 수 있어요.
```

**버튼**

| 유형 | 버튼명 | Mobile / PC 링크 |
| --- | --- | --- |
| 웹링크 | 이번 주 복습하기 | `https://1cupenglish.com/daily/r/#{token}` |

---

## 3. Free trial ended

| Field | Value |
| --- | --- |
| 템플릿 코드 | `DAILY_TRIAL_END` |
| 템플릿명 | 데일리 무료 체험 종료 안내 |
| 강조 유형 | 선택 안함 |

**본문**

```
[영어 한잔 Daily] 무료 체험 종료 안내

#{name}님, 신청하신 #{track} 무료 체험 레슨 1회가 발송되어 체험 기간이 종료되었어요.

구독하지 않으시면 레슨은 더 이상 발송되지 않아요. 계속 받아보시려면 아래 버튼에서 구독을 신청해주세요.

· 구독료: 월 3,700원
· 약정 없이 언제든 해지

※ 이 메시지는 영어 한잔 Daily 무료 체험을 신청하신 분께 1회 발송됩니다.
```

**버튼**

| 유형 | 버튼명 | Mobile / PC 링크 |
| --- | --- | --- |
| 웹링크 | 구독 안내 보기 | `https://1cupenglish.com/daily/subscribe?t=#{token}` |

> Review risk: Kakao rejects templates it reads as advertising. This one states a
> service status (the trial ended, nothing more will be sent) and the price the person
> would pay, which is normally accepted as 이용안내. If it is rejected as 광고성, drop the
> price lines and resubmit; the subscribe page shows the price anyway.

---

## After approval

Point Daily at the approved codes in the `daily_config` row (no redeploy needed):

```sql
update public.daily_config
   set template_style = 'daily',
       lesson_template = 'DAILY_LESSON',
       review_template = 'DAILY_REVIEW',
       trial_ended_template = 'DAILY_TRIAL_END'
 where id = 'settings';
```

Until then, the dry run uses the already-approved 1cup article template for every message
kind (`template_style = 'send-article'`, all three codes `send-article`).

Then send each one to your own phone as an admin, before opening signup:

```bash
curl -s https://hetiycbotgjeluteicyk.supabase.co/functions/v1/daily \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  -d '{"action":"test-send","phone":"010…","kind":"lesson","track":"business"}'
```

`ADMIN_ACCESS_TOKEN` is the access token of a logged-in admin session (the
`sb-…-auth-token` cookie or local storage entry on 1cupenglish.com).

`kind` is `lesson`, `review` or `trial_ended`. The link buttons in test messages point
to `…/test`, which has no page; only the message itself is being checked.

Text-message fallback is off. Turning it on (`DAILY_SMS_FALLBACK=true`) needs the sender
profile's text-resend setting (대체 발송) in NHN Cloud first; without it NHN rejects every
message with `-2502: Please set up plus-friend resend setting.`
