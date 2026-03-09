param(
    [string]$TargetDir = 'D:\Studio\Projects\edi-mobile-build'
)

$ErrorActionPreference = 'Stop'

$sourceDir = 'D:\Studio\Projects\EdiWEB--Developing\mobile'

if (-not (Test-Path $sourceDir)) {
    throw "Mobile source not found: $sourceDir"
}

if (Test-Path $TargetDir) {
    Remove-Item -Recurse -Force $TargetDir
}

New-Item -ItemType Directory -Path $TargetDir | Out-Null

robocopy $sourceDir $TargetDir /E /XD node_modules .expo android ios | Out-Null

$gitignore = Join-Path $TargetDir '.gitignore'
@"
node_modules/
.expo/
android/
ios/
dist/
*.log
"@ | Set-Content -Path $gitignore

Set-Location $TargetDir

if (-not (Test-Path (Join-Path $TargetDir '.git'))) {
    git init | Out-Null
}

git add . | Out-Null

Write-Host "Installing npm dependencies in standalone workspace..."
cmd /c "cd /d $TargetDir && npm.cmd install"

Write-Host "Standalone mobile build workspace ready: $TargetDir"
Write-Host "Next commands:"
Write-Host "  cd /d $TargetDir"
Write-Host "  npx eas-cli build --platform android --profile development"
