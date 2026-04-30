insert into public.gift_cards (code, product_hint, amount_usd, active, redeemed)
values ('GIFT-APEX-FREE', 'apex', 15, true, false)
on conflict (code) do update
set product_hint = excluded.product_hint,
    amount_usd = excluded.amount_usd,
    active = true,
    redeemed = false;
