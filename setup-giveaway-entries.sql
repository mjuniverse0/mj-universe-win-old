-- MJ Universe — Giveaway entries (Snap username; emoji valgfri i API, lagres internt)
-- Kjør i Supabase SQL Editor etter setup-features-supabase.sql (events-tabellen må finnes)

create extension if not exists "pgcrypto";

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

alter table public.giveaway_entries enable row level security;

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

-- Aggregerte reaksjoner (ingen brukernavn ut til publikum)
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

grant execute on function public.get_giveaway_reaction_counts(uuid) to anon, authenticated;

grant insert on public.giveaway_entries to anon;
grant select, insert, update, delete on public.giveaway_entries to authenticated;
