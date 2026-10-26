-- Sample lessons for the Daily dry run: one per track, marked ready.
--
-- A new trial gets the latest ready lesson on or before today (KST), so these are dated
-- Friday 2026-10-23 to be picked up by a signup over the weekend. Lessons can only be
-- dated Mon–Fri. Replace or extend them with real lessons; until the admin editor exists
-- (phase 4), a lesson is "ready" when its row has status = 'ready'.
insert into public.daily_lessons (
  track, publish_on, expression, meaning, pronunciation, stress, nuance,
  similar_expressions, examples, dialogue, quiz, status
) values
(
  'business', '2026-10-23', 'circle back', '(논의를) 나중에 다시 이어가다',
  '/ˈsɜːrkəl bæk/', '써클 백',
  '결론을 지금 내지 않고 다음에 다시 다루자고 할 때 써요. ''talk later''보다 업무적이고 정중해요.',
  array['follow up on', 'revisit', 'touch base'],
  '[
    {"context": "회의", "en": "Let''s circle back on pricing after the launch.", "ko": "가격 얘기는 출시 후에 다시 하죠."},
    {"context": "일정", "en": "Can we circle back to this on Friday?", "ko": "이건 금요일에 다시 얘기할 수 있을까요?"},
    {"context": "메일", "en": "I''ll circle back once I have the numbers.", "ko": "수치가 나오면 다시 연락드릴게요."}
  ]'::jsonb,
  '[
    {"speaker": "A", "role": "Manager", "en": "We''re running out of time. What about the budget?", "ko": "시간이 없네요. 예산은요?"},
    {"speaker": "B", "role": "You", "en": "Let''s circle back on that next week.", "ko": "그건 다음 주에 다시 이야기하죠."}
  ]'::jsonb,
  '{"prompt": "We''re out of time. Let''s ______ on the budget next week.", "options": ["circle back", "loop in", "move the needle"], "answer": 0, "explanation": "논의를 나중에 다시 이어갈 때는 circle back을 써요."}'::jsonb,
  'ready'
),
(
  'tech', '2026-10-23', 'ship', '(제품·기능을) 출시하다, 배포하다',
  '/ʃɪp/', '쉽',
  '실리콘밸리에서는 ''release''보다 ''ship''을 훨씬 자주 써요. 기능을 실제 사용자에게 내보낸다는 뜻이에요.',
  array['release', 'roll out', 'launch'],
  '[
    {"context": "스탠드업", "en": "We shipped the new onboarding flow yesterday.", "ko": "어제 새 온보딩 흐름을 배포했어요."},
    {"context": "회의", "en": "Can we ship this by the end of the sprint?", "ko": "이번 스프린트 안에 출시할 수 있을까요?"},
    {"context": "뉴스", "en": "The company plans to ship its first AI chip next year.", "ko": "그 회사는 내년에 첫 AI 칩을 출시할 계획이에요."}
  ]'::jsonb,
  '[
    {"speaker": "A", "role": "PM", "en": "Is the search feature ready?", "ko": "검색 기능 준비됐나요?"},
    {"speaker": "B", "role": "You", "en": "Almost. We can ship it on Thursday.", "ko": "거의요. 목요일에 배포할 수 있어요."}
  ]'::jsonb,
  '{"prompt": "We fixed the last bug, so we can ______ the update today.", "options": ["ship", "circle back", "loop in"], "answer": 0, "explanation": "기능이나 업데이트를 출시·배포할 때는 ship을 써요."}'::jsonb,
  'ready'
);
