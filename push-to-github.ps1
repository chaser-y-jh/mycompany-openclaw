# Push to GitHub. Use -NoProxy when SSRUN is off (direct).
param([switch]$NoProxy)

$ErrorActionPreference = "Continue"
$repo = $PSScriptRoot
$proxy = "http://127.0.0.1:7890"

if ($NoProxy) {
    Write-Host "=== GitHub push (NO proxy, direct) ===" -ForegroundColor Cyan
    git config --global --unset http.https://github.com.proxy 2>$null
    git config --global --unset https.https://github.com.proxy 2>$null
    Remove-Item Env:HTTP_PROXY, Env:HTTPS_PROXY, Env:ALL_PROXY -ErrorAction SilentlyContinue
} else {
    Write-Host "=== GitHub push (needs SSRUN on 7890) ===" -ForegroundColor Cyan
    $listen = netstat -an | Select-String "7890.*LISTENING"
    if (-not $listen) {
        Write-Host "7890 not listening. Use: .\push-to-github.ps1 -NoProxy  OR turn on SSRUN." -ForegroundColor Red
        exit 1
    }
    Write-Host "Proxy port 7890: OK" -ForegroundColor Green
    git config --global http.https://github.com.proxy $proxy
    git config --global https.https://github.com.proxy $proxy
}
git config --global http.postBuffer 524288000
git config --global http.version HTTP/1.1

Write-Host "Testing github.com..." -ForegroundColor Cyan
if ($NoProxy) {
    $curl = curl.exe -sI --connect-timeout 15 https://github.com 2>&1 | Select-Object -First 1
} else {
    $curl = curl.exe -sI --connect-timeout 15 -x $proxy https://github.com 2>&1 | Select-Object -First 1
}
Write-Host $curl
if ($curl -notmatch "HTTP") {
    Write-Host "Cannot reach GitHub. Try TUN mode or another SSRUN node." -ForegroundColor Red
    exit 1
}

Set-Location $repo
Write-Host ""
Write-Host "Remote:" -ForegroundColor Cyan
git remote -v
Write-Host ""
Write-Host "Pushing main (password = GitHub Personal Access Token, NOT login password)..." -ForegroundColor Cyan
Write-Host "Create token: https://github.com/settings/tokens  (scope: repo)"
Write-Host ""
git push -u origin main
