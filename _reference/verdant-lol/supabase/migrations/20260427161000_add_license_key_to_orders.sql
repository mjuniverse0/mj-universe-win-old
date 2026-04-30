alter table public.orders
add column if not exists license_key text;
