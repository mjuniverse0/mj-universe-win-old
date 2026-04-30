alter table public.orders
add column if not exists claimed_role_id text;
