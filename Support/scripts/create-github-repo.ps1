# Create GitHub repo: 212G-TARSUS-Main-Ministry-Platform
# Prerequisite: gh auth login (one-time)

$ErrorActionPreference = "Stop"
$gh = "$env:LOCALAPPDATA\Programs\gh-cli\bin\gh.exe"
if (-not (Test-Path $gh)) {
    $gh = (Get-Command gh -ErrorAction SilentlyContinue).Source
}
if (-not $gh) {
    Write-Error "GitHub CLI (gh) not found. Install from https://cli.github.com/ or re-run the portable install."
}

$repoName = "212G-TARSUS-Main-Ministry-Platform"
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $projectRoot

& $gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Run: gh auth login" -ForegroundColor Yellow
    exit 1
}

Write-Host "Creating public repo: $repoName" -ForegroundColor Cyan
& $gh repo create $repoName `
    --public `
    --description "212G TARSUS Main Ministry Platform" `
    --source . `
    --remote origin `
    --push

if ($LASTEXITCODE -eq 0) {
    Write-Host "Done. Remote:" -ForegroundColor Green
    git remote -v
} else {
    Write-Error "gh repo create failed (repo may already exist)."
}
