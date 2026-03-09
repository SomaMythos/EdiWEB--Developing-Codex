param(
    [int]$BackendPort = 8000,
    [switch]$UseTunnel,
    [switch]$UseDevClient
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot "backend"
$mobileDir = Join-Path $repoRoot "mobile"

function Get-LanIpAddress {
    $addresses = Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp, Manual -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notlike "127.*" -and
            $_.IPAddress -notlike "169.254.*"
        } |
        Sort-Object InterfaceMetric

    if ($addresses) {
        return $addresses[0].IPAddress
    }

    $fallback = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
        Where-Object {
            $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
            $_.IPAddressToString -notlike "127.*"
        } |
        Select-Object -First 1

    if ($fallback) {
        return $fallback.IPAddressToString
    }

    throw "Nao foi possivel detectar um IP local da maquina."
}

function Ensure-PathExists($path, $label) {
    if (-not (Test-Path $path)) {
        throw "$label nao encontrado em $path"
    }
}

Ensure-PathExists $backendDir "Diretorio do backend"
Ensure-PathExists $mobileDir "Diretorio do mobile"

$apiHost = Get-LanIpAddress
$apiUrl = "http://${apiHost}:${BackendPort}/api"
$expoMode = if ($UseTunnel) { "--tunnel" } else { "--lan" }
$expoCommand = if ($UseDevClient) { "npm.cmd run start:dev-client -- $expoMode" } else { "npm.cmd start -- $expoMode" }
$appMode = if ($UseDevClient) { "Development Build" } else { "Expo Go" }

$backendCommand = @(
    "Set-Location '$backendDir'"
    "if (Get-Command py -ErrorAction SilentlyContinue) { py -m uvicorn main:app --reload --host 0.0.0.0 --port $BackendPort }"
    "elseif (Get-Command python -ErrorAction SilentlyContinue) { python -m uvicorn main:app --reload --host 0.0.0.0 --port $BackendPort }"
    "else { Write-Error 'Python nao encontrado no PATH.' }"
) -join "; "

$mobileCommand = @(
    "Set-Location '$mobileDir'"
    "`$env:EXPO_PUBLIC_API_URL = '$apiUrl'"
    $expoCommand
) -join "; "

Write-Host ""
Write-Host "========================================"
Write-Host " EDI Mobile Test Launcher"
Write-Host "========================================"
Write-Host "Backend: http://${apiHost}:${BackendPort}"
Write-Host "API:     $apiUrl"
Write-Host "Expo:    $expoMode"
Write-Host "Modo:    $appMode"
Write-Host "========================================"
Write-Host ""

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command", $backendCommand
) -WorkingDirectory $backendDir -WindowStyle Normal

Start-Sleep -Seconds 3

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-Command", $mobileCommand
) -WorkingDirectory $mobileDir -WindowStyle Normal

Write-Host "Abri duas janelas: backend e Expo."
Write-Host "Quando o bundler abrir, use o app correspondente no celular."
Write-Host ""
Write-Host "Expo Go:"
Write-Host "powershell -ExecutionPolicy Bypass -File .\scripts\start_mobile_qr.ps1"
Write-Host ""
Write-Host "Development Build:"
Write-Host "powershell -ExecutionPolicy Bypass -File .\scripts\start_mobile_qr.ps1 -UseDevClient"
