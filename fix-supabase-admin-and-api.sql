-- =============================================================================
-- MJ Universe - FIX: admin (authenticated) + API
-- Kjør hele filen i Supabase → SQL Editor → Run én gang (trygt å kjøre flere ganger)
--
-- Dette løser ofte:
--   - Admin-dashboard får ikke lest/skrevet tabeller (manglende GRANT / RLS)
--   - page_views manglet policy for innlogget bruker
--   - views_last_24h() mangler rettighet for authenticated
--
-- ADMIN-BRUKER opprettes IKKE her - gjør det i Dashboard:
--   Authentication → Users → Add user
--   E-post: mariellogjhonatan@mj-universe.site  (samme som MJ_ADMIN_EMAIL i supabase-config.js)
--   Passord: ditt valg
--   Authentication → Providers → Email: skru av "Confirm email" for enkel testing, eller bekreft brukeren
-- =============================================================================

-- Schema
grant usage on schema public to anon, authenticated;

-- -----------------------------------------------------------------------------
-- page_views (visningsteller) - idempotent policies
-- -----------------------------------------------------------------------------
alter table if exists public.page_views enable row level security;

drop policy if exists "page_views_insert_anon" on public.page_views;
drop policy if exists "page_views_no_select_anon" on public.page_views;
drop policy if exists "page_views_all_authenticated" on public.page_views;

create policy "page_views_insert_anon"
  on public.page_views for insert to anon with check (true);

create policy "page_views_no_select_anon"
  on public.page_views for select to anon using (false);

create policy "page_views_all_authenticated"
  on public.page_views for all to authenticated using (true) with check (true);

grant insert on public.page_views to anon;
grant select, insert, update, delete on public.page_views to authenticated;

-- Funksjon teller (RPC)
grant execute on function public.views_last_24h() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Polls / options / votes / visitor_questions / events / milestones
-- (re-applier GRANT + RLS policies hvis noe mangler etter første oppsett)
-- -----------------------------------------------------------------------------
alter table if exists public.polls enable row level security;
alter table if exists public.poll_options enable row level security;
alter table if exists public.poll_votes enable row level security;
alter table if exists public.visitor_questions enable row level security;
alter table if exists public.events enable row level security;
alter table if exists public.events add column if not exists winner_slots int;
alter table if exists public.milestones enable row level security;
-- giveaway_entries (full oppsett hvis du ikke har kjørt setup-giveaway-entries.sql)
create table if not exists public.giveaway_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  device_id text not null,
  snap_username text not null,
  reaction_emoji text not null,
  created_at timestamptz not null default now(),
  unique (event_id, device_id),
  constraint giveaway_entries_snap_len check (
    char_length(trim(snap_username)) between 2 and 32
    and trim(snap_username) ~ '^[a-zA-Z0-9._-]+$'
  ),
  constraint giveaway_entries_emoji_allowed check (
    reaction_emoji in ('🎉', '💜', '✨', '🙌', '🔥', '💖', '⭐', '🎁')
  )
);
create index if not exists giveaway_entries_event_id_idx on public.giveaway_entries (event_id);

create or replace function public.get_giveaway_reaction_counts(p_event_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('emoji', reaction_emoji, 'count', cnt)
      order by reaction_emoji
    ),
    '[]'::jsonb
  )
  from (
    select reaction_emoji, count(*)::int as cnt
    from public.giveaway_entries
    where event_id = p_event_id
    group by reaction_emoji
  ) s;
$$;

create or replace function public.get_giveaway_page_info(p_event_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'found', true,
        'id', e.id,
        'title', e.title,
        'body', coalesce(e.body, ''),
        'winner_count', e.winner_slots,
        'entry_ready', (e.winner_slots is not null and char_length(trim(coalesce(e.body, ''))) >= 2),
        'starts_at', to_jsonb(e.starts_at),
        'ends_at', to_jsonb(e.ends_at),
        'is_active', e.is_active,
        'can_enter',
          e.is_active
          and e.event_type = 'giveaway'
          and e.winner_slots is not null
          and char_length(trim(coalesce(e.body, ''))) >= 2
          and (e.starts_at is null or e.starts_at <= now())
          and (e.ends_at is null or e.ends_at >= now()),
        'ended',
          e.event_type = 'giveaway'
          and (
            not e.is_active
            or (e.ends_at is not null and e.ends_at < now())
          )
      )
      from public.events e
      where e.id = p_event_id and e.event_type = 'giveaway'
    ),
    '{"found":false}'::jsonb
  );
