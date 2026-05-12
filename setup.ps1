# WordScript — First-time setup (Windows)
# Run once after cloning: .\setup.ps1

$ErrorActionPreference = "Stop"

git config core.hooksPath hooks
Write-Host "[OK] Git hooks activated" -ForegroundColor Green

& "$PSScriptRoot\setup-tauri.ps1"
