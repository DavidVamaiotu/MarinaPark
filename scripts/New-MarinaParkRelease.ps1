param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^\d+\.\d+\.\d+(-[A-Za-z0-9.-]+)?$")]
  [string]$Version,

  [string]$Repository = "DavidVamaiotu/MarinaPark",

  [string]$ManifestUrl = "https://github.com/DavidVamaiotu/MarinaPark/releases/latest/download/latest.json",

  [string]$ZipUrl = ""
)

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$DistDir = Join-Path $RootDir "dist"
$PackageName = "MarinaPark-$Version"
$ZipName = "$PackageName.zip"
$ZipPath = Join-Path $DistDir $ZipName
$ManifestPath = Join-Path $DistDir "latest.json"
$TempDir = Join-Path $env:TEMP ("MarinaParkRelease-" + [guid]::NewGuid().ToString("N"))
$PackageDir = Join-Path $TempDir $PackageName

if (-not $ZipUrl) {
  $ZipUrl = "https://github.com/$Repository/releases/download/v$Version/$ZipName"
}

$ReleaseFiles = @(
  "activity.css",
  "activity.html",
  "activity.js",
  "app.js",
  "index.html",
  "MarinaPark",
  "MarinaPark.bat",
  "MarinaPark.ps1",
  "MarinaPark.vbs",
  "package-lock.json",
  "package.json",
  "README.md",
  "scripts\New-MarinaParkRelease.ps1",
  "server.js",
  "styles.css",
  "version.json"
)

function Copy-ReleaseFile($RelativePath) {
  $sourcePath = Join-Path $RootDir $RelativePath
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Lipseste fisierul pentru release: $RelativePath"
  }

  $destinationPath = Join-Path $PackageDir $RelativePath
  $destinationParent = Split-Path -Parent $destinationPath
  if ($destinationParent -and -not (Test-Path -LiteralPath $destinationParent)) {
    New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
  }

  Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
}

try {
  New-Item -ItemType Directory -Force -Path $DistDir, $PackageDir | Out-Null

  $versionInfo = [ordered]@{
    version = $Version
    manifestUrl = $ManifestUrl
  }

  $versionJson = $versionInfo | ConvertTo-Json -Depth 3
  Set-Content -LiteralPath (Join-Path $RootDir "version.json") -Value $versionJson -Encoding UTF8

  foreach ($relativePath in $ReleaseFiles) {
    Copy-ReleaseFile $relativePath
  }

  $fileManifest = @(
    foreach ($relativePath in $ReleaseFiles) {
      $packageFile = Join-Path $PackageDir $relativePath
      [ordered]@{
        path = $relativePath.Replace("\", "/")
        sha256 = (Get-FileHash -LiteralPath $packageFile -Algorithm SHA256).Hash.ToLowerInvariant()
      }
    }
  )

  if (Test-Path -LiteralPath $ZipPath) {
    Remove-Item -LiteralPath $ZipPath -Force
  }

  Compress-Archive -Path (Join-Path $PackageDir "*") -DestinationPath $ZipPath -Force

  $sha256 = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $manifest = [ordered]@{
    version = $Version
    zipUrl = $ZipUrl
    sha256 = $sha256
    createdAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    files = $fileManifest
  }

  $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8

  Write-Host "Release pregatit:"
  Write-Host "  ZIP:      $ZipPath"
  Write-Host "  Manifest: $ManifestPath"
  Write-Host ""
  Write-Host "In GitHub, creeaza release-ul v$Version si incarca ambele fisiere:"
  Write-Host "  $ZipName"
  Write-Host "  latest.json"
} finally {
  if (Test-Path -LiteralPath $TempDir) {
    Remove-Item -LiteralPath $TempDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}
