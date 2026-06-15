$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoExit", "-Command", "cd '$root'; python backend/detector_service.py"
Start-Sleep -Seconds 2
Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoExit", "-Command", "cd '$root'; node server/index.js"
Start-Sleep -Seconds 1
npm run dev
