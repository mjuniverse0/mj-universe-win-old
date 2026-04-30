# Kjor: Dobbelklikk RUN-remove-VerdantKM-og-testmodus.bat (godkjenn UAC), eller kjorer PS1 direkte.
# Filen er ASCII-basert slik at Windows PowerShell 5 ikke feiltermer.

param(
  [string]$ServiceName = "VerdantKM",
  [switch]$RemoveSysFile
)

$ErrorActionPreference = "Stop"

function Test-Administrator {
  $p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
  Write-Host "Ber om administrator (UAC) - godkjenn vinduet."
  $psi = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath)
  if ($RemoveSysFile) { $psi += '-RemoveSysFile' }
  $proc = Start-Process -FilePath "powershell.exe" -ArgumentList $psi -Verb RunAs -Wait -PassThru
  exit $(if ($null -eq $proc.ExitCode) { 0 } else { $proc.ExitCode })
}

Write-Host "== VerdantKM fjern + test-signing av =="
Write-Host ""

$DriverSysPath = ""
$qc = sc.exe qc $ServiceName 2>$null
$exists = $LASTEXITCODE -eq 0

if ($exists -and $qc) {
  foreach ($line in ($qc | Where-Object { $_ -match "BINARY_PATH_NAME" })) {
    $DriverSysPath = ($line -split ":", 2)[1].Trim()
    break
  }
  if ($DriverSysPath.StartsWith("\??\")) {
    $DriverSysPath = $DriverSysPath.Substring(4)
  }
}

if ($exists) {
  Write-Host "Stopper og sletter tjeneste $ServiceName ..."
  sc.exe stop $ServiceName 2>$null | Out-Null
  sc.exe delete $ServiceName | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw ('Klarte ikke slette tjeneste {0} (exitkode {1})' -f $ServiceName, $LASTEXITCODE)
  }
  Write-Host "Tjeneste fjernet."
}
else {
  Write-Host "Tjeneste '$ServiceName' fantes ikke - hopper over."
}

if ($RemoveSysFile -and $DriverSysPath -and (Test-Path -LiteralPath $DriverSysPath)) {
  Remove-Item -LiteralPath $DriverSysPath -Force
  Write-Host "Slettet: $DriverSysPath"
}
elseif ($RemoveSysFile -and $DriverSysPath) {
  Write-Host "Fant ikke .sys pa disk: $DriverSysPath"
}

Write-Host ""
Write-Host "bcdedit: slar av test-signing ..."
bcdedit.exe /set testsigning off | Out-Host
bcdedit.exe /set nointegritychecks off 2>$null | Out-Host

try {
  $u = [Environment]::GetEnvironmentVariable("VERDANTKM_SYS_PATH", "User")
  if ($null -ne $u -and $u -ne "") {
    [Environment]::SetEnvironmentVariable("VERDANTKM_SYS_PATH", $null, "User")
    Write-Host "Fjernet brukermiljovariabel VERDANTKM_SYS_PATH."
  }
} catch {}

try {
  $m = [Environment]::GetEnvironmentVariable("VERDANTKM_SYS_PATH", "Machine")
  if ($null -ne $m -and $m -ne "") {
    [Environment]::SetEnvironmentVariable("VERDANTKM_SYS_PATH", $null, "Machine")
    Write-Host "Fjernet systemmiljovariabel VERDANTKM_SYS_PATH."
  }
} catch {}

Write-Host ""
Write-Host "Ferdig. START PCEN PA NYTT slik Test Mode-vannmerket forsvinner."
Write-Host ""
