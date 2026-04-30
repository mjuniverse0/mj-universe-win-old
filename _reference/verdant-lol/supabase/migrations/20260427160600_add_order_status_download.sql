alter table public.orders
add column if not exists status text default 'pending';

alter table public.orders
add column if not exists download_url text;
