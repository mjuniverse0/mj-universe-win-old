-- MJ Universe: poll, spørsmål, events, milepæler + admin (authenticated)
-- Kjør i SQL Editor etter setup-views-supabase.sql
-- ADMIN: Gå til Authentication → Users → Add user
--   E-post: mariellogjhonatan@mj-universe.site  (må matche MJ_ADMIN_EMAIL i supabase-config.js)
--   Passord: sett selv (lagre trygt – ikke i Git / ikke i frontend-kode)

create extension if not exists "pgcrypto";

-- --- Polls ---
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  label text not null,
  sort_order int not null default 0
);

create table if not exists public.poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  voter_name text not null,
  device_id text not null,
  created_at timestamptz not null default now(),
  unique (poll_id, device_id)
);

create index if not exists poll_votes_poll_id_idx on public.poll_votes (poll_id);

-- --- Visitor questions ---
create table if not exists public.visitor_questions (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  from_name text not null,
  created_at timestamptz not null default now(),
  answer text,
  answered_at timestamptz
);

-- --- Events (giveaway etc.) ---
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  event_type text not null default 'other' check (event_type in ('giveaway', 'other')),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- --- Milestones (timeline) ---
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  milestone_date date not null,
  sort_order int not null default 0
);

-- --- RLS ---
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.visitor_questions enable row level security;
alter table public.events enable row level security;
alter table public.milestones enable row level security;

-- Polls: public reads active only
drop policy if exists "polls_select_active" on public.polls;
create policy "polls_select_active" on public.polls
  for select to anon using (is_active = true);

drop policy if exists "polls_all_authenticated" on public.polls;
create policy "polls_all_authenticated" on public.polls
  for all to authenticated using (true) with check (true);

-- Options: public if parent poll active
drop policy if exists "poll_options_select_anon" on public.poll_options;
create policy "poll_options_select_anon" on public.poll_options
  for select to anon
  using (exists (select 1 from public.polls p where p.id = poll_id and p.is_active = true));

drop policy if exists "poll_options_all_authenticated" on public.poll_options;
create policy "poll_options_all_authenticated" on public.poll_options
  for all to authenticated using (true) with check (true);

-- Votes: anon insert only if poll active + valid name/device
drop policy if exists "poll_votes_insert_anon" on public.poll_votes;
create policy "poll_votes_insert_anon" on public.poll_votes
  for insert to anon
  with check (
    length(trim(voter_name)) >= 1
    and length(device_id) >= 8
    and exists (select 1 from public.polls p where p.id = poll_id and p.is_active = true)
    and exists (
      select 1 from public.poll_options o
      where o.id = option_id and o.poll_id = poll_votes.poll_id
    )
  );

drop policy if exists "poll_votes_all_authenticated" on public.poll_votes;
create policy "poll_votes_all_authenticated" on public.poll_votes
  for all to authenticated using (true) with check (true);

-- Visitor questions
drop policy if exists "visitor_questions_insert_anon" on public.visitor_questions;
create policy "visitor_questions_insert_anon" on public.visitor_questions
  for insert to anon
  with check (length(trim(body)) >= 2 and length(trim(from_name)) >= 1);

drop policy if exists "visitor_questions_all_authenticated" on public.visitor_questions;
create policy "visitor_questions_all_authenticated" on public.visitor_questions
  for all to authenticated using (true) with check (true);

-- Events: public sees active within window
drop policy if exists "events_select_anon" on public.events;
create policy "events_select_anon" on public.events
  for select to anon
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

drop policy if exists "events_all_authenticated" on public.events;
create policy "events_all_authenticated" on public.events
  for all to authenticated using (true) with check (true);

-- Milestones: public read all (ordered in app)
drop policy if exists "milestones_select_anon" on public.milestones;
create policy "milestones_select_anon" on public.milestones
  for select to anon using (true);

drop policy if exists "milestones_all_authenticated" on public.milestones;
create policy "milestones_all_authenticated" on public.milestones
  for all to authenticated using (true) with check (true);

-- Aggregated poll results (no voter names to public)
create or replace function public.get_poll_results(p_poll_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'option_id', o.id,
        'label', o.label,
        'votes', coalesce(v.cnt, 0)
      )
      order by o.sort_order, o.label
    ),
    '[]'::jsonb
  )
  from public.poll_options o
  left join (
    select option_id, count(*)::int as cnt
    from public.poll_votes
    where poll_id = p_poll_id
    group by option_id
  ) v on v.option_id = o.id
  where o.poll_id = p_poll_id;
$$;

grant execute on function public.get_poll_results(uuid) to anon, authenticated;

-- API-tilgang (RLS styrer hva som faktisk er lov)
grant usage on schema public to anon, authenticated;

grant select on public.polls to anon;
grant select on public.poll_options to anon;
grant insert on public.poll_votes to anon;
grant insert on public.visitor_questions to anon;
grant select on public.events to anon;
grant select on public.milestones to anon;

grant all privileges on table public.polls to authenticated;
grant all privileges on table public.poll_options to authenticated;
grant all privileges on table public.poll_votes to authenticated;
grant all privileges on table public.visitor_questions to authenticated;
grant all privileges on table public.events to authenticated;
grant all privileges on table public.milestones to authenticated;
