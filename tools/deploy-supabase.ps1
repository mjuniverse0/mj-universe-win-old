# Deploy Supabase: migrasjoner, edge functions.
# Kjor fra prosjektmappa (eller via deploy.ps1).
#
# Miljovariabler:
#   SUPABASE_ACCESS_TOKEN — https://supabase.com/dashboard/account/tokens
#   MJ_SUPABASE_PROJECT_REF — valgfri, default yefatcprqfybbqxiarcz
#   MJ_SKIP_SUPABASE — sett 1 for aa hoppe over

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
$root = (Get-Location).Path

if ($env:MJ_SKIP_SUPABASE -eq "1") {
  Write-Host "[Supabase] MJ_SKIP_SUPABASE=1 - hopper over." -ForegroundColor Yellow
  exit 0
}

$ref = "yefatcprqfybbqxiarcz"
$envRef = $env:MJ_SUPABASE_PROJECT_REF
if (-not [string]::IsNullOrWhiteSpace($envRef)) {
  $t = $envRef.Trim()
  if ($t.Length -ge 10) { $ref = $t }
}

if (-not (Test-Path (Join-Path $root "supabase\migrations"))) {
  Write-Host "[Supabase] Ingen supabase/migrations - hopper over." -ForegroundColor Yellow
  exit 0
}

Write-Host "[Supabase] Prosjekt-ref: $ref" -ForegroundColor Cyan

$useSupabaseExe = $null -ne (Get-Command supabase -ErrorAction SilentlyContinue)
$npxExe = Get-Command npx -ErrorAction SilentlyContinue
if (-not $useSupabaseExe -and -not $npxExe) {
  Write-Host "[Supabase] Verken 'supabase' eller 'npx' funnet." -ForegroundColor Red
  exit 127
}

function Run-SupabaseCli {
  param([string[]]$Arguments)
  if ($useSupabaseExe) {
    & supabase @Arguments
  } else {
    & npx --yes supabase@latest @Arguments
  }
}

Write-Host "[Supabase] link..." -ForegroundColor Cyan
Run-SupabaseCli -Arguments @("link", "--project-ref", $ref)

Write-Host "[Supabase] db push..." -ForegroundColor Cyan
Run-SupabaseCli -Arguments @("db", "push", "--yes")
$ec = $LASTEXITCODE
if ($ec -ne 0) {
  Write-Host "[Supabase] db push feilet ($ec). Login: npx supabase login (token i SUPABASE_ACCESS_TOKEN), link: npx supabase link --project-ref $ref" -ForegroundColor Yellow
}

$fnRoot = Join-Path $root "supabase\functions"
if (Test-Path $fnRoot) {
  Get-ChildItem $fnRoot -Directory | ForEach-Object {
    $name = $_.Name
    Write-Host "[Supabase] functions deploy $name ..." -ForegroundColor Cyan
    $fa = @("functions", "deploy", $name, "--project-ref", $ref)
    if ($name -eq "snap-oauth-exchange") {
      $fa += "--no-verify-jwt"
    }
    Run-SupabaseCli -Arguments $fa
  }
}

Write-Host "[Supabase] Ferdig." -ForegroundColor Green
Write-Host "  Dashboard: Auth URL, e-post, Storage CORS - konfigureres i Supabase UI." -ForegroundColor DarkGray
