# Starts the backend (port 8000) and frontend (port 5173) in two terminal windows and opens the app.
# Run from the repository root after scripts\setup.ps1:
#   powershell -ExecutionPolicy Bypass -File scripts\start.ps1
# Stop the app by closing the two windows (or Ctrl+C in each).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

if (-not (Test-Path (Join-Path $backend ".venv\Scripts\python.exe"))) {
    throw "Backend is not set up yet. Run: powershell -ExecutionPolicy Bypass -File scripts\setup.ps1"
}
if (-not (Test-Path (Join-Path $frontend "node_modules"))) {
    throw "Frontend is not set up yet. Run: powershell -ExecutionPolicy Bypass -File scripts\setup.ps1"
}

foreach ($port in 8000, 5173) {
    if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
        throw "Port $port is already in use - is the app already running? Close that window first."
    }
}

Start-Process powershell -WorkingDirectory $backend -ArgumentList @(
    "-NoExit", "-Command",
    "`$host.UI.RawUI.WindowTitle = 'Scam Shield - backend :8000'; .\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000"
)
Start-Process powershell -WorkingDirectory $frontend -ArgumentList @(
    "-NoExit", "-Command",
    "`$host.UI.RawUI.WindowTitle = 'Scam Shield - frontend :5173'; npm run dev -- --port 5173 --strictPort"
)

Write-Host "Waiting for the servers to start..."
$deadline = (Get-Date).AddSeconds(120)   # generous upper bound; normally ready in a few seconds
$up = $false
while ((Get-Date) -lt $deadline) {
    try {
        # 127.0.0.1, not localhost: uvicorn listens on IPv4 only and PowerShell 5.1 stalls trying ::1 first
        Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://127.0.0.1:8000/" | Out-Null
        Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://localhost:5173/" | Out-Null
        $up = $true; break
    } catch { Start-Sleep -Seconds 1 }
}

if ($up) {
    Write-Host "`nScam Shield is running:" -ForegroundColor Green
    Write-Host "    App        http://localhost:5173"
    Write-Host "    API docs   http://localhost:8000/docs"
    Start-Process "http://localhost:5173"
} else {
    Write-Host "Servers did not respond within 120 s - check the two terminal windows for errors." -ForegroundColor Yellow
}
