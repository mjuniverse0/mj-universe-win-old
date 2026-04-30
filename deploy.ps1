# Deploy MJ Universe: Supabase (migrasjoner + edge functions) + SCP til VPS.
# Kjor fra prosjektmappa:  .\deploy.ps1
#
# Supabase: sett SUPABASE_ACCESS_TOKEN (dashboard) og kjor ev.  npx supabase@latest login
# Hopp over Supabase:  $env:MJ_SKIP_SUPABASE = "1"

$ErrorActionPreference = "Stop"
$k = "C:\Users\Jhonatan Wik\.ssh\id_ed25519"
$h = "root@187.124.48.60"
$d = "/home/mj-universe/htdocs/mj-universe.net"
Set-Location $PSScriptRoot

$sbScript = Join-Path $PSScriptRoot "tools\deploy-supabase.ps1"
if (Test-Path $sbScript) {
  Write-Host "--- Supabase ---" -ForegroundColor Magenta
  try {
    & $sbScript
  } catch {
    Write-Host "Supabase-deploy feilet (fortsetter med SCP): $_" -ForegroundColor Yellow
  }
}

# --- mj-universe.net ---
$rootFiles = @(
  "index.html", "admin.html", "giveaway.html", "site.webmanifest", "sitemap.xml", "robots.txt",
  "about.html", "mariellberntzen.html", "mariell-berntzen.html", "jhonatanwik.html", "jhonatan-wik.html",
  "snapchat.html", "fitness-serie.html", "vlog.html", "blog.html"
)

Write-Host "SCP mj-universe.net rotfiler..." -ForegroundColor Cyan
& scp.exe -i $k -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=60 @rootFiles "${h}:$d/"

Write-Host "SCP mj-universe.net mapper..." -ForegroundColor Cyan
$dirs = @(
  "css", "js", "images", "live", "videoer", "about", "account", "snapchat", "fitness", "vlog", "blog",
  "mariellberntzen", "mariell-berntzen", "jhonatanwik", "jhonatan-wik"
)
& scp.exe -i $k -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=120 -r @dirs "${h}:$d/"

# --- mj-universe.net: /vip og /betaling (Next-eksport med Stripe — se mj-net-vip-patch + tools/patch-hub-vip-stripe.py) ---
$hubStripe = Join-Path $PSScriptRoot "mj-net-vip-patch"
if (Test-Path (Join-Path $hubStripe "vip\index.html")) {
  Write-Host "SCP mj-universe.net vip + betaling (Stripe)..." -ForegroundColor Cyan
  & scp.exe -i $k -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=60 `
    (Join-Path $hubStripe "vip\index.html") "${h}:${d}/vip/index.html"
  & scp.exe -i $k -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=60 `
    (Join-Path $hubStripe "betaling\takk\index.html") "${h}:${d}/betaling/takk/index.html"
  & scp.exe -i $k -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=60 `
    (Join-Path $hubStripe "betaling\avbrutt\index.html") "${h}:${d}/betaling/avbrutt/index.html"
}

# --- Satellitt-domenene (CloudPanel) ---
$siteTargets = @(
  @{ Name = "mj-universe.live";  Dest = "/home/mj-universe1/htdocs/mj-universe.live" },
  @{ Name = "mj-universe.social"; Dest = "/home/mj-universe-social/htdocs/mj-universe.social" },
  @{ Name = "mj-universe.lol";   Dest = "/home/mj-universe-lol/htdocs/mj-universe.lol" },
  @{ Name = "mj-universe.media"; Dest = "/home/mj-universe-media/htdocs/mj-universe.media" },
  @{ Name = "mj-universe.vip";   Dest = "/home/mj-universe-vip/htdocs/mj-universe.vip" },
  @{ Name = "mj-universe.date";  Dest = "/home/mj-universe-date/htdocs/mj-universe.date" },
  @{ Name = "mj-universe.store"; Dest = "/home/mj-universe-store/htdocs/mj-universe.store" },
  @{ Name = "mjuniverse.store";  Dest = "/home/mjuniverse-store/htdocs/mjuniverse.store" },
  @{ Name = "mj-universe.watch"; Dest = "/home/mj-universe-watch/htdocs/mj-universe.watch" }
)

foreach ($t in $siteTargets) {
  $local = Join-Path $PSScriptRoot "sites\$($t.Name)"
  if (-not (Test-Path $local)) {
    Write-Host "Hopper over (mangler mappe): $local" -ForegroundColor Yellow
    continue
  }
  Write-Host "SCP satellitt $($t.Name) -> $($t.Dest) ..." -ForegroundColor Cyan
  Push-Location $local
  try {
    $items = @(Get-ChildItem -Force | ForEach-Object { $_.Name })
    if ($items.Count -eq 0) { continue }
    & scp.exe -i $k -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=120 -r @items "${h}:$($t.Dest)/"
  } finally {
    Pop-Location
  }
}

Write-Host "Ferdig: mj-universe.net + satellitter. Nginx: se nginx/nginx-mj-universe.example.conf" -ForegroundColor Green
