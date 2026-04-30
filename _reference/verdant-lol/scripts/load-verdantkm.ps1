param(
  [string]$DriverPath = "C:\Users\Jhonatan Wik\source\repos\VerdantKM\VerdantKM\x64\Release\VerdantKM.sys",
  [string]$ServiceName = "VerdantKM",
  [string]$KmdfVersion = "1.35"
)

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole] "Administrator")) {
  throw "Run this script as Administrator."
}

if (-not (Test-Path $DriverPath)) {
  throw "Driver file not found: $DriverPath"
}

$existing = sc.exe query $ServiceName 2>$null
$serviceMissing = $LASTEXITCODE -ne 0

if ($serviceMissing) {
  Write-Host "Creating kernel service $ServiceName..."
  sc.exe create $ServiceName type= kernel start= demand binPath= "$DriverPath" | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create service $ServiceName"
  }
}

# KMDF non-PnP drivers need this registry value when installed via sc.exe
# (INF install normally writes it under Services\<name>\Parameters\Wdf).
$wdfRegPath = "HKLM:\SYSTEM\CurrentControlSet\Services\$ServiceName\Parameters\Wdf"
if (-not (Test-Path $wdfRegPath)) {
  New-Item -Path $wdfRegPath -Force | Out-Null
}
New-ItemProperty -Path $wdfRegPath -Name "KmdfLibraryVersion" -Value $KmdfVersion `
  -PropertyType String -Force | Out-Null

Write-Host "Starting $ServiceName..."
sc.exe start $ServiceName | Out-Host
if (($LASTEXITCODE -ne 0) -and ($LASTEXITCODE -ne 1056)) {
  throw "Failed to start service $ServiceName"
}

Write-Host ""
Write-Host "Service status:"
sc.exe query $ServiceName | Out-Host

Write-Host ""
Write-Host "Tip: set VERDANTKM_SYS_PATH so overlay can auto-load if needed:"
Write-Host "  `$env:VERDANTKM_SYS_PATH = '$DriverPath'"
