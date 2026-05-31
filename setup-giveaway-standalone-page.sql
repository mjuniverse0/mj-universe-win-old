-- MJ Universe - Egen giveaway-side (giveaway.html?g=uuid)
-- Leser info selv om giveaway er avsluttet (for melding + admin-vinnere)
-- Kjør i Supabase SQL Editor etter setup-giveaway-entries.
-- Påmelding: public.giveaway_enter (Snapchat; emoji valgfri/null → 🎁 internt).
-- Krever winner_slots + body (premie) for åpen påmelding - kjør setup-giveaway-winner-slots.sql.

create or replace function public.get_giveaway_page_info(p_event_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'found', true,
        'id', e.id,
        'title', e.title,
        'body', coalesce(e.body, ''),
        'winner_count', e.winner_slots,
        'entry_ready', (e.winner_slots is not null and char_length(trim(coalesce(e.body, ''))) >= 2),
        'starts_at', to_jsonb(e.starts_at),
        'ends_at', to_jsonb(e.ends_at),
        'is_active', e.is_active,
        'can_enter',
          e.is_active
          and e.event_type = 'giveaway'
          and e.winner_slots is not null
          and char_length(trim(coalesce(e.body, ''))) >= 2
          and (e.starts_at is null or e.starts_at <= now())
          and (e.ends_at is null or e.ends_at >= now()),
        'ended',
          e.event_type = 'giveaway'
          and (
            not e.is_active
            or (e.ends_at is not null and e.ends_at < now())
          )
      )
      from public.events e
      where e.id = p_event_id and e.event_type = 'giveaway'
    ),
    '{"found":false}'::jsonb
  );
$$;

grant execute on function public.get_giveaway_page_info(uuid) to anon, authenticated;

comment on function public.get_giveaway_page_info(uuid) is
  'Offentlig info til giveaway.html (inkl. avsluttede giveaways).';
