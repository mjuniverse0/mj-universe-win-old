# Upload everything under local web/ to the live site directory (replaces/updates matching files).
# Requires: OpenSSH client (Windows "OpenSSH Client" optional feature), SSH key in authorized_keys on the server.
#
# Project defaults (override with $env:VERDANT_SSH or -Ssh if your SSH login is not root):
#   Host: 187.124.48.60
#   Private key:  %USERPROFILE%\.ssh\id_ed25519  (e.g. C:\Users\Jhonatan Wik\.ssh\id_ed25519)
#   Public key (.pub) is for authorized_keys on the server - not used by scp.
#
# 1) Set the REMOTE FOLDER that nginx/Apache uses as the site root (required unless env already set).
# 2) Run from repo root:  .\scripts\deploy-web.ps1
#
# Example (PowerShell), only if you need to override:
#   $env:VERDANT_SSH = "ubuntu@187.124.48.60"
#   $env:VERDANT_REMOTE_DIR = "/var/www/verdant.lol/html"
#   .\scripts\deploy-web.ps1
#
# If the site is still old after upload: hard-refresh (Ctrl+F5) or purge CDN; confirm nginx `root` points to this path.
# This script does NOT delete remote files you removed locally; for a clean replace, empty the target folder on the server once.
param(
  [string] $Ssh = $env:VERDANT_SSH,
  [string] $RemoteDir = $env:VERDANT_REMOTE_DIR,
  [string] $Identity = $env:VERDANT_SSH_IDENTITY
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# Default SSH target for Verdant production (see .cursor/rules/verdant-ssh.mdc)
$DefaultSsh = "root@187.124.48.60"
$defaultKey = Join-Path $env:USERPROFILE ".ssh\id_ed25519"

if (-not $Identity -or -not (Test-Path $Identity)) {
  if (Test-Path $defaultKey) {
    $Identity = $defaultKey
  }
}
if (-not $Identity -or -not (Test-Path $Identity)) {
  Write-Error "SSH private key not found. Set VERDANT_SSH_IDENTITY to your id_ed25519 path (default: $defaultKey)"
}
if (-not $Ssh) {
  $Ssh = $DefaultSsh
  Write-Host "Using default SSH: $Ssh  (set VERDANT_SSH to override, e.g. ubuntu@187.124.48.60)"
}
# nginx root for verdant.lol on production (see server /etc/nginx/conf.d/verdant.lol.conf)
$DefaultRemoteDir = "/home/verdant/htdocs/verdant.lol"
if (-not $RemoteDir) {
  $RemoteDir = $DefaultRemoteDir
  Write-Host "Using default remote dir: $RemoteDir  (set VERDANT_REMOTE_DIR to override)"
}
$web = Join-Path $root "web"
if (-not (Test-Path $web)) {
  Write-Error "Missing web/ at $web"
}
$index = Join-Path $web "index.html"
if (-not (Test-Path $index)) {
  Write-Error "Expected index.html in web/ at $index"
}
Write-Host "Deploy: all files in $web  ->  ${Ssh}:$RemoteDir  (key: $Identity)"
Write-Host "Uploading assets/, all *.html, payment pages; everything in web/ in one go."
Push-Location $web
try {
  $remotePath = if ($RemoteDir -match "/$") { "${Ssh}:$RemoteDir" } else { "${Ssh}:$RemoteDir/" }
  & scp -i $Identity -o IdentitiesOnly=yes -r * $remotePath
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  Pop-Location
}
Write-Host "Upload finished. On the server, open $RemoteDir/index.html to verify; in browser: https://your-domain/ (clear cache if unchanged)."
Write-Host "NOTE: This uploads static web/ only. GET /api/* must proxy to Node (npm run start:web). See deploy/nginx-verdant-api.example.conf"
Write-Host "Done."
