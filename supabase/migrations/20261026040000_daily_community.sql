-- What the landing page promises beyond the lesson itself (Mastery and Relatedness):
--   * 함께 쓰는 문장: one sentence per person per lesson, ☕ reactions, and 통역사 PICK
--     (terms 제9조의2). Shown to others on the same lesson with the writer's chosen
--     display name, or as 익명.
--   * 1분 퀴즈 answers, for the "같이 푼 퀴즈" numbers (shown only from 10 people) and
--     the 연속 기록 (streak) and 내 표현장 on the reader's own pages.
--   * 친구 초대 (terms 제5조의2): both people get 7 more days when the invited person
--     first pays; an inviter who is not subscribed then gets theirs at their next payment.
--
-- Sentences and quiz answers belong to the subscription that received the lesson, so the
-- existing retention and account deletion remove them with it, as the privacy notice
-- says. Additive only.

-- ------------------------------------------------------------------ sentences
create table public.daily_sentences (
  id              uuid primary key default gen_random_uuid(),
  lesson_id       uuid not null references public.daily_lessons (id) on delete cascade,
  subscription_id uuid not null references public.daily_subscriptions (id) on delete cascade,
  customer_id     uuid not null references public.daily_customers (id) on delete cascade,
  body            text not null check (char_length(trim(body)) between 2 and 200),
  -- Null shows as 익명.
  display_name    text check (display_name is null or char_length(display_name) between 1 and 12),
  -- Set by a 1cup admin: hidden sentences are shown to nobody but their writer.
  hidden_at       timestamptz,
  -- 통역사 PICK, one per lesson, set by a 1cup admin (plain uid, like lesson authors).
  picked_at       timestamptz,
  picked_by       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (lesson_id, customer_id)
);

create index daily_sentences_lesson on public.daily_sentences (lesson_id, created_at desc);
create unique index daily_sentences_one_pick_per_lesson on public.daily_sentences (lesson_id) where picked_at is not null;

