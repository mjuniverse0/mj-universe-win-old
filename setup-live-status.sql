-- MJ Universe - Live-status (forside + live-side). Kjør i Supabase SQL Editor.

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

-- Eksisterende rad: fyll inn andre konto hvis tom
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

comment on table public.site_live_status is
  'Én rad (id=1): is_live; embed_url; tiktok_username + tiktok_username_secondary (to TikTok-kontoer).';
