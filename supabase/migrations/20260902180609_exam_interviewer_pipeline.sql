-- Web-native replacement for the retired Test Center factory. The desktop
-- prototype kept candidates and exam media in a single browser workspace;
-- these tables keep the authoring workflow durable and independently auditable.

create table public.exam_interviewers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  gender text not null check (gender in ('Female', 'Male', 'Nonbinary')),
  occupation text not null check (char_length(occupation) between 2 and 120),
  attire text not null check (char_length(attire) between 2 and 120),
  personality text not null check (char_length(personality) between 2 and 120),
  voice_tone text not null check (char_length(voice_tone) between 2 and 80),
  avatar_key text not null check (avatar_key ~ '^[a-z0-9-]+$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  image_status text not null default 'ready' check (image_status in ('idle', 'generating', 'ready', 'failed')),
  video_status text not null default 'ready' check (video_status in ('idle', 'generating', 'ready', 'failed')),
  media_mode text not null default 'browser_preview' check (media_mode in ('browser_preview', 'uploaded', 'generated')),
  source_metadata jsonb not null default '{}'::jsonb,
  created_by text references public.users(uid) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.exam_sets (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 140),
  interviewer_id uuid not null references public.exam_interviewers(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'media_ready', 'published', 'archived')),
  format_version text not null default 'exam-interviewer-pipeline-v1',
  listen_repeat_theme text not null default '',
  interview_theme text not null default '',
  scene_description text not null default '',
  media_mode text not null default 'browser_preview' check (media_mode in ('browser_preview', 'uploaded', 'generated')),
  published_at timestamp with time zone,
  created_by text references public.users(uid) on delete set null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create table public.exam_set_narration (
  id uuid primary key default gen_random_uuid(),
  exam_set_id uuid not null references public.exam_sets(id) on delete cascade,
  cue_key text not null check (cue_key in ('section_intro', 'listen_repeat_instructions', 'listen_repeat_scenario', 'interview_instructions', 'interview_scenario')),
  label text not null,
  script text not null check (char_length(script) between 1 and 2000),
  source text not null check (source in ('fixed', 'authored', 'generated')),
  media_status text not null default 'ready' check (media_status in ('idle', 'generating', 'ready', 'failed')),
  position smallint not null check (position between 1 and 10),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (exam_set_id, cue_key),
  unique (exam_set_id, position)
);

create table public.exam_set_items (
  id uuid primary key default gen_random_uuid(),
  exam_set_id uuid not null references public.exam_sets(id) on delete cascade,
  module text not null check (module in ('listen_repeat', 'interview')),
  position smallint not null check (position between 1 and 20),
  label text not null,
  prompt text not null check (char_length(prompt) between 1 and 2000),
  response_seconds smallint not null check (response_seconds between 5 and 180),
  visual_target text not null default '',
  audio_status text not null default 'ready' check (audio_status in ('idle', 'generating', 'ready', 'failed')),
  visual_status text not null default 'ready' check (visual_status in ('idle', 'generating', 'ready', 'failed')),
  video_status text not null default 'ready' check (video_status in ('idle', 'generating', 'ready', 'failed')),
  media_mode text not null default 'browser_preview' check (media_mode in ('browser_preview', 'uploaded', 'generated')),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (exam_set_id, module, position)
);

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_set_id uuid not null references public.exam_sets(id) on delete restrict,
  user_id text not null default public.current_uid() references public.users(uid) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  response_count smallint not null default 0 check (response_count between 0 and 20),
  responses jsonb not null default '[]'::jsonb,
  started_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index exam_interviewers_status_updated_idx on public.exam_interviewers (status, updated_at desc);
create index exam_sets_interviewer_updated_idx on public.exam_sets (interviewer_id, updated_at desc);
create index exam_sets_status_updated_idx on public.exam_sets (status, updated_at desc);
create index exam_set_narration_set_position_idx on public.exam_set_narration (exam_set_id, position);
create index exam_set_items_set_module_position_idx on public.exam_set_items (exam_set_id, module, position);
create index exam_attempts_user_completed_idx on public.exam_attempts (user_id, completed_at desc);

alter table public.exam_interviewers enable row level security;
alter table public.exam_sets enable row level security;
alter table public.exam_set_narration enable row level security;
alter table public.exam_set_items enable row level security;
alter table public.exam_attempts enable row level security;

