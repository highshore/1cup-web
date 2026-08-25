-- Link future completed responses to the published bank item and test set that
-- served them. Existing v2 practice attempts remain valid and simply have no
-- bank linkage, so Test Center can distinguish legacy format metrics.

alter table public.speaking_test_attempts
  add column question_set_id uuid references public.speaking_question_sets(id) on delete set null;

alter table public.speaking_test_responses
  add column question_id uuid references public.speaking_question_bank(id) on delete set null;

create index speaking_test_attempts_question_set_completed_idx
  on public.speaking_test_attempts (question_set_id, completed_at desc)
  where question_set_id is not null;

create index speaking_test_responses_question_idx
  on public.speaking_test_responses (question_id)
  where question_id is not null;
