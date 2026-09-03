-- Keep the durable web records byte-for-byte aligned with the editable desktop
-- workspace content. Provider-hosted video/audio URLs and inline media blobs are
-- deliberately not copied: they were temporary local preview artifacts. The web
-- uses the existing browser-native preview implementation for those media slots.

update public.exam_sets
set
  title = 'Speaking practice set',
  listen_repeat_theme = 'short informative updates regarding local community garden vegetable harvest schedules',
  interview_theme = 'personal experiences with comfort objects and meaningful childhood home decorations',
  status = 'published',
  published_at = coalesce(published_at, now()),
  updated_at = now()
where id = 'b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c';

update public.exam_sets
set
  title = 'Speaking practice set',
  listen_repeat_theme = 'brief announcements regarding changes to local community garden maintenance schedules',
  interview_theme = 'personal perspectives on finding moments of calm within busy urban environments',
  status = 'draft',
  published_at = null,
  updated_at = now()
where id = '95530250-9564-4f08-97e3-2986673c5cd4';

-- The desktop's second set is a pre-media draft and has no generated narration.
delete from public.exam_set_narration
where exam_set_id = '95530250-9564-4f08-97e3-2986673c5cd4';

update public.exam_set_narration as narration
set
  label = desktop.label,
  script = desktop.script,
  source = desktop.narration_source,
  media_status = 'ready',
  updated_at = now()
from (
  values
    ('section_intro', 'Speaking section introduction', 'In the Speaking section, you will answer up to 11 questions to demonstrate how well you can speak English. There are two types of tasks.', 'fixed'),
    ('listen_repeat_instructions', 'Listen and Repeat directions', 'You will listen as someone speaks to you. Listen carefully and then repeat what you have heard. The clock indicates your speaking time. There is no preparation time.', 'fixed'),
    ('listen_repeat_scenario', 'Listen and Repeat scenario', 'You are helping in a situation involving short informative updates regarding local community garden vegetable harvest schedules. Listen to the speaker and repeat what they say. Repeat only once.', 'generated'),
    ('interview_instructions', 'Take an Interview directions', 'An interviewer will ask you questions. Answer the questions and be sure to say as much as you can in the time allowed. There is no preparation time.', 'fixed'),
    ('interview_scenario', 'Take an Interview scenario', 'You have volunteered to participate in a research study about personal experiences with comfort objects and meaningful childhood home decorations. You will have a short online interview with a researcher. The researcher will ask you some questions. Please answer the interviewer''s questions.', 'generated')
) as desktop(cue_key, label, script, narration_source)
where narration.exam_set_id = 'b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c'
  and narration.cue_key = desktop.cue_key;

update public.exam_set_items as item
set
  label = source.label,
  prompt = source.prompt,
  response_seconds = source.response_seconds,
  visual_target = source.visual_target,
  audio_status = source.audio_status,
  visual_status = source.visual_status,
  video_status = source.video_status,
  updated_at = now()
