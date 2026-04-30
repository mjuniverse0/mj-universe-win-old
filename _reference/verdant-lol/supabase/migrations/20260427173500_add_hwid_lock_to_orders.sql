alter table public.orders
add column if not exists hwid_lock text,
add column if not exists hwid_last_seen timestamptz;

create index if not exists idx_orders_license_key
on public.orders (license_key);
