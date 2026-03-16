$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $root "frontend"
$backendScript = Join-Path $root "scripts\run_backend_dev.bat"
$frontendScript = Join-Path $root "scripts\run_frontend_dev.bat"
$iconPath = Join-Path $root "icon.ico"
$frontendUrl = "http://127.0.0.1:3000"
$backendUrl = "http://127.0.0.1:8000"
$browserUrl = "http://localhost:3000"
$mutexName = "EDIWebSilentTrayLauncher"

$script:startedProcessIds = New-Object System.Collections.Generic.List[int]
$script:isExiting = $false

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

function Start-ManagedProcess {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$ArgumentList = @(),
        [string]$WorkingDirectory = $root,
        [switch]$Wait
    )

    $startInfo = @{
        FilePath = $FilePath
        ArgumentList = $ArgumentList
        WorkingDirectory = $WorkingDirectory
        WindowStyle = "Hidden"
        PassThru = $true
    }

    if ($Wait) {
        $startInfo["Wait"] = $true
    }

    $process = Start-Process @startInfo
    if ($process -and -not $Wait) {
        [void]$script:startedProcessIds.Add($process.Id)
    }

    return $process
}

function Stop-ManagedProcesses {
    $pids = $script:startedProcessIds | Select-Object -Unique | Sort-Object -Descending
    foreach ($managedProcessId in $pids) {
        try {
            if (Get-Process -Id $managedProcessId -ErrorAction SilentlyContinue) {
                Start-Process -FilePath "taskkill.exe" -ArgumentList @("/PID", $managedProcessId, "/T", "/F") -WindowStyle Hidden -Wait | Out-Null
            }
        }
        catch {
        }
    }

    $script:startedProcessIds.Clear()
}

function Open-App {
    Start-Process $browserUrl | Out-Null
}

function Get-StatusText {
    $frontendReady = Test-UrlReady $frontendUrl
    $backendReady = Test-UrlReady $backendUrl

    if ($frontendReady -and $backendReady) {
        return "EDI Web em execução"
    }

    if ($frontendReady) {
        return "Frontend pronto"
    }

    if ($backendReady) {
        return "Backend pronto"
    }

    return "Iniciando serviços"
}

[System.Windows.Forms.Application]::EnableVisualStyles()

$createdNew = $false
$mutex = New-Object System.Threading.Mutex($true, $mutexName, [ref]$createdNew)
if (-not $createdNew) {
    Open-App
    exit 0
}

$appContext = New-Object System.Windows.Forms.ApplicationContext
$notifyIcon = New-Object System.Windows.Forms.NotifyIcon
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip
$openMenuItem = New-Object System.Windows.Forms.ToolStripMenuItem
$reopenMenuItem = New-Object System.Windows.Forms.ToolStripMenuItem
$statusMenuItem = New-Object System.Windows.Forms.ToolStripMenuItem
$exitMenuItem = New-Object System.Windows.Forms.ToolStripMenuItem
$statusTimer = New-Object System.Windows.Forms.Timer

if (Test-Path $iconPath) {
    $notifyIcon.Icon = New-Object System.Drawing.Icon($iconPath)
}
else {
    $notifyIcon.Icon = [System.Drawing.SystemIcons]::Application
}

$notifyIcon.Text = "EDI Web"
$notifyIcon.Visible = $true

$openMenuItem.Text = "Abrir EDI"
$reopenMenuItem.Text = "Reabrir no navegador"
$statusMenuItem.Text = "Iniciando serviços"
$statusMenuItem.Enabled = $false
$exitMenuItem.Text = "Encerrar EDI"

[void]$contextMenu.Items.Add($openMenuItem)
[void]$contextMenu.Items.Add($reopenMenuItem)
[void]$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
[void]$contextMenu.Items.Add($statusMenuItem)
[void]$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
[void]$contextMenu.Items.Add($exitMenuItem)

$notifyIcon.ContextMenuStrip = $contextMenu

$shutdown = {
    if ($script:isExiting) {
        return
    }

    $script:isExiting = $true
    $statusTimer.Stop()
    $notifyIcon.Visible = $false
    Stop-ManagedProcesses

    try {
        $notifyIcon.Dispose()
        $contextMenu.Dispose()
        $statusTimer.Dispose()
    }
    catch {
    }

    try {
        $mutex.ReleaseMutex()
    }
    catch {
    }
    finally {
        $mutex.Dispose()
    }

    $appContext.ExitThread()
}

$openMenuItem.add_Click({ Open-App })
$reopenMenuItem.add_Click({ Open-App })
$exitMenuItem.add_Click($shutdown)
$notifyIcon.add_DoubleClick({ Open-App })

$statusTimer.Interval = 15000
$statusTimer.add_Tick({
    $status = Get-StatusText
    $statusMenuItem.Text = $status
    $notifyIcon.Text = if ($status.Length -gt 63) { $status.Substring(0, 63) } else { $status }
})
$statusTimer.Start()

try {
    if (-not (Test-Path (Join-Path $frontendDir "node_modules"))) {
        $statusMenuItem.Text = "Instalando dependências"
        Start-ManagedProcess -FilePath "npm.cmd" -ArgumentList @("install") -WorkingDirectory $frontendDir -Wait | Out-Null
    }

    if (-not (Test-UrlReady $backendUrl)) {
        $statusMenuItem.Text = "Iniciando backend"
        Start-ManagedProcess -FilePath "cmd.exe" -ArgumentList @("/c", "`"$backendScript`"") -WorkingDirectory $root | Out-Null
    }

    Start-Sleep -Seconds 3

    if (-not (Test-UrlReady $frontendUrl)) {
        $statusMenuItem.Text = "Iniciando frontend"
        Start-ManagedProcess -FilePath "cmd.exe" -ArgumentList @("/c", "`"$frontendScript`"") -WorkingDirectory $root | Out-Null
    }

    $deadline = (Get-Date).AddSeconds(75)
    while ((Get-Date) -lt $deadline) {
        if (Test-UrlReady $frontendUrl) {
            break
        }
        Start-Sleep -Seconds 2
    }

    $statusMenuItem.Text = Get-StatusText
    Open-App
}
catch {
    $notifyIcon.BalloonTipTitle = "EDI Web"
    $notifyIcon.BalloonTipText = ($_.Exception.Message -replace "\r?\n", " ")
    $notifyIcon.ShowBalloonTip(5000)
    $statusMenuItem.Text = "Falha ao iniciar"
}

[System.Windows.Forms.Application]::Run($appContext)
