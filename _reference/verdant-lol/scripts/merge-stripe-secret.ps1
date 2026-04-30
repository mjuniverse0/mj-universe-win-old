# Usage: merges STRIPE_SECRET_KEY from a one-line fragment file into verdant .env on VPS (no BOM).
param(
  [Parameter(Mandatory = $true)][string]$FragmentPath,
  [string]$Ssh = "root@187.124.48.60",
  [string]$Identity = "$env:USERPROFILE\.ssh\id_ed25519",
  [string]$EnvPath = "/home/verdant/htdocs/verdant.lol/.env"
)
$ErrorActionPreference = "Stop"
scp -i $Identity -o IdentitiesOnly=yes $FragmentPath "${Ssh}:/root/stripe-secret-fragment.env"
$remote = @"
FRAG=/root/stripe-secret-fragment.env
ENV=$EnvPath
tr -d '\r' < "`$FRAG" > "`${FRAG}.ok" && mv "`${FRAG}.ok" "`$FRAG"
grep -v '^STRIPE_SECRET_KEY=' "`$ENV" > "`${ENV}.new" || cp "`$ENV" "`${ENV}.new"
cat "`$FRAG" >> "`${ENV}.new"
mv "`${ENV}.new" "`$ENV"
chmod 600 "`$ENV"
rm -f "`$FRAG"
pm2 restart verdant-web --update-env
"@
ssh -i $Identity -o IdentitiesOnly=yes $Ssh $remote
