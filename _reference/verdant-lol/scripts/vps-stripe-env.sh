#!/usr/bin/env bash
set -euo pipefail
SITE=/home/verdant/htdocs/verdant.lol
ENV="$SITE/.env"

for f in id_ed25519 id_rsa; do
  if [[ -f "$SITE/$f" ]]; then
    mkdir -p /root/recovered-keys
    mv "$SITE/$f" "/root/recovered-keys/${f}.MOVED-FROM-WEBROOT-$(date +%s)"
    echo "MOVED unsafe $f from web root to /root/recovered-keys/"
  fi
done

append_if_missing() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "$ENV" 2>/dev/null; then
    echo "exists: $key"
    return 0
  fi
  echo "${key}=${val}" >> "$ENV"
  echo "appended: $key"
}

touch "$ENV"
append_if_missing PUBLIC_APP_URL "https://verdant.lol"
append_if_missing STRIPE_SECRET_KEY ""
append_if_missing STRIPE_WEBHOOK_SECRET ""

pm2 restart verdant-web --update-env
pm2 save 2>/dev/null || true

echo "--- GET /api/stripe/config ---"
curl -sS "https://verdant.lol/api/stripe/config" || true
echo ""
