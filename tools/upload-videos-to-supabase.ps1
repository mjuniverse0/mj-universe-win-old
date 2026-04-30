param(
  [Parameter(Mandatory = $true)]
  [string]$VideoPath,

  [Parameter(Mandatory = $true)]
  [string]$Title,

  [string]$Description = "",
  [string]$Slug = "",
  [string]$Kind = "vlog",
  [int]$SortOrder = 0,
  [switch]$Publish
)

$ErrorActionPreference = "Stop"

function Get-EnvOrThrow([string]$name) {
  $value = [Environment]::GetEnvironmentVariable($name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing env var: $name"
  }
  return $value.Trim()
}

function To-Slug([string]$s) {
  $v = $s.ToLowerInvariant()
  $v = [Regex]::Replace($v, "[^a-z0-9]+", "-")
  $v = [Regex]::Replace($v, "^-+|-+$", "")
  if ($v.Length -lt 2) { $v = "video-" + (Get-Random -Minimum 1000 -Maximum 9999) }
  if ($v.Length -gt 63) { $v = $v.Substring(0, 63).TrimEnd("-") }
  return $v
}

if (-not (Test-Path $VideoPath)) {
  throw "Video path not found: $VideoPath"
}

$supabaseUrl = Get-EnvOrThrow "MJ_SUPABASE_URL"
$serviceRole = Get-EnvOrThrow "MJ_SUPABASE_SERVICE_ROLE_KEY"
$bucket = [Environment]::GetEnvironmentVariable("MJ_SUPABASE_VIDEO_BUCKET")
if ([string]::IsNullOrWhiteSpace($bucket)) { $bucket = "mj-videos" }

$file = Get-Item $VideoPath
$nameNoExt = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
$slugValue = if ([string]::IsNullOrWhiteSpace($Slug)) { To-Slug $nameNoExt } else { To-Slug $Slug }
$ext = $file.Extension.ToLowerInvariant()

$contentType = switch ($ext) {
  ".mp4" { "video/mp4" }
  ".webm" { "video/webm" }
  ".mov" { "video/quicktime" }
  default { "application/octet-stream" }
}

$storagePath = "watch/$slugValue$ext"
$uploadUrl = "$supabaseUrl/storage/v1/object/$bucket/$storagePath"

Write-Host "Uploading file to Supabase Storage..."
Invoke-RestMethod `
  -Method Post `
  -Uri "${uploadUrl}?upsert=true" `
  -Headers @{
    "apikey" = $serviceRole
    "Authorization" = "Bearer $serviceRole"
    "x-upsert" = "true"
  } `
  -ContentType $contentType `
  -InFile $file.FullName | Out-Null

$publicUrl = "$supabaseUrl/storage/v1/object/public/$bucket/$storagePath"
$publishBool = $false
if ($Publish.IsPresent) { $publishBool = $true }

$payload = @(
  @{
    slug = $slugValue
    title = $Title
    description = $Description
    video_file_url = $publicUrl
    content_kind = $Kind
    is_published = $publishBool
    sort_order = $SortOrder
  }
) | ConvertTo-Json -Depth 4

Write-Host "Upserting watch_videos row..."
Invoke-RestMethod `
  -Method Post `
  -Uri "$supabaseUrl/rest/v1/watch_videos?on_conflict=slug" `
  -Headers @{
    "apikey" = $serviceRole
    "Authorization" = "Bearer $serviceRole"
    "Content-Type" = "application/json"
    "Prefer" = "resolution=merge-duplicates,return=representation"
  } `
  -Body $payload | Out-Null

Write-Host ""
Write-Host "Done."
Write-Host "Slug: $slugValue"
Write-Host "Public video URL: $publicUrl"
Write-Host "Watch URL: https://mj-universe.watch/?v=$slugValue"
