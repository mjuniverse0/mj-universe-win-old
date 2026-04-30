param(
  [string]$ServiceName = "VerdantKM"
)

$ErrorActionPreference = "Stop"

Write-Host "== VerdantKM status =="
Write-Host ""

$svc = sc.exe query $ServiceName 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Service '$ServiceName' not found."
  exit 1
}

$svc | Out-Host
Write-Host ""

$qc = sc.exe qc $ServiceName 2>&1
$qc | Out-Host
Write-Host ""

$binLine = $qc | Where-Object { $_ -match "BINARY_PATH_NAME" } | Select-Object -First 1
$driverPath = $null
if ($binLine) {
  $driverPath = ($binLine -split ":", 2)[1].Trim()
  if ($driverPath.StartsWith("\??\")) {
    $driverPath = $driverPath.Substring(4)
  }
}

if (-not $driverPath) {
  Write-Host "Could not resolve driver path from service config."
  exit 0
}

Write-Host "Resolved driver path: $driverPath"

if (-not (Test-Path $driverPath)) {
  Write-Host "Driver file does not exist at resolved path."
  exit 1
}

$item = Get-Item $driverPath
Write-Host ("Size: {0} bytes" -f $item.Length)
Write-Host ("LastWriteTime: {0}" -f $item.LastWriteTime)
Write-Host ""

$sig = Get-AuthenticodeSignature -FilePath $driverPath
Write-Host ("SignatureStatus: {0}" -f $sig.Status)
if ($sig.SignerCertificate) {
  Write-Host ("SignerSubject: {0}" -f $sig.SignerCertificate.Subject)
  Write-Host ("SignerThumbprint: {0}" -f $sig.SignerCertificate.Thumbprint)
}
