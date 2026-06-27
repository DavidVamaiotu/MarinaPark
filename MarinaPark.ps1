$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
$BackgroundMode = $args -contains "--background"
$SkipUpdate = $args -contains "--no-update" -or $env:MARINA_SKIP_UPDATE -eq "1"
$UpdateDataDir = Join-Path $PSScriptRoot "data"
$UpdateLogPath = Join-Path $UpdateDataDir "update.log"
$UpdateStatePath = Join-Path $UpdateDataDir "update-state.json"
$DefaultManifestUrl = "https://github.com/DavidVamaiotu/MarinaPark/releases/latest/download/latest.json"

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

function Write-UpdateLog($Message, $Level = "INFO") {
  $line = "{0} [{1}] {2}" -f (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"), $Level, $Message
  Write-Host $Message
  try {
    if (-not (Test-Path -LiteralPath $UpdateDataDir)) {
      New-Item -ItemType Directory -Force -Path $UpdateDataDir | Out-Null
    }
    Add-Content -LiteralPath $UpdateLogPath -Value $line -Encoding UTF8
  } catch {
    # Logging must never prevent the application from starting.
  }
}

function Get-UpdateState {
  if (-not (Test-Path -LiteralPath $UpdateStatePath)) {
    return $null
  }

  try {
    return Get-Content -LiteralPath $UpdateStatePath -Raw | ConvertFrom-Json
  } catch {
    Write-UpdateLog "Starea update-ului nu poate fi citita; pachetul va fi verificat din nou." "WARN"
    return $null
  }
}

function Save-UpdateState($Version, $Sha256) {
  $state = [ordered]@{
    version = [string]$Version
    sha256 = ([string]$Sha256).ToLowerInvariant()
    installedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    installDirectory = $PSScriptRoot
  }
  $temporaryPath = "$UpdateStatePath.tmp"
  $state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $temporaryPath -Encoding UTF8
  Move-Item -LiteralPath $temporaryPath -Destination $UpdateStatePath -Force
}

function Invoke-WithRetry($Operation, [scriptblock]$Action, $Attempts = 3) {
  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
      return & $Action
    } catch {
      if ($attempt -eq $Attempts) {
        throw
      }
      Write-UpdateLog "$Operation a esuat (incercarea $attempt/$Attempts): $($_.Exception.Message)" "WARN"
      Start-Sleep -Seconds (2 * $attempt)
    }
  }
}

