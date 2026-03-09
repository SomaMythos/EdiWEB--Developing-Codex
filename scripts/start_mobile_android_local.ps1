param(
    [int]$BackendPort = 8000,
    [switch]$SkipBuild,
    [switch]$NoBackend
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $repoRoot 'backend'
$mobileDir = Join-Path $repoRoot 'mobile'
$androidDir = Join-Path $mobileDir 'android'

function Ensure-PathExists($path, $label) {
    if (-not (Test-Path $path)) {
        throw "$label nao encontrado em $path"
    }
}

function Get-LanIpAddress {
    $addresses = Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp, Manual -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notlike '127.*' -and
            $_.IPAddress -notlike '169.254.*'
        } |
        Sort-Object InterfaceMetric

    if ($addresses) {
        return $addresses[0].IPAddress
    }

    $fallback = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
        Where-Object {
            $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and
            $_.IPAddressToString -notlike '127.*'
        } |
        Select-Object -First 1

    if ($fallback) {
        return $fallback.IPAddressToString
    }

    throw 'Nao foi possivel detectar um IP local da maquina.'
}

function Resolve-CommandPath($name, $helpText, $candidatePaths = @()) {
    foreach ($candidate in $candidatePaths) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    $command = Get-Command $name -ErrorAction SilentlyContinue
    if ($command) {
        return $command.Source
    }

    throw "$name nao encontrado. $helpText"
}

function Resolve-JavaHome {
    $javaCandidates = @()

    if ($env:JAVA_HOME) {
        $javaCandidates += (Join-Path $env:JAVA_HOME 'bin\java.exe')
    }

    $javaCandidates += @(
        'C:\Program Files\Android\Android Studio\jbr\bin\java.exe',
        'C:\Program Files\Android\Android Studio\jre\bin\java.exe',
        'C:\Program Files\Java\jdk-21\bin\java.exe',
        'C:\Program Files\Java\jdk-21.0.2\bin\java.exe',
        'C:\Program Files\Java\jdk-21.0.10\bin\java.exe',
        'C:\Program Files\Java\jdk-17\bin\java.exe',
        'C:\Program Files\Java\jdk-17.0.2\bin\java.exe',
        'C:\Program Files\Java\jdk-17.0.12\bin\java.exe',
        'C:\Program Files\Java\latest\bin\java.exe',
        'C:\Program Files\Java\jdk-25.0.2\bin\java.exe'
    )

    foreach ($candidate in $javaCandidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return Split-Path -Parent (Split-Path -Parent $candidate)
        }
    }

    $javaCommand = Get-Command 'java' -ErrorAction SilentlyContinue
    if ($javaCommand) {
        $source = $javaCommand.Source
        if ($source -and $source -notlike '*Common Files\Oracle\Java\javapath*') {
            return Split-Path -Parent (Split-Path -Parent $source)
        }
    }

    throw 'java nao encontrado. Instale um JDK 17 ou 21 e garanta que java esteja no PATH.'
}

function Get-JavaMajorVersion($javaCmd) {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $versionOutput = & $javaCmd -version 2>&1 | Out-String
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }

    if ($versionOutput -match 'version\s+"(?<major>\d+)') {
        return [int]$matches['major']
    }

    if ($versionOutput -match 'openjdk\s+(?<major>\d+)') {
        return [int]$matches['major']
    }

    throw "Nao foi possivel detectar a versao do Java. Saida:`n$versionOutput"
}

function Remove-DirectoryIfExists($path) {
    if (Test-Path $path) {
        Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction Stop
    }
}

function Clear-MobileCaches($androidDir, $mobileDir, $javaHome) {
    $gradlew = Join-Path $androidDir 'gradlew.bat'
    if (Test-Path $gradlew) {
        $oldJavaHome = $env:JAVA_HOME
        $oldPath = $env:PATH
        try {
            $env:JAVA_HOME = $javaHome
            $env:PATH = "$javaHome\bin;$oldPath"
            & $gradlew -p $androidDir --stop | Out-Null
        }
        catch {
        }
        finally {
            $env:JAVA_HOME = $oldJavaHome
            $env:PATH = $oldPath
        }
    }

    $paths = @(
        (Join-Path $androidDir 'build'),
        (Join-Path $androidDir 'app\build'),
        (Join-Path $mobileDir '.expo'),
        (Join-Path $mobileDir 'node_modules\expo-dev-launcher\expo-dev-launcher-gradle-plugin\build'),
        (Join-Path $mobileDir 'node_modules\expo-modules-core\expo-module-gradle-plugin\build'),
        (Join-Path $mobileDir 'node_modules\expo-modules-autolinking\android\expo-gradle-plugin\expo-autolinking-plugin\build'),
        (Join-Path $mobileDir 'node_modules\expo-modules-autolinking\android\expo-gradle-plugin\expo-autolinking-plugin-shared\build'),
        (Join-Path $mobileDir 'node_modules\expo-modules-autolinking\android\expo-gradle-plugin\expo-autolinking-settings-plugin\build'),
        (Join-Path $mobileDir 'node_modules\@react-native\gradle-plugin\react-native-gradle-plugin\build'),
        (Join-Path $mobileDir 'node_modules\@react-native\gradle-plugin\settings-plugin\build')
    )

    foreach ($path in $paths) {
        Remove-DirectoryIfExists $path
    }

    $tempRoots = @(
        $env:TEMP,
        $env:LOCALAPPDATA + '\Temp'
    ) | Where-Object { $_ } | Select-Object -Unique

    foreach ($tempRoot in $tempRoots) {
        Get-ChildItem -Path $tempRoot -Filter 'metro-*' -Force -ErrorAction SilentlyContinue | ForEach-Object {
            Remove-DirectoryIfExists $_.FullName
        }
        Get-ChildItem -Path $tempRoot -Filter 'haste-map-*' -Force -ErrorAction SilentlyContinue | ForEach-Object {
            Remove-DirectoryIfExists $_.FullName
        }
        Get-ChildItem -Path $tempRoot -Filter 'react-native-packager-cache-*' -Force -ErrorAction SilentlyContinue | ForEach-Object {
            Remove-DirectoryIfExists $_.FullName
        }
    }
}


