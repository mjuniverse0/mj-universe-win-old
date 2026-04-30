-- Lagring av Snapchat OAuth-tokens etter code→token (Edge Function snap-oauth-exchange).
-- RLS: ingen tilgang for anon/authenticated — kun service_role (Edge Function).
-- Kjør i Supabase SQL Editor etter du har deployet funksjonen.

create table if not exists public.snap_integration_tokens (
  id smallint primary key default 1,
  constraint snap_integration_tokens_single check (id = 1),
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  updated_at timestamptz not null default now()
);

alter table public.snap_integration_tokens enable row level security;

-- Ingen policies for anon/authenticated = ingen direkte lesing fra nettleser
revoke all on public.snap_integration_tokens from anon;
revoke all on public.snap_integration_tokens from authenticated;
grant all on public.snap_integration_tokens to service_role;