function Test-SafeUpdatePath($RelativePath) {
  $pathText = ([string]$RelativePath).Replace("\", "/").TrimStart("/")
  if (-not $pathText -or [IO.Path]::IsPathRooted([string]$RelativePath)) {
    return $false
  }

  $segments = $pathText.Split("/")
  if ($segments -contains "..") {
    return $false
  }

  $blockedRoots = @("data", "node_modules", "dist", "bin", ".git", ".github", ".agents", ".codex")
  return $blockedRoots -notcontains $segments[0].ToLowerInvariant()
}

function Get-RelativeUpdatePath($Root, $FullName) {
  $normalizedRoot = [IO.Path]::GetFullPath($Root).TrimEnd("\", "/")
  $normalizedFile = [IO.Path]::GetFullPath($FullName)
  return $normalizedFile.Substring($normalizedRoot.Length).TrimStart("\", "/")
}

function Get-PackageFiles($SourceRoot) {
  $files = @()
  foreach ($file in Get-ChildItem -LiteralPath $SourceRoot -Recurse -File) {
    $relativePath = Get-RelativeUpdatePath $SourceRoot $file.FullName
    if (-not (Test-SafeUpdatePath $relativePath)) {
      throw "Pachetul contine o cale nepermisa: $relativePath"
    }
    $files += [pscustomobject]@{
      RelativePath = $relativePath
      FullName = $file.FullName
    }
  }
  return $files
}

function Test-InstalledFiles($Remote) {
  if (-not $Remote.files) {
    return $true
  }

  foreach ($entry in $Remote.files) {
    $relativePath = [string]$entry.path
    if (-not (Test-SafeUpdatePath $relativePath) -or -not $entry.sha256) {
      return $false
    }
    $installedPath = Join-Path $PSScriptRoot $relativePath
    if (-not (Test-Path -LiteralPath $installedPath -PathType Leaf)) {
      return $false
    }
    $installedHash = (Get-FileHash -LiteralPath $installedPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($installedHash -ne ([string]$entry.sha256).ToLowerInvariant()) {
      return $false
    }
  }
  return $true
}

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
      manifestUrl = $DefaultManifestUrl
    }
  }

  try {
    $versionInfo = Get-Content -LiteralPath $versionPath -Raw | ConvertFrom-Json
    return [pscustomobject]@{
      version = if ($versionInfo.version) { [string]$versionInfo.version } else { "0.0.0" }
      manifestUrl = if ($versionInfo.manifestUrl) { [string]$versionInfo.manifestUrl } else { $DefaultManifestUrl }
    }
  } catch {
    return [pscustomobject]@{
      version = "0.0.0"
      manifestUrl = $DefaultManifestUrl
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

function Copy-UpdateFile($SourcePath, $RelativePath, $BackupDir) {
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

  Copy-Item -LiteralPath $SourcePath -Destination $destinationPath -Force
}

function Restore-UpdateFiles($AppliedFiles, $BackupDir) {
  for ($index = $AppliedFiles.Count - 1; $index -ge 0; $index--) {
    $record = $AppliedFiles[$index]
    $relativePath = [string]$record.RelativePath
    $backupPath = Join-Path $BackupDir $relativePath
    $destinationPath = Join-Path $PSScriptRoot $relativePath
    if ($record.Existed -and (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
      $destinationParent = Split-Path -Parent $destinationPath
      if ($destinationParent -and -not (Test-Path -LiteralPath $destinationParent)) {
        New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
      }
      Copy-Item -LiteralPath $backupPath -Destination $destinationPath -Force
    } elseif ($record.Existed) {
      if (-not (Test-Path -LiteralPath $destinationPath -PathType Leaf)) {
        throw "Lipseste backup-ul pentru $relativePath."
      }
    } elseif (Test-Path -LiteralPath $destinationPath -PathType Leaf) {
      Remove-Item -LiteralPath $destinationPath -Force
    }
  }
}

function Invoke-MarinaParkUpdate {
  if ($SkipUpdate) {
    Write-UpdateLog "Verificarea update-ului a fost dezactivata."
    return
  }

  $local = Get-LocalVersionInfo
  if (-not $local.manifestUrl) {
    Write-UpdateLog "Update omis: version.json nu contine manifestUrl." "WARN"
    return
  }

  $lockPath = Join-Path $PSScriptRoot ".marina-update.lock"
  $lockStream = $null
  try {
    $lockStream = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
  } catch {
    Write-UpdateLog "Alt update Marina Park ruleaza deja. Continui cu versiunea locala..." "WARN"
    return
  }

  $tempDir = $null
  $backupDir = $null
  $appliedFiles = @()
  $applyStarted = $false
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $separator = if ([string]$local.manifestUrl -match "\?") { "&" } else { "?" }
    $manifestRequestUrl = "$($local.manifestUrl)$($separator)_=$([DateTime]::UtcNow.Ticks)"
    $remote = Invoke-WithRetry "Descarcarea manifestului" {
      Invoke-RestMethod -Uri $manifestRequestUrl -UseBasicParsing -TimeoutSec 15 -Headers @{
        "Cache-Control" = "no-cache"
        "User-Agent" = "MarinaPark-Updater/$($local.version)"
      }
    }
    if (-not $remote.version -or -not $remote.zipUrl) {
      throw "Manifestul update-ului nu contine version si zipUrl."
    }

    $versionComparison = Compare-AppVersion $remote.version $local.version
    $state = Get-UpdateState
    $remoteHash = ([string]$remote.sha256).ToLowerInvariant()
    $stateHash = if ($state) { ([string]$state.sha256).ToLowerInvariant() } else { "" }
    $filesAreCurrent = Test-InstalledFiles $remote
    $samePackageWasApplied = $remoteHash -and $stateHash -eq $remoteHash
    $needsUpdate = $versionComparison -gt 0 -or ($versionComparison -eq 0 -and (-not $samePackageWasApplied -or -not $filesAreCurrent))

    if ($versionComparison -lt 0) {
      Write-UpdateLog "Versiunea locala $($local.version) este mai noua decat release-ul $($remote.version); update omis."
      return
    }

    if (-not $needsUpdate) {
      Write-UpdateLog "Marina Park $($local.version) este actualizat (hash verificat)."
      return
    }

    if ($versionComparison -eq 0) {
      Write-UpdateLog "Reaplic Marina Park $($remote.version): pachetul sau fisierele instalate difera."
    } else {
      Write-UpdateLog "Update Marina Park: $($local.version) -> $($remote.version)"
    }
    $tempDir = Join-Path $env:TEMP ("MarinaParkUpdate-" + [guid]::NewGuid().ToString("N"))
    $extractDir = Join-Path $tempDir "extract"
    $zipPath = Join-Path $tempDir "update.zip"
    $backupDir = Join-Path $PSScriptRoot ("data\update-backups\" + (Get-Date -Format "yyyyMMdd-HHmmss-fff"))
    New-Item -ItemType Directory -Force -Path $tempDir, $extractDir | Out-Null

    Invoke-WithRetry "Descarcarea pachetului" {
      Invoke-WebRequest -Uri $remote.zipUrl -OutFile $zipPath -UseBasicParsing -TimeoutSec 120 -Headers @{
        "Cache-Control" = "no-cache"
        "User-Agent" = "MarinaPark-Updater/$($local.version)"
      }
    } | Out-Null

    if (-not $remoteHash) {
      throw "Manifestul update-ului nu contine sha256."
    }
    $actualHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $remoteHash) {
      throw "Hash-ul update-ului nu corespunde. Update oprit."
    }

    $oldPackageHash = ""
    $packageLockPath = Join-Path $PSScriptRoot "package-lock.json"
    if (Test-Path -LiteralPath $packageLockPath) {
      $oldPackageHash = (Get-FileHash -LiteralPath $packageLockPath -Algorithm SHA256).Hash
    }

    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
    $sourceRoot = Get-UpdateSourceDirectory $extractDir
    $packageFiles = @(Get-PackageFiles $sourceRoot)

    foreach ($requiredFile in $UpdateFileList) {
      if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot $requiredFile) -PathType Leaf)) {
        throw "Pachet incomplet: lipseste $requiredFile."
      }
    }

    if ($remote.files) {
      foreach ($entry in $remote.files) {
        $relativePath = [string]$entry.path
        if (-not (Test-SafeUpdatePath $relativePath) -or -not $entry.sha256) {
          throw "Manifestul contine o intrare de fisier invalida."
        }
        $packagePath = Join-Path $sourceRoot $relativePath
        if (-not (Test-Path -LiteralPath $packagePath -PathType Leaf)) {
          throw "Pachet incomplet: lipseste $relativePath."
        }
        $packageHash = (Get-FileHash -LiteralPath $packagePath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($packageHash -ne ([string]$entry.sha256).ToLowerInvariant()) {
          throw "Hash invalid pentru fisierul $relativePath."
        }
      }
    }

    New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
    $filesToApply = @($packageFiles | Where-Object { $_.RelativePath -ne "version.json" })
    $applyStarted = $true
    foreach ($file in $filesToApply) {
      $appliedFiles += [pscustomobject]@{
        RelativePath = $file.RelativePath
        Existed = Test-Path -LiteralPath (Join-Path $PSScriptRoot $file.RelativePath) -PathType Leaf
      }
      Copy-UpdateFile $file.FullName $file.RelativePath $backupDir
    }

    $newPackageHash = ""
    if (Test-Path -LiteralPath $packageLockPath) {
      $newPackageHash = (Get-FileHash -LiteralPath $packageLockPath -Algorithm SHA256).Hash
    }

    if ($oldPackageHash -ne $newPackageHash -or -not (Test-Path -LiteralPath (Join-Path $PSScriptRoot "node_modules"))) {
      Write-UpdateLog "Actualizez dependentele..."
      try {
        Push-Location $PSScriptRoot
        & npm install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) {
          throw "npm install s-a incheiat cu codul $LASTEXITCODE."
        }
      } finally {
        Pop-Location
      }
    }

    $versionPackageFile = $packageFiles | Where-Object { $_.RelativePath -eq "version.json" } | Select-Object -First 1
    $appliedFiles += [pscustomobject]@{
      RelativePath = $versionPackageFile.RelativePath
      Existed = Test-Path -LiteralPath (Join-Path $PSScriptRoot $versionPackageFile.RelativePath) -PathType Leaf
    }
    Copy-UpdateFile $versionPackageFile.FullName $versionPackageFile.RelativePath $backupDir
    Save-UpdateState $remote.version $remoteHash
    Write-UpdateLog "Update Marina Park finalizat: versiunea $($remote.version), hash $remoteHash."
  } catch {
    $failure = $_.Exception.Message
    if ($applyStarted -and $backupDir -and (Test-Path -LiteralPath $backupDir)) {
      try {
        Restore-UpdateFiles $appliedFiles $backupDir
        Write-UpdateLog "Fisierele versiunii anterioare au fost restaurate." "WARN"
      } catch {
        Write-UpdateLog "Rollback incomplet: $($_.Exception.Message)" "ERROR"
      }
    }
    Write-UpdateLog "Update Marina Park esuat: $failure" "ERROR"
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

& node "$PSScriptRoot\MarinaPark"
if ($LASTEXITCODE -ne 0) {
  Write-UpdateLog "Launcherul Marina Park s-a inchis cu codul $LASTEXITCODE." "ERROR"
}
if (-not $BackgroundMode) {
  Read-Host "Apasa Enter pentru inchidere"
}