revoke all on table public.exam_interviewers from anon, authenticated;
revoke all on table public.exam_sets from anon, authenticated;
revoke all on table public.exam_set_narration from anon, authenticated;
revoke all on table public.exam_set_items from anon, authenticated;
revoke all on table public.exam_attempts from anon, authenticated;

grant select on table public.exam_attempts to authenticated;
create policy "members read their own exam attempts"
  on public.exam_attempts for select to authenticated
  using (user_id = public.current_uid());

-- These are the three approved interviewers and two practice sets created in
-- desktop/exam-interviewer-pipeline. Browser-native preview media replaces the
-- provider-hosted data URLs and temporary Veo references from the local app.
insert into public.exam_interviewers (
  id, name, gender, occupation, attire, personality, voice_tone, avatar_key,
  status, image_status, video_status, media_mode, source_metadata
) values
  ('34bdb7a9-dc04-4494-ab80-672b4ab1b919', 'Elena Rodriguez', 'Female', 'Psychologist', 'cream sweater', 'compassionate', 'warm', 'elena-rodriguez', 'approved', 'ready', 'ready', 'browser_preview', '{"source":"desktop/exam-interviewer-pipeline"}'::jsonb),
  ('4e946ca0-f9d5-4ab6-8b81-228dab74fb0e', 'Robert Vance', 'Male', 'Executive', 'charcoal suit', 'assertive', 'authoritative', 'robert-vance', 'approved', 'ready', 'ready', 'browser_preview', '{"source":"desktop/exam-interviewer-pipeline"}'::jsonb),
  ('7528b4bd-3345-4e71-8d16-f1355b052af2', 'David Chen', 'Male', 'Producer', 'black hoodie', 'focused', 'crisp', 'david-chen', 'approved', 'ready', 'ready', 'browser_preview', '{"source":"desktop/exam-interviewer-pipeline"}'::jsonb)
on conflict (id) do update set
  name = excluded.name,
  gender = excluded.gender,
  occupation = excluded.occupation,
  attire = excluded.attire,
  personality = excluded.personality,
  voice_tone = excluded.voice_tone,
  avatar_key = excluded.avatar_key,
  status = excluded.status,
  image_status = excluded.image_status,
  video_status = excluded.video_status,
  media_mode = excluded.media_mode,
  source_metadata = excluded.source_metadata,
  updated_at = now();

insert into public.exam_sets (
  id, title, interviewer_id, status, listen_repeat_theme, interview_theme,
  scene_description, media_mode, published_at
) values
  (
    'b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c',
    'Community garden harvest',
    '34bdb7a9-dc04-4494-ab80-672b4ab1b919',
    'published',
    'short informative updates regarding local community garden vegetable harvest schedules',
    'personal experiences with comfort objects and meaningful childhood home decorations',
    'A sunny community garden with harvest crates, a greenhouse, volunteers, and a notice board.',
    'browser_preview',
    now()
  ),
  (
    '95530250-9564-4f08-97e3-2986673c5cd4',
    'Community garden maintenance',
    '34bdb7a9-dc04-4494-ab80-672b4ab1b919',
    'draft',
    'brief announcements regarding changes to local community garden maintenance schedules',
    'personal perspectives on finding moments of calm within busy urban environments',
    'A community garden being prepared for a new growing season.',
    'browser_preview',
    null
  )
on conflict (id) do update set
  title = excluded.title,
  interviewer_id = excluded.interviewer_id,
  status = excluded.status,
  listen_repeat_theme = excluded.listen_repeat_theme,
  interview_theme = excluded.interview_theme,
  scene_description = excluded.scene_description,
  media_mode = excluded.media_mode,
  published_at = excluded.published_at,
  updated_at = now();

