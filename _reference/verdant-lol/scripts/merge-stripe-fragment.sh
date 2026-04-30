#!/usr/bin/env bash
set -euo pipefail
FRAG=/root/stripe-fragment.env
ENV=/home/verdant/htdocs/verdant.lol/.env
tr -d '\r' < "$FRAG" > "${FRAG}.ok" && mv "${FRAG}.ok" "$FRAG"
( grep -v '^STRIPE_SECRET_KEY=' "$ENV" | grep -v '^STRIPE_PUBLISHABLE_KEY=' || true ) > "${ENV}.new"
cat "$FRAG" >> "${ENV}.new"
mv "${ENV}.new" "$ENV"
chmod 600 "$ENV"
rm -f "$FRAG"
cd /home/verdant/htdocs/verdant.lol
pm2 restart verdant-web --update-env
sleep 1
curl -sS "https://verdant.lol/api/stripe/config" || true
echo ""
