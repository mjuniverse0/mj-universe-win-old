-- MJ Universe - Snapchat-innsikt (manuell) + Fitness-/treningserie (sesonger og episoder)
-- Kjør i Supabase SQL Editor. Trygt å kjøre flere ganger.

-- -----------------------------------------------------------------------------
-- site_snap_stats - tall du kopierer fra Snapchat (Creators / Insights), vises på /snapchat/
-- Snapchat tilbyr ikke offentlig API for live analytics på egen nettside.
-- -----------------------------------------------------------------------------
create table if not exists public.site_snap_stats (
  id smallint primary key default 1,
  constraint site_snap_stats_single_row check (id = 1),
  snapchat_username text not null default 'mj_universe',
  metric_story_views_7d text,
  metric_story_views_30d text,
  metric_story_views_90d text,
  metric_story_views_all_time text,
  metric_story_views_7d_delta text,
  metric_story_views_30d_delta text,
  metric_story_views_90d_delta text,
  metric_story_views_all_time_delta text,
  metric_engagement text,
  metric_subscribers text,
  insights_note text,
  updated_at timestamptz not null default now()
);

insert into public.site_snap_stats (id, snapchat_username)
values (1, 'mj_universe')
on conflict (id) do nothing;

alter table public.site_snap_stats enable row level security;

drop policy if exists "site_snap_stats_select_anon" on public.site_snap_stats;
create policy "site_snap_stats_select_anon" on public.site_snap_stats
  for select to anon using (true);

drop policy if exists "site_snap_stats_all_authenticated" on public.site_snap_stats;
create policy "site_snap_stats_all_authenticated" on public.site_snap_stats
  for all to authenticated using (true) with check (true);

grant select on public.site_snap_stats to anon;
grant insert, update, delete on public.site_snap_stats to authenticated;

-- -----------------------------------------------------------------------------
-- fitness_seasons / fitness_episodes - publiser episoder + lenker til video/Snap/YouTube
-- -----------------------------------------------------------------------------
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
  link_tiktok text,
  link_instagram text,
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

grant usage, select on all sequences in schema public to authenticated;