Ensure-PathExists $mobileDir 'Diretorio do mobile'
Ensure-PathExists $androidDir 'Diretorio android'
if (-not $NoBackend) {
    Ensure-PathExists $backendDir 'Diretorio do backend'
}

$adbCandidates = @(
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'),
    'C:\Android\Sdk\platform-tools\adb.exe'
)

$npmCmd = Resolve-CommandPath 'npm.cmd' 'Instale o Node.js e reabra o terminal.'
$adbCmd = Resolve-CommandPath 'adb' 'Instale o Android Platform Tools e garanta que adb esteja no PATH.' $adbCandidates
$javaHome = Resolve-JavaHome
$javaCmd = Join-Path $javaHome 'bin\java.exe'
$javaMajor = Get-JavaMajorVersion $javaCmd

if ($javaMajor -gt 21) {
    throw "Java $javaMajor detectado em $javaHome. Para este projeto Android, use JDK 17 ou 21. Instale um deles e tente novamente."
}

$env:JAVA_HOME = $javaHome
$env:PATH = "$javaHome\bin;$env:PATH"

$deviceOutput = & $adbCmd devices
$onlineDevices = $deviceOutput |
    Select-Object -Skip 1 |
    Where-Object { $_ -match '\S+\s+device$' }

if (-not $onlineDevices) {
    throw "Nenhum dispositivo Android detectado. Abra um emulador ou conecte um celular com depuracao USB ativa.`nSaida do adb:`n$deviceOutput"
}

$apiHost = Get-LanIpAddress
$apiUrl = "http://${apiHost}:${BackendPort}/api"

Write-Host ''
Write-Host '========================================'
Write-Host ' EDI Mobile Android Build'
Write-Host '========================================'
Write-Host "API:       $apiUrl"
Write-Host "Devices:   $($onlineDevices.Count)"
Write-Host "ADB:       $adbCmd"
Write-Host "Java:      $javaCmd"
Write-Host "JAVA_HOME: $javaHome"
Write-Host "Java ver:  $javaMajor"
Write-Host 'Modo:      Development Build local'
Write-Host '========================================'
Write-Host ''

if (-not $SkipBuild) {
    Write-Host 'Limpando cache e artefatos temporarios...'
    Clear-MobileCaches $androidDir $mobileDir $javaHome

    Write-Host 'Compilando e instalando o app Android localmente...'
    Push-Location $mobileDir
    try {
        $env:EXPO_PUBLIC_API_URL = $apiUrl
        & $npmCmd run android
        if ($LASTEXITCODE -ne 0) {
            throw 'Falha ao executar npm run android.'
        }
    }
    finally {
        Pop-Location
    }
}

if (-not $NoBackend) {
    $backendCommand = @(
        "Set-Location '$backendDir'"
        "if (Get-Command py -ErrorAction SilentlyContinue) { py -m uvicorn main:app --reload --host 0.0.0.0 --port $BackendPort }"
        "elseif (Get-Command python -ErrorAction SilentlyContinue) { python -m uvicorn main:app --reload --host 0.0.0.0 --port $BackendPort }"
        "else { Write-Error 'Python nao encontrado no PATH.' }"
    ) -join '; '

    Start-Process powershell -ArgumentList @(
        '-NoExit',
        '-ExecutionPolicy', 'Bypass',
        '-Command', $backendCommand
    ) -WorkingDirectory $backendDir -WindowStyle Normal

    Start-Sleep -Seconds 3
}

$mobileCommand = @(
    "Set-Location '$mobileDir'"
    "`$env:EXPO_PUBLIC_API_URL = '$apiUrl'"
    "`$env:JAVA_HOME = '$javaHome'"
    "`$env:PATH = '$javaHome\bin;' + `$env:PATH"
'npm.cmd run start:dev-client -- --clear'
) -join '; '

Start-Process powershell -ArgumentList @(
    '-NoExit',
    '-ExecutionPolicy', 'Bypass',
    '-Command', $mobileCommand
) -WorkingDirectory $mobileDir -WindowStyle Normal

Write-Host 'App instalado/local build concluido.'
Write-Host 'Abri o bundler em modo dev client.'
Write-Host 'Abra o app "EDI Mobile" no Android.'