$$;

-- Påmelding (Snapchat); p_reaction_emoji kan være null → lagres som 🎁. Krever winner_slots + body (premie).
create or replace function public.giveaway_enter(
  p_event_id uuid,
  p_device_id text,
  p_snap_username text,
  p_reaction_emoji text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slots int;
  v_new_id uuid;
  v_pos int;
  v_snap text;
  v_emoji text;
begin
  if p_event_id is null or p_device_id is null or length(trim(p_device_id)) < 8 then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;

  v_snap := regexp_replace(lower(trim(both from coalesce(p_snap_username, ''))), '^@+', '');

  if length(v_snap) < 2 or length(v_snap) > 32 or v_snap !~ '^[a-zA-Z0-9._-]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_snap');
  end if;

  v_emoji := nullif(trim(both from coalesce(p_reaction_emoji, '')), '');
  if v_emoji is null then
    v_emoji := E'\U0001F381';
  elsif v_emoji not in (
    E'\U0001F389', E'\U0001F49C', E'\U00002728', E'\U0001F64C',
    E'\U0001F525', E'\U0001F496', E'\U00002B50', E'\U0001F381'
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_emoji');
  end if;

  select e.winner_slots into v_slots
  from public.events e
  where e.id = p_event_id
    and e.event_type = 'giveaway'
    and e.is_active = true
    and (e.starts_at is null or e.starts_at <= now())
    and (e.ends_at is null or e.ends_at >= now());

  if not found then
    return jsonb_build_object('ok', false, 'error', 'event_not_available');
  end if;

  if v_slots is null then
    return jsonb_build_object('ok', false, 'error', 'giveaway_not_configured');
  end if;

  if exists (
    select 1 from public.giveaway_entries g
    where g.event_id = p_event_id and g.device_id = p_device_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;

  insert into public.giveaway_entries (event_id, device_id, snap_username, reaction_emoji)
  values (p_event_id, p_device_id, v_snap, v_emoji)
  returning id into v_new_id;

  select sub.pos into v_pos
  from (
    select id, row_number() over (order by created_at asc, id asc) as pos
    from public.giveaway_entries
    where event_id = p_event_id
  ) sub
  where sub.id = v_new_id;

  return jsonb_build_object(
    'ok', true,
    'position', v_pos,
    'winner_count', to_jsonb(v_slots)
  );
end;
$$;

alter table public.giveaway_entries enable row level security;

-- polls
drop policy if exists "polls_select_active" on public.polls;
create policy "polls_select_active" on public.polls
  for select to anon using (is_active = true);

drop policy if exists "polls_all_authenticated" on public.polls;
create policy "polls_all_authenticated" on public.polls
  for all to authenticated using (true) with check (true);

-- poll_options
drop policy if exists "poll_options_select_anon" on public.poll_options;
create policy "poll_options_select_anon" on public.poll_options
  for select to anon
  using (exists (select 1 from public.polls p where p.id = poll_id and p.is_active = true));

drop policy if exists "poll_options_all_authenticated" on public.poll_options;
create policy "poll_options_all_authenticated" on public.poll_options
  for all to authenticated using (true) with check (true);

-- poll_votes
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

-- visitor_questions (legacy / admin)
drop policy if exists "visitor_questions_insert_anon" on public.visitor_questions;
create policy "visitor_questions_insert_anon" on public.visitor_questions
  for insert to anon
  with check (length(trim(body)) >= 2 and length(trim(from_name)) >= 1);

drop policy if exists "visitor_questions_all_authenticated" on public.visitor_questions;
create policy "visitor_questions_all_authenticated" on public.visitor_questions
  for all to authenticated using (true) with check (true);

-- events
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

-- milestones
drop policy if exists "milestones_select_anon" on public.milestones;
create policy "milestones_select_anon" on public.milestones
  for select to anon using (true);

drop policy if exists "milestones_all_authenticated" on public.milestones;
create policy "milestones_all_authenticated" on public.milestones
  for all to authenticated using (true) with check (true);

-- giveaway_entries (tabellen opprettes i setup-giveaway-entries.sql)
drop policy if exists "giveaway_entries_insert_anon" on public.giveaway_entries;
create policy "giveaway_entries_insert_anon" on public.giveaway_entries
  for insert to anon
  with check (
    length(device_id) >= 8
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and e.is_active = true
        and e.event_type = 'giveaway'
        and (e.starts_at is null or e.starts_at <= now())
        and (e.ends_at is null or e.ends_at >= now())
    )
  );

drop policy if exists "giveaway_entries_no_select_anon" on public.giveaway_entries;
create policy "giveaway_entries_no_select_anon" on public.giveaway_entries
  for select to anon using (false);

drop policy if exists "giveaway_entries_all_authenticated" on public.giveaway_entries;
create policy "giveaway_entries_all_authenticated" on public.giveaway_entries
  for all to authenticated using (true) with check (true);

-- Tabellrettigheter (PostgREST / JS-klient)
grant select on public.polls to anon;
grant select on public.poll_options to anon;
grant insert on public.poll_votes to anon;
grant insert on public.visitor_questions to anon;
grant select on public.events to anon;
grant select on public.milestones to anon;
grant insert on public.giveaway_entries to anon;

grant all privileges on table public.polls to authenticated;
grant all privileges on table public.poll_options to authenticated;
grant all privileges on table public.poll_votes to authenticated;
grant all privileges on table public.visitor_questions to authenticated;
grant all privileges on table public.events to authenticated;
grant all privileges on table public.milestones to authenticated;
grant all privileges on table public.giveaway_entries to authenticated;

-- poll RPC
grant execute on function public.get_poll_results(uuid) to anon, authenticated;

-- Offentlig deltakerliste (Snapchat-brukernavn for alle som har giveaway-ID)
create or replace function public.get_giveaway_public_roster(p_event_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select case
    when not exists (
      select 1 from public.events e
      where e.id = p_event_id and e.event_type = 'giveaway'
    ) then jsonb_build_object('ok', false, 'error', 'not_found')
    else (
      select jsonb_build_object(
        'ok', true,
        'count', coalesce(
          (select count(*)::int from public.giveaway_entries g where g.event_id = p_event_id),
          0
        ),
        'entrants', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'snap_username', g.snap_username,
                'joined_at', g.created_at
              )
              order by g.created_at asc, g.id asc
            )
            from public.giveaway_entries g
            where g.event_id = p_event_id
          ),
          '[]'::jsonb
        )
      )
    )
  end;
