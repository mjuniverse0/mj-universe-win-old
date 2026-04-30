-- Kjor i Supabase SQL Editor hvis du ikke bruker CLI-migrasjoner.
-- Full versjon (storage, realtime): supabase/migrations/20260406140000_views_stats_storage_realtime.sql

create index if not exists page_views_created_at_idx on public.page_views (created_at desc);

create or replace function public.views_stats()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'h24', (select count(*)::bigint from public.page_views where created_at > now() - interval '24 hours'),
    'd7', (select count(*)::bigint from public.page_views where created_at > now() - interval '7 days'),
    'd14', (select count(*)::bigint from public.page_views where created_at > now() - interval '14 days'),
    'd30', (select count(*)::bigint from public.page_views where created_at > now() - interval '30 days'),
    'd90', (select count(*)::bigint from public.page_views where created_at > now() - interval '90 days'),
    'd180', (select count(*)::bigint from public.page_views where created_at > now() - interval '180 days'),
    'mo12', (select count(*)::bigint from public.page_views where created_at > now() - interval '12 months'),
    'all', (select count(*)::bigint from public.page_views)
  );
$$;

grant execute on function public.views_stats() to anon, authenticated;

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

grant execute on function public.views_last_24h() to anon, authenticated;
