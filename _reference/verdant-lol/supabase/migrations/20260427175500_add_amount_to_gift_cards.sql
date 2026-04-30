alter table public.gift_cards
add column if not exists amount_usd numeric(10,2) not null default 0;