$$;

-- giveaway RPC (kun hvis funksjonen finnes)
grant execute on function public.get_giveaway_reaction_counts(uuid) to anon, authenticated;
grant execute on function public.get_giveaway_page_info(uuid) to anon, authenticated;
grant execute on function public.giveaway_enter(uuid, text, text, text) to anon, authenticated;
grant execute on function public.get_giveaway_public_roster(uuid) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- site_live_status (LIVE-badge + live/live.html)
-- -----------------------------------------------------------------------------
create table if not exists public.site_live_status (
  id smallint primary key default 1,
  constraint site_live_status_single_row check (id = 1),
  is_live boolean not null default false,
  embed_url text,
  tiktok_username text,
  tiktok_username_secondary text,
  updated_at timestamptz not null default now()
);

alter table public.site_live_status add column if not exists tiktok_username_secondary text;

insert into public.site_live_status (id, is_live, tiktok_username, tiktok_username_secondary)
values (1, false, 'berntzenmariell', 'mj_universe1')
on conflict (id) do nothing;

update public.site_live_status
set tiktok_username_secondary = 'mj_universe1'
where id = 1 and tiktok_username_secondary is null;

alter table public.site_live_status enable row level security;

drop policy if exists "site_live_status_select_anon" on public.site_live_status;
create policy "site_live_status_select_anon" on public.site_live_status
  for select to anon using (true);

