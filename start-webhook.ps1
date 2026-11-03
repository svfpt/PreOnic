$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$localRoot = Join-Path $projectRoot '.local'
$cloudflared = Join-Path $localRoot 'tools\cloudflared.exe'
if (-not (Test-Path -LiteralPath $cloudflared)) { throw 'Install cloudflared in .local/tools first.' }
$client = [Net.Sockets.TcpClient]::new()
try { $client.Connect('127.0.0.1', 8081); $proxyRunning = $true }
catch { $proxyRunning = $false }
finally { $client.Dispose() }
if (-not $proxyRunning) {
    Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList 'be/scripts/webhook-proxy.cjs' -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localRoot 'webhook-proxy.stdout.log') -RedirectStandardError (Join-Path $localRoot 'webhook-proxy.stderr.log')
}

$logPath = Join-Path $localRoot 'tunnel.stderr.log'
$pidPath = Join-Path $localRoot 'tunnel.pid'
$tunnelProcess = $null
if (Test-Path -LiteralPath $pidPath) {
    $tunnelId = 0
    if ([int]::TryParse((Get-Content $pidPath -Raw).Trim(), [ref]$tunnelId)) {
        $candidate = Get-Process -Id $tunnelId -ErrorAction SilentlyContinue
        if ($candidate -and $candidate.ProcessName -eq 'cloudflared') { $tunnelProcess = $candidate }
    }
}
if (-not $tunnelProcess) {
    $tunnelProcess = Start-Process -FilePath $cloudflared -ArgumentList 'tunnel','--url','http://127.0.0.1:8081','--no-autoupdate','--protocol','http2' -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $localRoot 'tunnel.stdout.log') -RedirectStandardError $logPath
    Set-Content -LiteralPath $pidPath -Value $tunnelProcess.Id
}
$publicUrl = $null
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if (Test-Path -LiteralPath $logPath) {
        $tunnelLog = [string](Get-Content -LiteralPath $logPath -Raw)
        $matches = [regex]::Matches($tunnelLog, 'https://[a-z0-9-]+\.trycloudflare\.com')
        if ($matches.Count -gt 0 -and $tunnelLog.Contains('Registered tunnel connection')) {
            $publicUrl = $matches[$matches.Count - 1].Value
            break
        }
    }
    Start-Sleep -Seconds 1
}
if (-not $publicUrl) { throw 'Tunnel is not ready. Check .local/tunnel.stderr.log.' }
$webhookUrl = $publicUrl + '/api/v1/payment/webhook'
Write-Output "Registering payOS webhook: $webhookUrl"
& node.exe (Join-Path $projectRoot 'be\scripts\register-payos-webhook.cjs') $webhookUrl
if ($LASTEXITCODE -ne 0) { throw 'payOS webhook registration failed.' }
Set-Content -LiteralPath (Join-Path $localRoot 'public-webhook-url.txt') -Value $webhookUrl
Write-Output 'Keep the tunnel running while testing payments. Restarting it may change the webhook URL.'
