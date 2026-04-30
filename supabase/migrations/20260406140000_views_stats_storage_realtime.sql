-- MJ Universe: visninger (rullende vinduer), storage for video, realtime chat
-- Idempotent der mulig.

-- ---------------------------------------------------------------------------
-- page_views: behold alle rader (ingen sletting) — 24t/7d/… er alltid «siste N»
-- ---------------------------------------------------------------------------
create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now()
);

create index if not exists page_views_created_at_idx on public.page_views (created_at desc);

alter table public.page_views enable row level security;

drop policy if exists "page_views_insert_anon" on public.page_views;
create policy "page_views_insert_anon"
  on public.page_views for insert to anon with check (true);

drop policy if exists "page_views_no_select_anon" on public.page_views;
create policy "page_views_no_select_anon"
  on public.page_views for select to anon using (false);

drop policy if exists "page_views_all_authenticated" on public.page_views;
create policy "page_views_all_authenticated"
  on public.page_views for all to authenticated using (true) with check (true);

grant usage on schema public to anon, authenticated;
grant insert on public.page_views to anon;
grant select, insert, update, delete on public.page_views to authenticated;

-- Én RPC: alle rullende perioder + all time (alle rader siden tabellen ble opprettet)
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

-- Bakoverkompatibilitet for eldre klienter (egen telling — unnga dobbel full-scan)
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

-- ---------------------------------------------------------------------------
-- Storage: offentlig lesbar bucket for video / thumbs (opplasting kun staff-e-post)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mj-videos',
  'mj-videos',
  true,
  524288000,
  array['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "mj_videos_public_read" on storage.objects;
create policy "mj_videos_public_read"
  on storage.objects for select
  using (bucket_id = 'mj-videos');

drop policy if exists "mj_videos_staff_insert" on storage.objects;
create policy "mj_videos_staff_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'mj-videos'
    and coalesce(lower(auth.jwt() ->> 'email'), '') like '%@mj-universe.site'
  );

drop policy if exists "mj_videos_staff_update" on storage.objects;
create policy "mj_videos_staff_update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'mj-videos'
    and coalesce(lower(auth.jwt() ->> 'email'), '') like '%@mj-universe.site'
  )
  with check (bucket_id = 'mj-videos');

drop policy if exists "mj_videos_staff_delete" on storage.objects;
create policy "mj_videos_staff_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'mj-videos'
    and coalesce(lower(auth.jwt() ->> 'email'), '') like '%@mj-universe.site'
  );

-- ---------------------------------------------------------------------------
-- Realtime: community chat (hvis tabellen finnes)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'community_chat_messages'
  ) then
    begin
      execute 'alter publication supabase_realtime add table public.community_chat_messages';
    exception
      when duplicate_object then null;
      when others then null;
    end;
  end if;
end $$;
