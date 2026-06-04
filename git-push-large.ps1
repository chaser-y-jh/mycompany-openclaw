# Retry push ~85MB repo after HTTP 408 (empty remote). Keep SSRUN connected.
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot

Write-Host "=== Large repo push (retry) ===" -ForegroundColor Cyan
Write-Host "Keep SSRUN connected. Prefer TUN mode. Do not close this window." -ForegroundColor Yellow
Write-Host ""

$listen = netstat -an | Select-String "7890.*LISTENING"
if (-not $listen) {
    Write-Host "Warning: 7890 not LISTENING. Connect SSRUN first." -ForegroundColor Red
}

git config --global http.postBuffer 524288000
git config --global http.version HTTP/1.1
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999
git config --global core.compression 0
git config pack.windowMemory 256m
git config pack.packSizeLimit 256m
git config pack.threads 1

Write-Host "Remote check:" -ForegroundColor Cyan
git ls-remote origin HEAD 2>&1
Write-Host ""
Write-Host "Pushing main (may take 5-15 min)..." -ForegroundColor Cyan
git push -u origin main --progress 2>&1
$code = $LASTEXITCODE
Write-Host ""
if ($code -eq 0) {
    Write-Host "SUCCESS. Open: https://github.com/chaser-y-jh/mycompany-merclaw" -ForegroundColor Green
} else {
    Write-Host "Failed (exit $code). Run this script again - Git resumes upload." -ForegroundColor Yellow
    Write-Host "Try: different SSRUN node, TUN on, wired network."
}
exit $code
