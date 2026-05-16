$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
$BackgroundMode = $args -contains "--background"
$SkipUpdate = $args -contains "--no-update" -or $env:MARINA_SKIP_UPDATE -eq "1"

$UpdateFileList = @(
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

function Refresh-Path {
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machinePath;$userPath"
}

function Install-Node {
  Write-Host "Node.js nu este instalat. Incerc instalarea automata..."

  if (Get-Command winget -ErrorAction SilentlyContinue) {
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    Refresh-Path
    if (Get-Command node -ErrorAction SilentlyContinue) {
      return
    }
  }

  Write-Host "winget nu a putut instala Node.js. Incerc instalarea cu installer MSI..."
  $installer = Join-Path $env:TEMP "node-lts-x64.msi"
  $nodeRelease = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" |
    Where-Object { $_.lts } |
    Select-Object -First 1
  $nodeUrl = "https://nodejs.org/dist/$($nodeRelease.version)/$($nodeRelease.version)-x64.msi"
  Invoke-WebRequest -Uri $nodeUrl -OutFile $installer
  Start-Process msiexec.exe -Wait -ArgumentList "/i", "`"$installer`"", "/qn", "/norestart"
  Refresh-Path
}

function Get-LocalVersionInfo {
  $versionPath = Join-Path $PSScriptRoot "version.json"
  if (-not (Test-Path -LiteralPath $versionPath)) {
    return [pscustomobject]@{
      version = "0.0.0"
      manifestUrl = ""
    }
  }

  try {
    return Get-Content -LiteralPath $versionPath -Raw | ConvertFrom-Json
  } catch {
    return [pscustomobject]@{
      version = "0.0.0"
      manifestUrl = ""
    }
  }
}

function Compare-AppVersion($RemoteVersion, $LocalVersion) {
  try {
    return ([version]$RemoteVersion).CompareTo([version]$LocalVersion)
  } catch {
    return [string]::Compare([string]$RemoteVersion, [string]$LocalVersion, $true)
  }
}

function Get-UpdateSourceDirectory($ExtractDir) {
  if (Test-Path -LiteralPath (Join-Path $ExtractDir "app.js")) {
    return $ExtractDir
  }

  $candidate = Get-ChildItem -LiteralPath $ExtractDir -Directory |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "app.js") } |
    Select-Object -First 1

  if ($candidate) {
    return $candidate.FullName
  }

  throw "Pachetul de update nu contine app.js."
}

function Copy-UpdateFile($SourceRoot, $RelativePath, $BackupDir) {
  $sourcePath = Join-Path $SourceRoot $RelativePath
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    return
  }

  $destinationPath = Join-Path $PSScriptRoot $RelativePath
  $destinationParent = Split-Path -Parent $destinationPath
  if ($destinationParent -and -not (Test-Path -LiteralPath $destinationParent)) {
    New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
  }

  if (Test-Path -LiteralPath $destinationPath) {
    $backupPath = Join-Path $BackupDir $RelativePath
    $backupParent = Split-Path -Parent $backupPath
    if ($backupParent -and -not (Test-Path -LiteralPath $backupParent)) {
      New-Item -ItemType Directory -Force -Path $backupParent | Out-Null
    }
    Copy-Item -LiteralPath $destinationPath -Destination $backupPath -Recurse -Force
  }

  Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Recurse -Force
}

function Invoke-MarinaParkUpdate {
  if ($SkipUpdate) {
    return
  }

  $local = Get-LocalVersionInfo
  if (-not $local.manifestUrl) {
    return
  }

  $lockPath = Join-Path $PSScriptRoot ".marina-update.lock"
  $lockStream = $null
  try {
    $lockStream = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
  } catch {
    Write-Host "Alt update Marina Park ruleaza deja. Continui cu versiunea locala..."
    return
  }

  $tempDir = $null
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $remote = Invoke-RestMethod -Uri $local.manifestUrl -UseBasicParsing -TimeoutSec 8
    if (-not $remote.version -or -not $remote.zipUrl) {
      return
    }

    if ((Compare-AppVersion $remote.version $local.version) -le 0) {
      return
    }

    Write-Host "Update Marina Park: $($local.version) -> $($remote.version)"
    $tempDir = Join-Path $env:TEMP ("MarinaParkUpdate-" + [guid]::NewGuid().ToString("N"))
    $extractDir = Join-Path $tempDir "extract"
    $zipPath = Join-Path $tempDir "update.zip"
    $backupDir = Join-Path $PSScriptRoot ("data\update-backups\" + (Get-Date -Format "yyyyMMdd-HHmmss"))
    New-Item -ItemType Directory -Force -Path $tempDir, $extractDir, $backupDir | Out-Null

    Invoke-WebRequest -Uri $remote.zipUrl -OutFile $zipPath -UseBasicParsing -TimeoutSec 60

    if ($remote.sha256) {
      $actualHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
      if ($actualHash -ne ([string]$remote.sha256).ToLowerInvariant()) {
        throw "Hash-ul update-ului nu corespunde. Update oprit."
      }
    }

    $oldPackageHash = ""
    $packageLockPath = Join-Path $PSScriptRoot "package-lock.json"
    if (Test-Path -LiteralPath $packageLockPath) {
      $oldPackageHash = (Get-FileHash -LiteralPath $packageLockPath -Algorithm SHA256).Hash
    }

    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
    $sourceRoot = Get-UpdateSourceDirectory $extractDir

    foreach ($relativePath in $UpdateFileList) {
      Copy-UpdateFile $sourceRoot $relativePath $backupDir
    }

    $newPackageHash = ""
    if (Test-Path -LiteralPath $packageLockPath) {
      $newPackageHash = (Get-FileHash -LiteralPath $packageLockPath -Algorithm SHA256).Hash
    }

    if ($oldPackageHash -ne $newPackageHash -or -not (Test-Path -LiteralPath (Join-Path $PSScriptRoot "node_modules"))) {
      Write-Host "Actualizez dependentele..."
      Push-Location $PSScriptRoot
      npm install
      Pop-Location
    }

    Write-Host "Update Marina Park finalizat."
  } catch {
    Write-Host "Update Marina Park sarit: $($_.Exception.Message)"
  } finally {
    if ($lockStream) {
      $lockStream.Close()
      $lockStream.Dispose()
    }
    if (Test-Path -LiteralPath $lockPath) {
      Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
    }
    if ($tempDir -and (Test-Path -LiteralPath $tempDir)) {
      Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Install-Node
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js nu s-a putut instala automat."
  Write-Host "Instaleaza Node.js manual de pe https://nodejs.org/ si porneste din nou MarinaPark.bat."
  if (-not $BackgroundMode) {
    Read-Host "Apasa Enter pentru inchidere"
  }
  exit 1
}

Invoke-MarinaParkUpdate

node "$PSScriptRoot\MarinaPark"
if (-not $BackgroundMode) {
  Read-Host "Apasa Enter pentru inchidere"
}
