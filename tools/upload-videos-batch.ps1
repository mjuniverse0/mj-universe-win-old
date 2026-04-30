param(
  [Parameter(Mandatory = $true)]
  [string]$FolderPath,

  [string]$Kind = "vlog",
  [int]$StartSortOrder = 0,
  [switch]$Publish,
  [string]$MetadataCsv = "",
  [switch]$Recurse,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$singleScript = Join-Path $PSScriptRoot "upload-videos-to-supabase.ps1"
if (-not (Test-Path $singleScript)) {
  throw "Missing script: $singleScript"
}

if (-not (Test-Path $FolderPath)) {
  throw "Folder not found: $FolderPath"
}

function To-Title([string]$fileNameNoExt) {
  $t = $fileNameNoExt -replace "[-_]+", " "
  $t = [Regex]::Replace($t, "\s+", " ").Trim()
  if ([string]::IsNullOrWhiteSpace($t)) { return $fileNameNoExt }
  return (Get-Culture).TextInfo.ToTitleCase($t)
}

function To-Key([string]$path) {
  return [IO.Path]::GetFileName($path).ToLowerInvariant()
}

$lookup = @{}
if (-not [string]::IsNullOrWhiteSpace($MetadataCsv)) {
  if (-not (Test-Path $MetadataCsv)) {
    throw "Metadata CSV not found: $MetadataCsv"
  }
  $rows = Import-Csv -Path $MetadataCsv
  foreach ($r in $rows) {
    if (-not $r.file_name) { continue }
    $lookup[$r.file_name.ToLowerInvariant()] = $r
  }
}

$exts = @("*.mp4", "*.webm", "*.mov")
$files = @()
foreach ($ext in $exts) {
  $files += Get-ChildItem -Path $FolderPath -File -Filter $ext -Recurse:$Recurse.IsPresent
}
$files = $files | Sort-Object FullName

if ($files.Count -eq 0) {
  Write-Host "No video files found in: $FolderPath"
  exit 0
}

Write-Host "Found $($files.Count) video file(s)."
$sortOrder = $StartSortOrder
$ok = 0
$failed = 0

foreach ($f in $files) {
  $meta = $lookup[(To-Key $f.Name)]
  $title = if ($meta -and $meta.title) { [string]$meta.title } else { To-Title $f.BaseName }
  $description = if ($meta -and $meta.description) { [string]$meta.description } else { "" }
  $slug = if ($meta -and $meta.slug) { [string]$meta.slug } else { "" }
  $rowKind = if ($meta -and $meta.kind) { [string]$meta.kind } else { $Kind }
  $rowSort = if ($meta -and $meta.sort_order) { [int]$meta.sort_order } else { $sortOrder }
  $rowPublish = if ($meta -and $meta.publish) {
    @("1", "true", "yes", "y") -contains ([string]$meta.publish).ToLowerInvariant()
  } else {
    $Publish.IsPresent
  }

  Write-Host ""
  Write-Host "==> $($f.FullName)"
  Write-Host "    title=$title | kind=$rowKind | sort=$rowSort | publish=$rowPublish"

  if ($DryRun) {
    $sortOrder++
    continue
  }

  try {
    $args = @(
      "-ExecutionPolicy", "Bypass",
      "-File", $singleScript,
      "-VideoPath", $f.FullName,
      "-Title", $title,
      "-Description", $description,
      "-Kind", $rowKind,
      "-SortOrder", "$rowSort"
    )
    if (-not [string]::IsNullOrWhiteSpace($slug)) {
      $args += @("-Slug", $slug)
    }
    if ($rowPublish) {
      $args += "-Publish"
    }
    & powershell @args
    $ok++
  } catch {
    $failed++
    Write-Host "FAILED: $($f.Name) :: $($_.Exception.Message)" -ForegroundColor Red
  }
  $sortOrder++
}

Write-Host ""
Write-Host "Batch complete. Success=$ok Failed=$failed"
if ($failed -gt 0) {
  exit 1
}
