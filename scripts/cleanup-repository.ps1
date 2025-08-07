# Repository Cleanup Script
# Cleans up old files, organizes components, and improves repository structure

param(
    [switch]$DryRun = $false,
    [switch]$Verbose = $false
)

Write-Host "Repository Cleanup Script" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

if ($DryRun) {
    Write-Host "DRY RUN MODE - No files will be deleted" -ForegroundColor Yellow
}

$rootPath = Split-Path $PSScriptRoot -Parent
$deletedFiles = @()
$movedFiles = @()
$createdDirs = @()

function Write-Action {
    param($Action, $Path, $Color = "Green")
    if ($Verbose -or $DryRun) {
        Write-Host "  $Action`: $Path" -ForegroundColor $Color
    }
}

function Remove-FileIfExists {
    param($FilePath)
    if (Test-Path $FilePath) {
        Write-Action "DELETE" $FilePath "Red"
        if (-not $DryRun) {
            Remove-Item $FilePath -Force
        }
        $deletedFiles += $FilePath
        return $true
    }
    return $false
}

function Move-FileIfExists {
    param($Source, $Destination)
    if (Test-Path $Source) {
        $destDir = Split-Path $Destination -Parent
        if (-not (Test-Path $destDir)) {
            Write-Action "CREATE DIR" $destDir "Blue"
            if (-not $DryRun) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            $createdDirs += $destDir
        }
        Write-Action "MOVE" "$Source -> $Destination" "Yellow"
        if (-not $DryRun) {
            Move-Item $Source $Destination -Force
        }
        $movedFiles += "$Source -> $Destination"
        return $true
    }
    return $false
}

# 1. Remove Legacy Release Archives
Write-Host "`nCleaning up legacy release archives..." -ForegroundColor Magenta
$releaseArchives = @(
    "distract_me_not-3.0.0.zip",
    "distract_me_not-3.1.0-chrome.zip",
    "distract_me_not-3.1.0-edge.zip", 
    "distract_me_not-3.1.0-firefox.zip",
    "distract_me_not-3.1.1-edge.zip"
)

foreach ($archive in $releaseArchives) {
    Remove-FileIfExists (Join-Path $rootPath $archive)
}

# 2. Clean up old build snapshots (keep only last 5)
Write-Host "`n📸 Cleaning up old build snapshots..." -ForegroundColor Magenta
$snapshotsPath = Join-Path $rootPath "snapshots"
if (Test-Path $snapshotsPath) {
    $snapshots = Get-ChildItem $snapshotsPath -Filter "dmn-build-snapshot-*.zip" | Sort-Object CreationTime -Descending
    if ($snapshots.Count -gt 5) {
        $toDelete = $snapshots | Select-Object -Skip 5
        foreach ($snapshot in $toDelete) {
            Remove-FileIfExists $snapshot.FullName
        }
        Write-Host "  Kept newest 5 snapshots, removed $($toDelete.Count) old ones" -ForegroundColor Green
    } else {
        Write-Host "  Only $($snapshots.Count) snapshots found, keeping all" -ForegroundColor Green
    }
}

# 3. Remove temporary and development files
Write-Host "`n🗑️  Removing temporary and development files..." -ForegroundColor Magenta
$tempFiles = @(
    "temp-log-test.js",
    "test-report.xml", 
    "eslint-results.sarif",
    "cleanup-root-tests.ps1",
    "extension-id-info.txt"
)

foreach ($file in $tempFiles) {
    Remove-FileIfExists (Join-Path $rootPath $file)
}

# 4. Remove legacy documentation
Write-Host "`n📄 Removing completed/legacy documentation..." -ForegroundColor Magenta
$legacyDocs = @(
    "status-report-final.md",
    "KEYWORD-BLOCKING-FIX-SUMMARY.md", 
    "NODEJS-16-COMPATIBILITY.md",
    "DEPENDENCY-UPGRADE-PLAN-COMPLETED.md",
    "SECURITY-UPGRADE-STRATEGY.md",
    "SECURITY-UPGRADES.md"
)

foreach ($doc in $legacyDocs) {
    Remove-FileIfExists (Join-Path $rootPath $doc)
}

# 5. Clean up backup component files
Write-Host "`n🔧 Cleaning up backup component files..." -ForegroundColor Magenta
$blockedPath = Join-Path $rootPath "src\components\Blocked"
$backupFiles = @(
    "index.bak2.jsx",
    "index.bak3.jsx",
    "index.bak4.jsx", 
    "index.bak5.jsx",
    "index.bak6.jsx",
    "index.jsx.backup",
    "index.jsx.clean",
    "index.jsx.new"
)

foreach ($backup in $backupFiles) {
    Remove-FileIfExists (Join-Path $blockedPath $backup)
}

# 6. Organize component variants
Write-Host "`n📁 Organizing component variants..." -ForegroundColor Magenta
$variantsPath = Join-Path $blockedPath "variants"
$variants = @(
    "index.clean.jsx",
    "index.debug.jsx", 
    "index.highcontrast.jsx",
    "index.simplified.jsx",
    "index.subtle.jsx",
    "index.terminology.jsx"
)

foreach ($variant in $variants) {
    $source = Join-Path $blockedPath $variant
    $dest = Join-Path $variantsPath $variant
    Move-FileIfExists $source $dest
}

# 7. Update .gitignore to prevent future accumulation
Write-Host "`n⚙️  Updating .gitignore..." -ForegroundColor Magenta
$gitignorePath = Join-Path $rootPath ".gitignore"
$gitignoreAdditions = @"

# Temporary and development files
temp-*.js
test-report.xml
eslint-results.sarif
*.log

# Build snapshots (keep only in snapshots/ directory)
*.zip
!snapshots/*.zip

# Backup files
*.bak
*.backup
*.old
*.temp

# IDE and editor files
.vscode/settings.json
.idea/

"@

if (-not $DryRun) {
    Add-Content -Path $gitignorePath -Value $gitignoreAdditions
}
Write-Action "UPDATE" ".gitignore (added cleanup patterns)" "Green"

# Summary
Write-Host "`n✅ Cleanup Summary:" -ForegroundColor Green
Write-Host "===================" -ForegroundColor Green
Write-Host "  📄 Files deleted: $($deletedFiles.Count)" -ForegroundColor Red
Write-Host "  📁 Files moved: $($movedFiles.Count)" -ForegroundColor Yellow  
Write-Host "  📂 Directories created: $($createdDirs.Count)" -ForegroundColor Blue

if ($Verbose -and $deletedFiles.Count -gt 0) {
    Write-Host "`n🗑️  Deleted files:" -ForegroundColor Red
    $deletedFiles | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed }
}

if ($Verbose -and $movedFiles.Count -gt 0) {
    Write-Host "`n📦 Moved files:" -ForegroundColor Yellow
    $movedFiles | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkYellow }
}

if ($DryRun) {
    Write-Host "`nThis was a DRY RUN - no actual changes were made" -ForegroundColor Yellow
    Write-Host "    Run again without -DryRun to execute the cleanup" -ForegroundColor Yellow
} else {
    Write-Host "`nRepository cleanup completed successfully!" -ForegroundColor Green
}
