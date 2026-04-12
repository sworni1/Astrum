$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$sentimentDir = Join-Path $repoRoot "apps/sentiment-astrum"
$venvPython = Join-Path $sentimentDir ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
  Write-Error "Не найден $venvPython. Создайте venv: см. apps/sentiment-astrum/README.md"
  exit 1
}
Push-Location $sentimentDir
try {
  & $venvPython -m uvicorn src.app:app --reload --port 8088 --app-dir .
} finally {
  Pop-Location
}