create table public.daily_sentence_cups (
  sentence_id uuid not null references public.daily_sentences (id) on delete cascade,
  customer_id uuid not null references public.daily_customers (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (sentence_id, customer_id)
);

-- ------------------------------------------------------------------ quiz answers
-- The first answer counts, as on the page (the options lock once picked).
create table public.daily_quiz_answers (
  lesson_id       uuid not null references public.daily_lessons (id) on delete cascade,
  customer_id     uuid not null references public.daily_customers (id) on delete cascade,
  subscription_id uuid not null references public.daily_subscriptions (id) on delete cascade,
  choice          integer not null check (choice >= 0),
  correct         boolean not null,
  answered_at     timestamptz not null default now(),
  primary key (lesson_id, customer_id)
);

-- ------------------------------------------------------------------ invites
alter table public.daily_customers add column invite_code text unique
  check (invite_code is null or invite_code ~ '^[A-Z2-9]{8}$');
alter table public.daily_orders add column invite_code text;

create table public.daily_invites (
  -- One reward per invited person (terms: 1명당 한 번).
  invitee_customer_id uuid primary key references public.daily_customers (id) on delete cascade,
  inviter_customer_id uuid not null references public.daily_customers (id) on delete cascade,
  order_number        text not null references public.daily_orders (order_number) on delete restrict,
  invitee_rewarded_at timestamptz,
  -- Null while the inviter was not subscribed; filled at their next payment.
  inviter_rewarded_at timestamptz,
  created_at          timestamptz not null default now(),
  check (invitee_customer_id <> inviter_customer_id)
);

create index daily_invites_inviter on public.daily_invites (inviter_customer_id);

alter table public.daily_sentences     enable row level security;
alter table public.daily_sentence_cups enable row level security;
alter table public.daily_quiz_answers  enable row level security;
alter table public.daily_invites       enable row level security;

-- Applies invite rewards for a payment that just completed, once:
--   * the invited person's first payment carrying an invite code rewards both people;
--   * any reward this payer earned as an inviter while not subscribed lands now.
-- Each reward adds 7 days to the paid period the payment opened or extended.
create or replace function public.daily_apply_invite(p_order_number text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order   public.daily_orders;
  v_inviter public.daily_customers;
  v_sub     public.daily_subscriptions;
  v_pending integer;
  v_applied integer := 0;
begin
  select * into v_order from public.daily_orders where order_number = p_order_number;
  if not found or v_order.status <> 'completed' or v_order.subscription_id is null then
    return 0;
  end if;

  -- 1. This payment was invited.
  if v_order.kind = 'checkout' and v_order.invite_code is not null
     and not exists (select 1 from public.daily_orders o
                      where o.customer_id = v_order.customer_id and o.status = 'completed'
                        and o.order_number <> v_order.order_number
                        and o.completed_at < v_order.completed_at) then
    select * into v_inviter from public.daily_customers
     where invite_code = v_order.invite_code and deleted_at is null and id <> v_order.customer_id;
    if found then
      insert into public.daily_invites (invitee_customer_id, inviter_customer_id, order_number, invitee_rewarded_at)
      values (v_order.customer_id, v_inviter.id, v_order.order_number, now())
      on conflict (invitee_customer_id) do nothing;
      if found then
        update public.daily_subscriptions set paid_until = paid_until + interval '7 days'
         where id = v_order.subscription_id and paid_until is not null;
        v_applied := v_applied + 1;
        -- The inviter's reward goes on their live paid period, the one ending last.
        select * into v_sub from public.daily_subscriptions
         where customer_id = v_inviter.id and status = 'active' and paid_until > now()
         order by paid_until desc limit 1 for update;
        if found then
          update public.daily_subscriptions set paid_until = paid_until + interval '7 days' where id = v_sub.id;
          update public.daily_invites set inviter_rewarded_at = now() where invitee_customer_id = v_order.customer_id;
        end if;
      end if;
    end if;
  end if;

  -- 2. Rewards this payer earned as an inviter while not subscribed.
  with pending as (
    update public.daily_invites set inviter_rewarded_at = now()
     where inviter_customer_id = v_order.customer_id and inviter_rewarded_at is null
       and invitee_customer_id <> v_order.customer_id
    returning 1
  )
  select count(*) into v_pending from pending;
  if v_pending > 0 then
    update public.daily_subscriptions set paid_until = paid_until + make_interval(days => 7 * v_pending)
     where id = v_order.subscription_id and paid_until is not null;
    v_applied := v_applied + v_pending;
  end if;
  return v_applied;
end;
$$;

-- Account deletion, now also removing reactions, invites and the invite code. Sentences
-- and quiz answers go with the subscriptions, as before.
create or replace function public.daily_delete_account(p_customer_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.daily_customers;
begin
  select * into v_customer from public.daily_customers where id = p_customer_id for update;
  if not found or v_customer.deleted_at is not null then
    return 'already-deleted';
  end if;
  if exists (select 1 from public.daily_refunds r
              where r.customer_id = p_customer_id and r.status in ('requested', 'refunding')) then
    raise exception 'refund-open' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.daily_subscriptions s
              where s.customer_id = p_customer_id and s.status = 'active' and s.auto_renew) then
    raise exception 'billing-stop-required' using errcode = 'P0001';
  end if;

  delete from public.daily_reviews where customer_id = p_customer_id;
  delete from public.daily_sentence_cups where customer_id = p_customer_id;
  delete from public.daily_invites where invitee_customer_id = p_customer_id or inviter_customer_id = p_customer_id;
  -- Deliveries, sentences and quiz answers go with their subscriptions; orders and trial
  -- claims keep their rows.
  delete from public.daily_subscriptions where customer_id = p_customer_id;
  delete from public.daily_sessions where customer_id = p_customer_id;
  delete from public.daily_otp_codes where phone = v_customer.phone;

  if exists (select 1 from public.daily_orders o where o.customer_id = p_customer_id)
     or exists (select 1 from public.daily_refunds r where r.customer_id = p_customer_id) then
    update public.daily_orders
       set billing_key = null, payment_result = private.daily_strip_payer(payment_result), invite_code = null
     where customer_id = p_customer_id;
    update public.daily_refunds
       set payment_result = private.daily_strip_payer(payment_result)
     where customer_id = p_customer_id;
    update public.daily_customers
       set phone = null, name = null, last_login_at = null, invite_code = null, deleted_at = now()
     where id = p_customer_id;
    return 'anonymized';
  end if;

  delete from public.daily_customers where id = p_customer_id;
  return 'deleted';
end;
$$;

revoke execute on function public.daily_apply_invite(text) from public, anon, authenticated;
grant execute on function public.daily_apply_invite(text) to service_role;
