alter table public.accounts enable row level security;

drop policy if exists "accounts_select_all" on public.accounts;
drop policy if exists "accounts_insert_all" on public.accounts;
drop policy if exists "accounts_update_all" on public.accounts;

create policy "accounts_select_all"
on public.accounts
for select
to anon, authenticated
using (true);

create policy "accounts_insert_all"
on public.accounts
for insert
to anon, authenticated
with check (true);

create policy "accounts_update_all"
on public.accounts
for update
to anon, authenticated
using (true)
with check (true);
