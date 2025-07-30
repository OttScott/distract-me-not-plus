# Local CI Integration Test Script
# This script simulates the CI pipeline locally to catch issues before pushing

param(
    [switch]$Fix,           # Fix formatting and linting issues
    [switch]$SkipBuild,     # Skip the build step for faster testing
    [switch]$Verbose        # Show detailed output
)

$ErrorActionPreference = "Stop"
$OriginalLocation = Get-Location

function Write-Status {
    param($Message, $Type = "Info")
    $timestamp = Get-Date -Format "HH:mm:ss"
    switch ($Type) {
        "Success" { Write-Host "[$timestamp] Success: $Message" -ForegroundColor Green }
        "Error"   { Write-Host "[$timestamp] Error: $Message" -ForegroundColor Red }
        "Warning" { Write-Host "[$timestamp] Warning: $Message" -ForegroundColor Yellow }
        "Info"    { Write-Host "[$timestamp] Info: $Message" -ForegroundColor Cyan }
        "Step"    { Write-Host "[$timestamp] Step: $Message" -ForegroundColor Blue }
    }
}

function Test-Command {
    param($Command, $Description)
    Write-Status "Running: $Description" "Step"
    if ($Verbose) { Write-Host "Command: $Command" -ForegroundColor Gray }
    
    $result = Invoke-Expression $Command
    if ($LASTEXITCODE -eq 0) {
        Write-Status "$Description completed successfully" "Success"
        return $true
    } else {
        Write-Status "$Description failed with exit code $LASTEXITCODE" "Error"
        return $false
    }
}

try {
    Write-Status "Starting Local CI Integration Check" "Info"
    Write-Status "Working Directory: $PWD" "Info"
    
    # Step 1: Check Node.js and npm
    Write-Status "Checking Node.js and npm versions" "Step"
    node --version
    npm --version
    
    # Step 2: Install dependencies if needed
    if (!(Test-Path "node_modules")) {
        Write-Status "Installing dependencies..." "Step"
        npm ci
    }
    
    # Step 3: Clean previous artifacts
    Write-Status "Cleaning previous artifacts" "Step"
    Remove-Item "eslint-results.sarif" -ErrorAction SilentlyContinue
    Remove-Item "coverage" -Recurse -ErrorAction SilentlyContinue
    
    $allPassed = $true
    
    # Step 4: Format Check (or Fix)
    if ($Fix) {
        Write-Status "Auto-fixing formatting issues" "Step"
        if (!(Test-Command 'npm run format' "Format Fix")) { $allPassed = $false }
    } else {
        Write-Status "Checking code formatting" "Step"
        if (!(Test-Command 'npm run format:check' "Format Check")) { 
            Write-Status "Formatting issues found. Run with -Fix to auto-fix." "Warning"
            $allPassed = $false 
        }
    }
    
    # Step 5: Linting Check (or Fix)
    if ($Fix) {
        Write-Status "Auto-fixing linting issues" "Step"
        if (!(Test-Command 'npm run lint:fix' "Lint Fix")) { $allPassed = $false }
    }
    
    Write-Status "Running ESLint with zero warnings" "Step"
    if (!(Test-Command 'npm run lint:ci' "Lint Check")) { $allPassed = $false }
    
    # Step 6: Generate SARIF for CodeQL
    Write-Status "Generating SARIF file for security scanning" "Step"
    if (!(Test-Command 'npm run lint:sarif' "SARIF Generation")) { $allPassed = $false }
    
    # Verify SARIF file was created
    if (Test-Path "eslint-results.sarif") {
        $sarifSize = (Get-Item "eslint-results.sarif").Length
        Write-Status "SARIF file created successfully - $sarifSize bytes" "Success"
        
        # Validate SARIF is valid JSON
        try {
            Get-Content "eslint-results.sarif" | ConvertFrom-Json | Out-Null
            Write-Status "SARIF file is valid JSON" "Success"
        } catch {
            Write-Status "SARIF file is not valid JSON" "Error"
            $allPassed = $false
        }
    } else {
        Write-Status "SARIF file was not created" "Error"
        $allPassed = $false
    }
    
    # Step 7: Run Tests with Coverage
    Write-Status "Running test suite with coverage" "Step"
    if (!(Test-Command 'npm run test:ci' "Test Suite")) { $allPassed = $false }
    
    # Step 8: Build Application (optional)
    if (!$SkipBuild) {
        Write-Status "Building application" "Step"
        if (!(Test-Command 'npm run build' "Build")) { $allPassed = $false }
        
        if (Test-Path "build") {
            $buildSize = Get-ChildItem "build" -Recurse | Measure-Object -Property Length -Sum
            $buildSizeMB = [math]::Round($buildSize.Sum/1MB, 2)
            Write-Status "Build completed successfully - $buildSizeMB MB" "Success"
        }
    } else {
        Write-Status "Skipping build step as requested" "Info"
    }
    
    # Final Results
    Write-Status "================================" "Info"
    if ($allPassed) {
        Write-Status "All CI checks passed! Ready to push." "Success"
        Write-Status "Your code should pass all CI pipeline checks." "Success"
        exit 0
    } else {
        Write-Status "Some CI checks failed!" "Error"
        Write-Status "Please fix the issues above before pushing." "Error"
        if (!$Fix) {
            Write-Status "Try running with -Fix to auto-fix formatting and linting issues." "Info"
        }
        exit 1
    }
    
} catch {
    Write-Status "Script execution failed: $($_.Exception.Message)" "Error"
    exit 1
} finally {
    Set-Location $OriginalLocation
}