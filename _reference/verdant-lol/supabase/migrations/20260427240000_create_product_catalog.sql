-- Storefront catalog: prices and image paths (site serves files from /web/assets/images/).
create table if not exists public.product_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  image_path text not null,
  price_7d_usd numeric(10,2) not null,
  price_30d_usd numeric(10,2) not null,
  price_lifetime_usd numeric(10,2) not null,
  description text,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_catalog_active_sort
  on public.product_catalog (active, sort_order);

alter table public.product_catalog enable row level security;

drop policy if exists "product_catalog_read_all" on public.product_catalog;
create policy "product_catalog_read_all"
  on public.product_catalog
  for select
  to anon, authenticated
  using (true);

-- Match web/*.html plan prices
insert into public.product_catalog
  (slug, display_name, image_path, price_7d_usd, price_30d_usd, price_lifetime_usd, description, sort_order, active)
values
  (
    'fortnite',
    'Fortnite',
    '/assets/images/fortnite-product.png',
    14.00, 15.00, 125.00,
    'Input profile pack for Fortnite: movement, deadzone, sensitivity and curves.',
    1,
    true
  ),
  (
    'apex',
    'Apex Legends',
    '/assets/images/apex-product.png',
    14.00, 15.00, 125.00,
    'Apex controller/KBM remapper profiles. Foreground: r5apex.exe when using focus capture.',
    2,
    true
  ),
  (
    'roblox',
    'Roblox',
    '/assets/images/roblox-product.png',
    12.00, 13.00, 105.00,
    'Roblox profile pack: bindings, deadzones, response curves.',
    3,
    true
  ),
  (
    'cs2',
    'CS2',
    '/assets/images/cs2-product.png',
    16.00, 17.00, 140.00,
    'CS2 profile pack: input translation, sensitivity, curves.',
    4,
    true
  )
on conflict (slug) do update
set
  display_name = excluded.display_name,
  image_path = excluded.image_path,
  price_7d_usd = excluded.price_7d_usd,
  price_30d_usd = excluded.price_30d_usd,
  price_lifetime_usd = excluded.price_lifetime_usd,
  description = excluded.description,
  sort_order = excluded.sort_order,
  active = excluded.active,
  updated_at = now();