insert into public.exam_set_narration (exam_set_id, cue_key, label, script, source, media_status, position) values
  ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c', 'section_intro', 'Speaking section introduction', 'In the Speaking section, you will answer up to 11 questions to demonstrate how well you can speak English. There are two types of tasks.', 'fixed', 'ready', 1),
  ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c', 'listen_repeat_instructions', 'Listen and Repeat directions', 'You will listen as someone speaks to you. Listen carefully and then repeat what you have heard. The clock indicates your speaking time. There is no preparation time.', 'fixed', 'ready', 2),
  ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c', 'listen_repeat_scenario', 'Listen and Repeat scenario', 'You are helping in a situation involving short informative updates regarding local community garden vegetable harvest schedules. Listen to the speaker and repeat what they say. Repeat only once.', 'authored', 'ready', 3),
  ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c', 'interview_instructions', 'Take an Interview directions', 'An interviewer will ask you questions. Answer the questions and be sure to say as much as you can in the time allowed. There is no preparation time.', 'fixed', 'ready', 4),
  ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c', 'interview_scenario', 'Take an Interview scenario', 'You have volunteered to participate in a research study about personal experiences with comfort objects and meaningful childhood home decorations. You will have a short online interview with a researcher. The researcher will ask you some questions. Please answer the interviewer''s questions.', 'authored', 'ready', 5),
  ('95530250-9564-4f08-97e3-2986673c5cd4', 'section_intro', 'Speaking section introduction', 'In the Speaking section, you will answer up to 11 questions to demonstrate how well you can speak English. There are two types of tasks.', 'fixed', 'idle', 1),
  ('95530250-9564-4f08-97e3-2986673c5cd4', 'listen_repeat_instructions', 'Listen and Repeat directions', 'You will listen as someone speaks to you. Listen carefully and then repeat what you have heard. The clock indicates your speaking time. There is no preparation time.', 'fixed', 'idle', 2),
  ('95530250-9564-4f08-97e3-2986673c5cd4', 'listen_repeat_scenario', 'Listen and Repeat scenario', 'You are helping in a situation involving brief announcements regarding changes to local community garden maintenance schedules. Listen to the speaker and repeat what they say. Repeat only once.', 'authored', 'idle', 3),
  ('95530250-9564-4f08-97e3-2986673c5cd4', 'interview_instructions', 'Take an Interview directions', 'An interviewer will ask you questions. Answer the questions and be sure to say as much as you can in the time allowed. There is no preparation time.', 'fixed', 'idle', 4),
  ('95530250-9564-4f08-97e3-2986673c5cd4', 'interview_scenario', 'Take an Interview scenario', 'You have volunteered to participate in a research study about personal perspectives on finding moments of calm within busy urban environments. You will have a short online interview with a researcher. The researcher will ask you some questions. Please answer the interviewer''s questions.', 'authored', 'idle', 5)
on conflict (exam_set_id, cue_key) do update set
  label = excluded.label, script = excluded.script, source = excluded.source,
  media_status = excluded.media_status, position = excluded.position, updated_at = now();