from (
  values
    ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c'::uuid, 'listen_repeat', 1, 'Sentence 1', 'Our community garden will begin the main tomato harvest starting this coming Monday morning.', 12, 'tomato harvest sign', 'ready', 'ready', 'ready'),
    ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c'::uuid, 'listen_repeat', 2, 'Sentence 2', 'Please bring your own reusable baskets when you arrive to collect your share of vegetables.', 12, 'reusable harvest basket', 'ready', 'ready', 'ready'),
    ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c'::uuid, 'listen_repeat', 3, 'Sentence 3', 'The green bell peppers are ready for picking along the back fence near the shed.', 12, 'green bell peppers', 'ready', 'ready', 'ready'),
    ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c'::uuid, 'listen_repeat', 4, 'Sentence 4', 'Volunteer gardeners will be available to help beginners identify which squash plants are fully ripe.', 12, 'volunteer gardener', 'ready', 'ready', 'ready'),
    ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c'::uuid, 'listen_repeat', 5, 'Sentence 5', 'We expect a large yield of carrots this week due to the recent sunny weather.', 12, 'freshly harvested carrots', 'ready', 'ready', 'ready'),
    ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c'::uuid, 'listen_repeat', 6, 'Sentence 6', 'Garden members should record their total poundage on the clipboard located inside the gate entrance.', 12, 'clipboard at gate', 'ready', 'ready', 'ready'),
    ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c'::uuid, 'listen_repeat', 7, 'Sentence 7', 'Please remember to clear any unwanted weeds from your assigned plot before leaving the garden.', 12, 'weeding gardener', 'ready', 'ready', 'ready'),
    ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c'::uuid, 'interview', 1, 'Question 1', 'Did you have a favorite stuffed animal or toy when you were very young?', 30, '', 'ready', 'ready', 'ready'),
    ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c'::uuid, 'interview', 2, 'Question 2', 'What specific item from your childhood home brings you the most comfort today?', 30, '', 'ready', 'ready', 'ready'),
    ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c'::uuid, 'interview', 3, 'Question 3', 'Do you remember a particular decoration that made your bedroom feel safe growing up?', 45, '', 'ready', 'ready', 'ready'),
    ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c'::uuid, 'interview', 4, 'Question 4', 'Is there a small object you still keep nearby that reminds you of home?', 45, '', 'ready', 'ready', 'ready'),
    ('95530250-9564-4f08-97e3-2986673c5cd4'::uuid, 'listen_repeat', 1, 'Sentence 1', 'The community garden sprinkler system will be turned off every Tuesday for routine pump repairs.', 12, '', 'idle', 'idle', 'idle'),
    ('95530250-9564-4f08-97e3-2986673c5cd4'::uuid, 'listen_repeat', 2, 'Sentence 2', 'Please clear your gardening tools from the main pathways before the maintenance crew arrives tomorrow.', 12, '', 'idle', 'idle', 'idle'),
    ('95530250-9564-4f08-97e3-2986673c5cd4'::uuid, 'listen_repeat', 3, 'Sentence 3', 'We are adjusting our weekly watering cycle to save water during the upcoming dry summer months.', 12, '', 'idle', 'idle', 'idle'),
    ('95530250-9564-4f08-97e3-2986673c5cd4'::uuid, 'listen_repeat', 4, 'Sentence 4', 'All garden members must park their vehicles outside the main fence starting on the first of July.', 12, '', 'idle', 'idle', 'idle'),
    ('95530250-9564-4f08-97e3-2986673c5cd4'::uuid, 'listen_repeat', 5, 'Sentence 5', 'The composting bins will be closed for cleaning during the second week of the new season.', 12, '', 'idle', 'idle', 'idle'),
    ('95530250-9564-4f08-97e3-2986673c5cd4'::uuid, 'listen_repeat', 6, 'Sentence 6', 'Volunteers will install new wooden edging around the central herb garden starting this coming Friday morning.', 12, '', 'idle', 'idle', 'idle'),
    ('95530250-9564-4f08-97e3-2986673c5cd4'::uuid, 'listen_repeat', 7, 'Sentence 7', 'Please notify the garden coordinator if you notice any broken equipment near the central tool shed.', 12, '', 'idle', 'idle', 'idle'),
    ('95530250-9564-4f08-97e3-2986673c5cd4'::uuid, 'interview', 1, 'Question 1', 'What is your favorite quiet spot in the city to clear your head?', 30, '', 'idle', 'idle', 'idle'),
    ('95530250-9564-4f08-97e3-2986673c5cd4'::uuid, 'interview', 2, 'Question 2', 'Do you have a simple daily ritual that helps you feel grounded?', 30, '', 'idle', 'idle', 'idle'),
    ('95530250-9564-4f08-97e3-2986673c5cd4'::uuid, 'interview', 3, 'Question 3', 'Which local park or outdoor space do you visit to recharge your energy?', 45, '', 'idle', 'idle', 'idle'),
    ('95530250-9564-4f08-97e3-2986673c5cd4'::uuid, 'interview', 4, 'Question 4', 'What kind of music or silence do you prefer when resting at home?', 45, '', 'idle', 'idle', 'idle')
) as source(exam_set_id, module, position, label, prompt, response_seconds, visual_target, audio_status, visual_status, video_status)
where item.exam_set_id = source.exam_set_id
  and item.module = source.module
  and item.position = source.position;
