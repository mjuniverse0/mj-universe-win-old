-- MJ Universe — Antall vinnere (trekkes/blant alle påmeldte — samme sjanse for alle)
-- Kjør i Supabase SQL Editor etter setup-features + setup-giveaway-entries

alter table public.events add column if not exists winner_slots int;

alter table public.events drop constraint if exists events_winner_slots_range;
alter table public.events add constraint events_winner_slots_range
  check (winner_slots is null or (winner_slots >= 1 and winner_slots <= 50));

comment on column public.events.winner_slots is
  'Hvor mange vinnere admin trekker (tilfeldig blant alle påmeldte). Påkrevd for åpen påmelding.';

-- Påmelding: Snapchat-brukernavn. Emoji er valgfri i API (null → lagres som 🎁 internt).
create or replace function public.giveaway_enter(
  p_event_id uuid,
  p_device_id text,
  p_snap_username text,
  p_reaction_emoji text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slots int;
  v_new_id uuid;
  v_pos int;
  v_snap text;
  v_emoji text;
begin
  if p_event_id is null or p_device_id is null or length(trim(p_device_id)) < 8 then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;

  v_snap := regexp_replace(lower(trim(both from coalesce(p_snap_username, ''))), '^@+', '');

  if length(v_snap) < 2 or length(v_snap) > 32 or v_snap !~ '^[a-zA-Z0-9._-]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_snap');
  end if;

  v_emoji := nullif(trim(both from coalesce(p_reaction_emoji, '')), '');
  if v_emoji is null then
    v_emoji := E'\U0001F381'; -- 🎁 (internt standard når klient ikke sender emoji)
  elsif v_emoji not in (
    E'\U0001F389', E'\U0001F49C', E'\U00002728', E'\U0001F64C',
    E'\U0001F525', E'\U0001F496', E'\U00002B50', E'\U0001F381'
  ) then
    return jsonb_build_object('ok', false, 'error', 'invalid_emoji');
  end if;

  select e.winner_slots into v_slots
  from public.events e
  where e.id = p_event_id
    and e.event_type = 'giveaway'
    and e.is_active = true
    and (e.starts_at is null or e.starts_at <= now())
    and (e.ends_at is null or e.ends_at >= now());

  if not found then
    return jsonb_build_object('ok', false, 'error', 'event_not_available');
  end if;

  if v_slots is null then
    return jsonb_build_object('ok', false, 'error', 'giveaway_not_configured');
  end if;

  if exists (
    select 1 from public.giveaway_entries g
    where g.event_id = p_event_id and g.device_id = p_device_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'duplicate');
  end if;

  insert into public.giveaway_entries (event_id, device_id, snap_username, reaction_emoji)
  values (p_event_id, p_device_id, v_snap, v_emoji)
  returning id into v_new_id;

  select sub.pos into v_pos
  from (
    select id, row_number() over (order by created_at asc, id asc) as pos
    from public.giveaway_entries
    where event_id = p_event_id
  ) sub
  where sub.id = v_new_id;

  return jsonb_build_object(
    'ok', true,
    'position', v_pos,
    'winner_count', to_jsonb(v_slots)
  );
end;
$$;

grant execute on function public.giveaway_enter(uuid, text, text, text) to anon, authenticated;
