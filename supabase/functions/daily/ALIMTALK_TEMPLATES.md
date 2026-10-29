# 영어 한잔 Daily — Alimtalk templates

Registered in NHN Cloud (sender profile `@1cup_eng`). The template code is what the API
takes; the variable names must match exactly.

## In use

`daily_config` holds one code per message kind. Each code decides its variables
(`templateStyle` in `delivery.ts`): `send-article` is the general 1cup template
(`#{korean-title}`, `#{customer-name}`, `https://#{article-link}`), anything else a Daily
template as below.

| Kind | Code | Variables |
| --- | --- | --- |
| lesson | `DAILY_LESSON_HOOK` | `#{name}님, #{hook}` · `#{content}` · button `https://#{link}` |
| review | `DAILY_REVIEW_HOOK` | `#{name}님, #{hook}` · `#{content}` · button `https://#{link}` |
| trial_ended | `DAILY_TRIAL_ENDED` | `#{name}` · no button |

Account notices (`notices.ts`) use fixed codes, all approved. Every button is 웹링크 to
`https://1cupenglish.com/daily/account` unless noted. `#{amount}` is `₩3,700`, `#{date}`
`2027년 4월 26일`, `#{product}` the product name with the level (`영어 한잔 Daily 28일
정기구독 (고급)`), `#{track}` the level (`고급`).

| Code | Sent when | Variables |
| --- | --- | --- |
| `DAILY_PAY_DONE` | a pass is paid | `#{name}` `#{product}` `#{amount}` `#{date}` (pass end) |
| `DAILY_SUB_STARTED` | first subscription payment | same (`#{date}`: end of the paid period) |
| `DAILY_RENEWED` | an auto-renewal is charged | same |
| `DAILY_PAY_FAILED` | a renewal charge fails (1st or 2nd day) | `#{name}` `#{track}` `#{amount}` `#{date}` (last retry day) |
| `DAILY_SUB_ENDED` | the 3rd failed day ends the subscription | `#{name}` `#{track}` · no button |
| `DAILY_REFUND_DONE` | a refund went through | `#{name}` `#{amount}` |
| `DAILY_REFUND_REJECT` | an admin rejects a refund request | `#{name}` |
| `DAILY_ADMIN_REFUND` | every refund, to `daily_config.admin_phones` | `#{result}` (`환불 완료` / `확인 필요`) `#{product}` `#{amount}` · button `https://1cupenglish.com/admin/daily-refunds` |

`#{hook}` is written per reader by `hooks.ts` (model `DAILY_HOOK_MODEL`, default
`gpt-6-luna`; fixed pool when the model is unavailable). `#{content}` is the lesson or the
week's list, line breaks included. `#{link}` has no scheme (`1cupenglish.com/daily/l/…`).

## Approved, not used

- `DAILY_LESSON`, `DAILY_REVIEW` (`#{greeting}` · `#{content}` · `https://#{link}`): same
  messages with the whole first line, name included, as one variable.
- `DAILY_LESSON_FIRST`, `_STREAK` (`#{count}`), `_DAY` (`#{day}`), `_G1`–`_G6`,
  `DAILY_REVIEW_R1`–`_R4`: fixed first lines, the same lines as the fallback pool.
- `DAILY_TERMS` (`#{name}`, `#{date}`, `#{content}`, `https://#{link}`): terms-change
  notice; nothing sends it yet.

Rejected: `DAILY_TRIAL_END` (asked people to subscribe) and `DAILY_NOTICE` (title and body
both variables). Alimtalk may only inform: no renewal or re-signup prompts.

## Switching codes

```sql
update public.daily_config
   set lesson_template = 'DAILY_LESSON_HOOK',
       review_template = 'DAILY_REVIEW_HOOK',
       trial_ended_template = 'DAILY_TRIAL_ENDED'
 where id = 'settings';
```

Check a template on a real phone with the admin `test-send` action (`kind` is `lesson`,
`review`, `trial_ended`, or a notice code such as `DAILY_PAY_FAILED` for sample values),
and the model's lines with `hook-preview`.

Text-message fallback is off. Turning it on (`DAILY_SMS_FALLBACK=true`) needs the sender
profile's text-resend setting (대체 발송) in NHN Cloud first; without it NHN rejects every
message with `-2502: Please set up plus-friend resend setting.`