drop policy if exists "site_live_status_all_authenticated" on public.site_live_status;
create policy "site_live_status_all_authenticated" on public.site_live_status
  for all to authenticated using (true) with check (true);

grant select on public.site_live_status to anon;
grant insert, update, delete on public.site_live_status to authenticated;

-- -----------------------------------------------------------------------------
-- site_snap_stats + fitness (SEO / Snapchat-innsikt manuelt + treningserie)
-- Se også setup-seo-snap-fitness.sql
-- -----------------------------------------------------------------------------
create table if not exists public.site_snap_stats (
  id smallint primary key default 1,
  constraint site_snap_stats_single_row check (id = 1),
  snapchat_username text not null default 'mj_universe',
  metric_story_views_7d text,
  metric_story_views_30d text,
  metric_story_views_90d text,
  metric_story_views_all_time text,
  metric_engagement text,
  metric_subscribers text,
  insights_note text,
  updated_at timestamptz not null default now()
);

insert into public.site_snap_stats (id, snapchat_username)
values (1, 'mj_universe')
on conflict (id) do nothing;

alter table public.site_snap_stats add column if not exists metric_story_views_30d text;
alter table public.site_snap_stats add column if not exists metric_story_views_90d text;
alter table public.site_snap_stats add column if not exists metric_story_views_all_time text;

alter table public.site_snap_stats enable row level security;

drop policy if exists "site_snap_stats_select_anon" on public.site_snap_stats;
create policy "site_snap_stats_select_anon" on public.site_snap_stats
  for select to anon using (true);

drop policy if exists "site_snap_stats_all_authenticated" on public.site_snap_stats;
create policy "site_snap_stats_all_authenticated" on public.site_snap_stats
  for all to authenticated using (true) with check (true);

grant select on public.site_snap_stats to anon;
grant insert, update, delete on public.site_snap_stats to authenticated;

create table if not exists public.fitness_seasons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  sort_order int not null default 0,
  description text,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists fitness_seasons_slug_key on public.fitness_seasons (slug);

create table if not exists public.fitness_episodes (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.fitness_seasons (id) on delete cascade,
  title text not null,
  episode_number int not null default 1,
  sort_order int not null default 0,
  body text,
  video_url text,
  youtube_embed_url text,
  snap_story_url text,
  thumbnail_url text,
  is_published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (season_id, episode_number)
);

create index if not exists fitness_episodes_season_id_idx on public.fitness_episodes (season_id);

alter table public.fitness_seasons enable row level security;
alter table public.fitness_episodes enable row level security;

drop policy if exists "fitness_seasons_select_anon" on public.fitness_seasons;
create policy "fitness_seasons_select_anon" on public.fitness_seasons
  for select to anon using (is_published = true);

drop policy if exists "fitness_seasons_all_authenticated" on public.fitness_seasons;
create policy "fitness_seasons_all_authenticated" on public.fitness_seasons
  for all to authenticated using (true) with check (true);

drop policy if exists "fitness_episodes_select_anon" on public.fitness_episodes;
create policy "fitness_episodes_select_anon" on public.fitness_episodes
  for select to anon using (is_published = true);

drop policy if exists "fitness_episodes_all_authenticated" on public.fitness_episodes;
create policy "fitness_episodes_all_authenticated" on public.fitness_episodes
  for all to authenticated using (true) with check (true);

grant select on public.fitness_seasons to anon;
grant select on public.fitness_episodes to anon;
grant insert, update, delete on public.fitness_seasons to authenticated;
grant insert, update, delete on public.fitness_episodes to authenticated;

-- Sekvenser (identity / serial) - ofte årsak til «permission denied» ved insert fra admin
grant usage, select on all sequences in schema public to authenticated;

-- =============================================================================
-- Ferdig. Test admin: logg inn på admin.html og opprett en poll.
-- =============================================================================
