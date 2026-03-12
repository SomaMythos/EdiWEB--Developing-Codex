$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $root "frontend"
$backendScript = Join-Path $root "scripts/run_backend_dev.bat"
$frontendScript = Join-Path $root "scripts/run_frontend_dev.bat"
$frontendUrl = "http://127.0.0.1:3000"
$backendUrl = "http://127.0.0.1:8000"
$browserUrl = "http://localhost:3000"

function Test-UrlReady {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
    }
    catch {
        return $false
    }
}

if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
    Start-Process -FilePath "npm.cmd" -ArgumentList "install" -WorkingDirectory $frontendDir -WindowStyle Hidden -Wait
}

if (-not (Test-UrlReady $backendUrl)) {
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "`"$backendScript`"" -WorkingDirectory $root -WindowStyle Hidden
}

Start-Sleep -Seconds 3

if (-not (Test-UrlReady $frontendUrl)) {
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "`"$frontendScript`"" -WorkingDirectory $root -WindowStyle Hidden
}

$deadline = (Get-Date).AddSeconds(75)
while ((Get-Date) -lt $deadline) {
    if (Test-UrlReady $frontendUrl) {
        break
    }
    Start-Sleep -Seconds 2
}

Start-Process $browserUrl
