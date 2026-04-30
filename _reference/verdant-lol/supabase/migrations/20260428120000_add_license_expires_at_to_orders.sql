-- When set, launcher / verify-license rejects keys after this instant. Null = lifetime / no expiry column semantics.
alter table public.orders
  add column if not exists license_expires_at timestamptz;

comment on column public.orders.license_expires_at is 'UTC instant when subscription tier ends; null means no expiry (lifetime).';

create index if not exists idx_orders_license_expires
  on public.orders (license_expires_at)
  where license_expires_at is not null;
