param(
  [string]$ServiceName = "VerdantKM",
  [switch]$RemoveSysFile,
  [string]$DriverSysPath = ""
)

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole] "Administrator")) {
  throw "Run this script as Administrator (Høyreklikk PowerShell → Kjør som administrator)."
}

$qc = sc.exe qc $ServiceName 2>$null
$exists = $LASTEXITCODE -eq 0

if ($exists -and ($qc -match "BINARY_PATH_NAME")) {
  $binLine = $qc | Where-Object { $_ -match "BINARY_PATH_NAME" } | Select-Object -First 1
  if ($binLine -and -not $DriverSysPath) {
    $DriverSysPath = ($binLine -split ":", 2)[1].Trim()
    if ($DriverSysPath.StartsWith("\??\")) {
      $DriverSysPath = $DriverSysPath.Substring(4)
    }
  }
}

if ($exists) {
  Write-Host "Stopping service $ServiceName..."
  sc.exe stop $ServiceName 2>$null | Out-Host
  # Stopped eller ikke startet er OK.
  Write-Host "Deleting service $ServiceName..."
  sc.exe delete $ServiceName | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to delete service $ServiceName"
  }
  Write-Host "Service removed."
}
else {
  Write-Host "Service '$ServiceName' was not registered - nothing to remove."
}

if ($RemoveSysFile -and $DriverSysPath -and (Test-Path -LiteralPath $DriverSysPath)) {
  Remove-Item -LiteralPath $DriverSysPath -Force -ErrorAction Stop
  Write-Host "Deleted driver file: $DriverSysPath"
}
elseif ($RemoveSysFile -and $DriverSysPath) {
  Write-Host "Driver file not found (skip delete): $DriverSysPath"
}

Write-Host ""
Write-Host "Slett også miljøvariabelen VERDANTKM_SYS_PATH om den er satt (brukerinnstillinger)."
Write-Host "Ta bort «Test-modus»-vannmerke: kjør én Administrator-kommando, start PC på nytt:"
Write-Host "  bcdedit /set testsigning off"
Write-Host ""
