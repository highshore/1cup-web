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
| trial_ended | `send-article` until `DAILY_TRIAL_ENDED` (`#{name}`, no button) is approved | |
| notices (account.ts) | `send-article` until the notice templates below are approved | |

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

## Waiting for review

| Code | Variables | Button |
| --- | --- | --- |
| `DAILY_TRIAL_ENDED` | `#{name}` | none |
| `DAILY_REFUND_DONE` | `#{name}` `#{amount}` | `https://1cupenglish.com/daily/account` |
| `DAILY_REFUND_REJECT` | `#{name}` | same |
| `DAILY_PAY_FAILED` | `#{name}` `#{track}` `#{amount}` `#{date}` | same |
| `DAILY_SUB_ENDED` | `#{name}` `#{track}` | none |
| `DAILY_ADMIN_REFUND` | `#{result}` `#{product}` `#{amount}` | `https://1cupenglish.com/admin/daily-refunds` |

Rejected: `DAILY_TRIAL_END` (asked people to subscribe) and `DAILY_NOTICE` (title and body
both variables). Alimtalk may only inform: no renewal or re-signup prompts.

## Switching codes

```sql
update public.daily_config
   set lesson_template = 'DAILY_LESSON_HOOK',
       review_template = 'DAILY_REVIEW_HOOK',
       trial_ended_template = 'send-article'
 where id = 'settings';
```

Check a template on a real phone with the admin `test-send` action (`kind` is `lesson`,
`review` or `trial_ended`), and the model's lines with `hook-preview`.

Text-message fallback is off. Turning it on (`DAILY_SMS_FALLBACK=true`) needs the sender
profile's text-resend setting (대체 발송) in NHN Cloud first; without it NHN rejects every
message with `-2502: Please set up plus-friend resend setting.`
