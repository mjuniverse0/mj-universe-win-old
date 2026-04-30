-- MJ Universe: profiles, chat, watch_videos, store + is_mj_staff
-- (samme innhold som setup-community-auth-watch-store.sql)

create or replace function public.is_mj_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (auth.jwt() ->> 'email') is not null
    and lower(auth.jwt() ->> 'email') like '%@mj-universe.site',
    false
  );
$$;

grant execute on function public.is_mj_staff() to authenticated, anon;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  snapchat_username text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_snap_unique unique (snapchat_username),
  constraint profiles_snap_format check (
    char_length(trim(snapchat_username)) >= 5
    and char_length(trim(snapchat_username)) <= 32
    and trim(snapchat_username) ~ '^[a-zA-Z0-9._-]+$'
  )
);

create index if not exists profiles_snap_lower_idx on public.profiles (lower(snapchat_username));

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

grant select, insert, update on public.profiles to authenticated;

create table if not exists public.community_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint community_chat_body_len check (char_length(trim(body)) between 1 and 500)
);

create index if not exists community_chat_created_idx on public.community_chat_messages (created_at desc);

alter table public.community_chat_messages enable row level security;

drop policy if exists "chat_select_auth" on public.community_chat_messages;
create policy "chat_select_auth"
  on public.community_chat_messages for select to authenticated using (true);

drop policy if exists "chat_insert_own" on public.community_chat_messages;
create policy "chat_insert_own"
  on public.community_chat_messages for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "chat_delete_staff" on public.community_chat_messages;
create policy "chat_delete_staff"
  on public.community_chat_messages for delete to authenticated
  using (public.is_mj_staff());

grant select, insert, delete on public.community_chat_messages to authenticated;

create table if not exists public.watch_videos (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  description text,
  youtube_embed_url text,
  content_kind text not null default 'vlog' check (content_kind in ('vlog', 'clip')),
  is_published boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint watch_videos_slug_unique unique (slug),
  constraint watch_videos_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$')
);

create index if not exists watch_videos_published_kind_idx
  on public.watch_videos (is_published, content_kind, sort_order);

alter table public.watch_videos enable row level security;

drop policy if exists "watch_select_public" on public.watch_videos;
create policy "watch_select_public"
  on public.watch_videos for select
  using (is_published = true);

drop policy if exists "watch_all_staff" on public.watch_videos;
create policy "watch_all_staff"
  on public.watch_videos for all to authenticated
  using (public.is_mj_staff()) with check (public.is_mj_staff());

grant select on public.watch_videos to anon, authenticated;
grant insert, update, delete on public.watch_videos to authenticated;

create table if not exists public.store_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  price_cents int not null check (price_cents >= 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint store_products_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}$')
);

create table if not exists public.store_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.store_products (id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists store_orders_user_idx on public.store_orders (user_id, created_at desc);

alter table public.store_products enable row level security;
alter table public.store_orders enable row level security;

drop policy if exists "store_products_select_public" on public.store_products;
create policy "store_products_select_public"
  on public.store_products for select using (is_active = true);

drop policy if exists "store_products_staff" on public.store_products;
create policy "store_products_staff"
  on public.store_products for all to authenticated
  using (public.is_mj_staff()) with check (public.is_mj_staff());

drop policy if exists "store_orders_select_own" on public.store_orders;
create policy "store_orders_select_own"
  on public.store_orders for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "store_orders_insert_own" on public.store_orders;
create policy "store_orders_insert_own"
  on public.store_orders for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "store_orders_staff_all" on public.store_orders;
create policy "store_orders_staff_all"
  on public.store_orders for all to authenticated
  using (public.is_mj_staff()) with check (public.is_mj_staff());

grant select on public.store_products to anon, authenticated;
grant select, insert on public.store_orders to authenticated;
grant insert, update, delete on public.store_products to authenticated;
grant all on public.store_orders to authenticated;

comment on table public.profiles is 'Fan/profil: Snapchat-brukernavn (unikt), koblet til auth.users.';
comment on table public.community_chat_messages is 'Live chat pa mj-universe.social; RLS: kun authenticated.';
comment on table public.watch_videos is 'Vlog/klipp; offentlig select nar is_published; staff CRUD.';
comment on table public.store_orders is 'MVP-ordre; ekte betaling krever Stripe e.l. senere.';

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

notify pgrst, 'reload schema';
