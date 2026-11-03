$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$localRoot = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Path $localRoot -Force | Out-Null

function Test-LocalPort([int]$Port) {
    $client = [Net.Sockets.TcpClient]::new()
    try { $client.Connect('127.0.0.1', $Port); return $true }
    catch { return $false }
    finally { $client.Dispose() }
}

if (-not (Test-LocalPort 27018)) {
    $mongod = 'C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
    if (-not (Test-Path -LiteralPath $mongod)) { throw "MongoDB executable missing: $mongod" }
    $dbPath = Join-Path $localRoot 'mongo-rs\data'
    if (-not (Test-Path -LiteralPath $dbPath)) { throw 'Local replica set has not been configured.' }
    $mongoLog = Join-Path $localRoot 'mongo-rs\mongod.log'
    Start-Process -FilePath $mongod -ArgumentList @('--dbpath', ('"' + $dbPath + '"'), '--port', '27018', '--bind_ip', '127.0.0.1', '--replSet', 'preonic-rs', '--logpath', ('"' + $mongoLog + '"'), '--logappend') -WindowStyle Hidden
    for ($attempt = 0; $attempt -lt 30 -and -not (Test-LocalPort 27018); $attempt++) { Start-Sleep -Seconds 1 }
    if (-not (Test-LocalPort 27018)) { throw 'MongoDB did not start. Check .local/mongo-rs/mongod.log.' }
}

if (-not (Test-LocalPort 8080)) {
    if (-not (Test-Path (Join-Path $projectRoot 'be\dist\server.js'))) { throw 'Run npm.cmd run build in be first.' }
    Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList 'dist/server.js' -WorkingDirectory (Join-Path $projectRoot 'be') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localRoot 'backend.stdout.log') -RedirectStandardError (Join-Path $localRoot 'backend.stderr.log')
}

if (-not (Test-LocalPort 3000)) {
    $env:BROWSER = 'none'
    Start-Process -FilePath (Get-Command npm.cmd).Source -ArgumentList 'start' -WorkingDirectory (Join-Path $projectRoot 'fe') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localRoot 'frontend.stdout.log') -RedirectStandardError (Join-Path $localRoot 'frontend.stderr.log')
}

Write-Output 'Local MongoDB: 127.0.0.1:27018 (preonic-rs)'
Write-Output 'Frontend: http://localhost:3000'
Write-Output 'Backend: http://localhost:8080/health'
