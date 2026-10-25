-- Daily's Alimtalk template codes move into daily_config, next to the switch that opens
-- trials, so changing them is an UPDATE rather than a secret plus a redeploy.
--
-- template_style says which variables the codes expect:
--   'daily'        the three Daily templates in supabase/functions/daily/ALIMTALK_TEMPLATES.md
--   'send-article' the existing, already-approved 1cup article template
--                  (#{korean-title}, #{customer-name}, button https://#{article-link}),
--                  used for one code for every message kind during the dry run before
--                  the Daily templates are approved.
-- Null codes fall back to the DAILY_TEMPLATE_* function secrets; with neither, nothing
-- is sent.
alter table public.daily_config
  add column template_style       text not null default 'daily'
                                    check (template_style in ('daily', 'send-article')),
  add column lesson_template      text,
  add column review_template      text,
  add column trial_ended_template text;
