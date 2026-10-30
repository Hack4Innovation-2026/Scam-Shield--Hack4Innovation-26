# One-time setup for Windows: backend virtualenv + dependencies, frontend packages, config files.
# Run from the repository root:
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# Safe to re-run; it only installs what is missing or out of date.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg) { Write-Host "    $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }

# --- Prerequisites ---------------------------------------------------------------------------
Step "Checking prerequisites"
$python = $null
foreach ($candidate in @("python", "py")) {
    if (Get-Command $candidate -ErrorAction SilentlyContinue) {
        $version = & $candidate -c "import sys; print('%d.%d' % sys.version_info[:2])" 2>$null
        if ($version -and [version]$version -ge [version]"3.12") { $python = $candidate; break }
    }
}
if (-not $python) { throw "Python 3.12+ not found. Install it: winget install Python.Python.3.12" }
Ok "Python $(& $python --version)"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js not found. Install it: winget install OpenJS.NodeJS.LTS" }
$nodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 20) { throw "Node.js 20+ required (found $(node --version))." }
Ok "Node $(node --version)"

$tesseract = (Get-Command tesseract -ErrorAction SilentlyContinue) -or (Test-Path "C:\Program Files\Tesseract-OCR\tesseract.exe")
if ($tesseract) { Ok "Tesseract OCR found" }
else { Warn "Tesseract OCR not found - screenshot scanning will be disabled. Optional: winget install UB-Mannheim.TesseractOCR" }

# --- Backend ---------------------------------------------------------------------------------
Step "Backend: virtual environment and dependencies"
$venvPython = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    & $python -m venv (Join-Path $backend ".venv")
    Ok "Created backend\.venv"
}
& $venvPython -m pip install --quiet --upgrade pip
& $venvPython -m pip install --quiet -r (Join-Path $backend "requirements-dev.txt")
if ($LASTEXITCODE -ne 0) { throw "pip install failed" }
Ok "Python packages installed"

$envFile = Join-Path $backend ".env"
if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $backend ".env.example") $envFile
    Ok "Created backend\.env from .env.example (add MONGO_URI to enable the database)"
} else {
    Ok "backend\.env already exists - left unchanged"
}

# --- Frontend --------------------------------------------------------------------------------
Step "Frontend: npm packages"
Push-Location $frontend
try {
    npm install --no-audit --no-fund --loglevel=error
    if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    Ok "npm packages installed"
} finally { Pop-Location }

# --- Smoke test ------------------------------------------------------------------------------
Step "Checking the backend loads"
Push-Location $backend
try {
    & $venvPython -c "import main; from app.services import ml_engine; ml_engine.load_models(); print('models OK')"
    if ($LASTEXITCODE -ne 0) { throw "Backend failed to load - see the error above" }
} finally { Pop-Location }

Write-Host "`nSetup complete. Start the app with:" -ForegroundColor Green
Write-Host "    powershell -ExecutionPolicy Bypass -File scripts\start.ps1`n"
