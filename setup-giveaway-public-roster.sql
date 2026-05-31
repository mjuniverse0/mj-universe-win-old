-- MJ Universe - Offentlig deltakerliste (Snapchat-brukernavn synlig for alle med lenke)
-- Kjør i Supabase SQL Editor etter giveaway_entries + giveaway_enter finnes.

create or replace function public.get_giveaway_public_roster(p_event_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select case
    when not exists (
      select 1 from public.events e
      where e.id = p_event_id and e.event_type = 'giveaway'
    ) then jsonb_build_object('ok', false, 'error', 'not_found')
    else (
      select jsonb_build_object(
        'ok', true,
        'count', coalesce(
          (select count(*)::int from public.giveaway_entries g where g.event_id = p_event_id),
          0
        ),
        'entrants', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'snap_username', g.snap_username,
                'joined_at', g.created_at
              )
              order by g.created_at asc, g.id asc
            )
            from public.giveaway_entries g
            where g.event_id = p_event_id
          ),
          '[]'::jsonb
        )
      )
    )
  end;
$$;

grant execute on function public.get_giveaway_public_roster(uuid) to anon, authenticated;

comment on function public.get_giveaway_public_roster(uuid) is
  'Offentlig liste: antall + Snapchat-brukernavn for en giveaway (alle som har lenken ser listen).';