insert into public.exam_set_items (
  exam_set_id, module, position, label, prompt, response_seconds, visual_target,
  audio_status, visual_status, video_status, media_mode
) values
  ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c', 'listen_repeat', 1, 'Sentence 1', 'Our community garden will begin the main tomato harvest starting this coming Monday morning.', 12, 'tomato harvest sign', 'ready', 'ready', 'ready', 'browser_preview'),
  ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c', 'listen_repeat', 2, 'Sentence 2', 'Please bring your own reusable baskets when you arrive to collect your share of vegetables.', 12, 'reusable harvest basket', 'ready', 'ready', 'ready', 'browser_preview'),
  ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c', 'listen_repeat', 3, 'Sentence 3', 'The green bell peppers are ready for picking along the back fence near the shed.', 12, 'green bell peppers', 'ready', 'ready', 'ready', 'browser_preview'),
  ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c', 'listen_repeat', 4, 'Sentence 4', 'Volunteer gardeners will be available to help beginners identify which squash plants are fully ripe.', 12, 'volunteer gardener', 'ready', 'ready', 'ready', 'browser_preview'),
  ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c', 'listen_repeat', 5, 'Sentence 5', 'We expect a large yield of carrots this week due to the recent sunny weather.', 12, 'freshly harvested carrots', 'ready', 'ready', 'ready', 'browser_preview'),
  ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c', 'listen_repeat', 6, 'Sentence 6', 'Garden members should record their total poundage on the clipboard located inside the gate entrance.', 12, 'clipboard at gate', 'ready', 'ready', 'ready', 'browser_preview'),
  ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c', 'listen_repeat', 7, 'Sentence 7', 'Please remember to clear any unwanted weeds from your assigned plot before leaving the garden.', 12, 'weeding gardener', 'ready', 'ready', 'ready', 'browser_preview'),
  ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c', 'interview', 1, 'Question 1', 'Did you have a favorite stuffed animal or toy when you were very young?', 30, '', 'ready', 'ready', 'ready', 'browser_preview'),
  ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c', 'interview', 2, 'Question 2', 'What specific item from your childhood home brings you the most comfort today?', 30, '', 'ready', 'ready', 'ready', 'browser_preview'),
  ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c', 'interview', 3, 'Question 3', 'Do you remember a particular decoration that made your bedroom feel safe growing up?', 45, '', 'ready', 'ready', 'ready', 'browser_preview'),
  ('b5a2ebfd-3b5b-4550-8ad9-cdb2f65e057c', 'interview', 4, 'Question 4', 'Is there a small object you still keep nearby that reminds you of home?', 45, '', 'ready', 'ready', 'ready', 'browser_preview'),
  ('95530250-9564-4f08-97e3-2986673c5cd4', 'listen_repeat', 1, 'Sentence 1', 'The community garden sprinkler system will be turned off every Tuesday for routine pump repairs.', 12, 'garden sprinkler', 'idle', 'idle', 'idle', 'browser_preview'),
  ('95530250-9564-4f08-97e3-2986673c5cd4', 'listen_repeat', 2, 'Sentence 2', 'Please clear your gardening tools from the main pathways before the maintenance crew arrives tomorrow.', 12, 'garden tools', 'idle', 'idle', 'idle', 'browser_preview'),
  ('95530250-9564-4f08-97e3-2986673c5cd4', 'listen_repeat', 3, 'Sentence 3', 'We are adjusting our weekly watering cycle to save water during the upcoming dry summer months.', 12, 'watering cycle', 'idle', 'idle', 'idle', 'browser_preview'),
  ('95530250-9564-4f08-97e3-2986673c5cd4', 'listen_repeat', 4, 'Sentence 4', 'All garden members must park their vehicles outside the main fence starting on the first of July.', 12, 'garden fence', 'idle', 'idle', 'idle', 'browser_preview'),
  ('95530250-9564-4f08-97e3-2986673c5cd4', 'listen_repeat', 5, 'Sentence 5', 'The composting bins will be closed for cleaning during the second week of the new season.', 12, 'compost bins', 'idle', 'idle', 'idle', 'browser_preview'),
  ('95530250-9564-4f08-97e3-2986673c5cd4', 'listen_repeat', 6, 'Sentence 6', 'Volunteers will install new wooden edging around the central herb garden starting this coming Friday morning.', 12, 'herb garden', 'idle', 'idle', 'idle', 'browser_preview'),
  ('95530250-9564-4f08-97e3-2986673c5cd4', 'listen_repeat', 7, 'Sentence 7', 'Please notify the garden coordinator if you notice any broken equipment near the central tool shed.', 12, 'tool shed', 'idle', 'idle', 'idle', 'browser_preview'),
  ('95530250-9564-4f08-97e3-2986673c5cd4', 'interview', 1, 'Question 1', 'What is your favorite quiet spot in the city to clear your head?', 30, '', 'idle', 'idle', 'idle', 'browser_preview'),
  ('95530250-9564-4f08-97e3-2986673c5cd4', 'interview', 2, 'Question 2', 'Do you have a simple daily ritual that helps you feel grounded?', 30, '', 'idle', 'idle', 'idle', 'browser_preview'),
  ('95530250-9564-4f08-97e3-2986673c5cd4', 'interview', 3, 'Question 3', 'Which local park or outdoor space do you visit to recharge your energy?', 45, '', 'idle', 'idle', 'idle', 'browser_preview'),
  ('95530250-9564-4f08-97e3-2986673c5cd4', 'interview', 4, 'Question 4', 'What kind of music or silence do you prefer when resting at home?', 45, '', 'idle', 'idle', 'idle', 'browser_preview')
on conflict (exam_set_id, module, position) do update set
  label = excluded.label, prompt = excluded.prompt, response_seconds = excluded.response_seconds,
  visual_target = excluded.visual_target, audio_status = excluded.audio_status,
  visual_status = excluded.visual_status, video_status = excluded.video_status,
  media_mode = excluded.media_mode, updated_at = now();
