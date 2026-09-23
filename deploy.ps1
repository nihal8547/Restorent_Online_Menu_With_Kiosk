# ==============================================================================
# Windows PowerShell Deployment Runner for menu.webbea.qa
# Target: root@178.128.127.61
# ==============================================================================

$Server = "root@178.128.127.61"
$RemoteDir = "/var/www/menu.webbea.qa"
$Domain = "menu.webbea.qa"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Packaging and Deploying to $Server" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$TarFile = "deploy.tar.gz"
if (Test-Path $TarFile) { Remove-Item -Force $TarFile }

tar.exe --exclude="*node_modules*" --exclude="*.git*" --exclude="*dist*" --exclude="uploads" --exclude=".env*" -czf $TarFile client server docker-compose.prod.yml deploy.sh README.md

if (-not (Test-Path $TarFile)) {
    Write-Error "Failed to create deployment package!"
    exit 1
}

Write-Host " Uploading package to $RemoteDir..." -ForegroundColor Yellow
ssh $Server "mkdir -p $RemoteDir"
scp $TarFile "${Server}:${RemoteDir}/"

Remove-Item -Force $TarFile

Write-Host " Extracting and executing remote deployment script..." -ForegroundColor Yellow
ssh $Server "cd $RemoteDir && tar -xzf deploy.tar.gz && rm -f deploy.tar.gz && chmod +x deploy.sh && ./deploy.sh"

Write-Host "==========================================" -ForegroundColor Green
Write-Host " Verification & Health Check" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green

Start-Sleep -Seconds 3
try {
    $response = Invoke-RestMethod -Uri "https://$Domain/api/health" -Method Get -TimeoutSec 10
    Write-Host "API Health Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Green
    Write-Host " Successfully Deployed and Live at: https://$Domain" -ForegroundColor Cyan
} catch {
    Write-Warning "Could not reach https://$Domain/api/health immediately. Check logs with: ssh $Server 'cd $RemoteDir && docker compose -f docker-compose.prod.yml logs -n 50'"
}
