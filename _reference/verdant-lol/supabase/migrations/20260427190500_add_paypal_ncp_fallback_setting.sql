create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value)
values ('paypal_ncp_fallback_url', 'https://www.paypal.com/ncp/payment/YLT8TJS2N5R3E')
on conflict (key) do update
set value = excluded.value,
    updated_at = now();
