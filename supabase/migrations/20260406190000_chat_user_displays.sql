-- Chat: visningsnavn (staff uten profil → MJ-Universe) + CREATOR-badge for hovedkonto
create or replace function public.chat_user_displays(uids uuid[])
returns table (user_id uuid, snap_label text, badge text)
language sql
stable
security definer
set search_path = public
as $$
  select
    u.id as user_id,
    coalesce(
      p.snapchat_username,
      case
        when u.email ilike '%@mj-universe.site' then 'MJ-Universe'
        else 'ukjent'
      end
    ) as snap_label,
    case
      when lower(trim(u.email)) = 'mariellogjhonatan@mj-universe.site' then 'CREATOR'
      else null
    end as badge
  from unnest(uids) as x(id)
  join auth.users u on u.id = x.id
  left join public.profiles p on p.id = u.id;
$$;

grant execute on function public.chat_user_displays(uuid[]) to authenticated;

comment on function public.chat_user_displays(uuid[]) is
  'Chat-visning: snap fra profiles, ellers MJ-Universe for @mj-universe.site, ellers ukjent. CREATOR for mariellogjhonatan@mj-universe.site.';

notify pgrst, 'reload schema';
