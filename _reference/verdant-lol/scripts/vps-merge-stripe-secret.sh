#!/usr/bin/env bash
set -euo pipefail
FRAG=/root/stripe-secret-fragment.env
ENV=/home/verdant/htdocs/verdant.lol/.env
test -f "$FRAG"
tr -d '\r' < "$FRAG" > "${FRAG}.x" && mv "${FRAG}.x" "$FRAG"
grep -v '^STRIPE_SECRET_KEY=' "$ENV" > "${ENV}.new"
cat "$FRAG" >> "${ENV}.new"
mv "${ENV}.new" "$ENV"
chmod 600 "$ENV"
rm -f "$FRAG"
cd /home/verdant/htdocs/verdant.lol
pm2 restart verdant-web --update-env
sleep 1
curl -sS "https://verdant.lol/api/stripe/config" || true
echo ""
