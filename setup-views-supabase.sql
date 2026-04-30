-- INSTRUCTIONS (read this):
-- 1. Open this file on your computer (or copy from below).
-- 2. In Supabase: SQL Editor → New query.
-- 3. Paste ONLY the SQL statements (from CREATE TABLE down), NOT the filename "setup-views-supabase.sql".
-- 4. Click Run once.

create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);

alter table public.page_views enable row level security;

grant usage on schema public to anon;
grant insert on public.page_views to anon;

create policy "page_views_insert_anon"
  on public.page_views
  for insert
  to anon
  with check (true);

create policy "page_views_no_select_anon"
  on public.page_views
  for select
  to anon
  using (false);

create or replace function public.views_last_24h()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(count(*)::bigint, 0)
  from public.page_views
  where created_at > (now() - interval '24 hours');
$$;

grant execute on function public.views_last_24h() to anon;

-- Valgfritt: hold tabellen liten (kjør f.eks. ukentlig i SQL Editor eller med pg_cron)
-- delete from public.page_views where created_at < now() - interval '90 days';
