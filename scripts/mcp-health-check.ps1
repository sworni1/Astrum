# MCP Server Health Check (PowerShell)
# Usage: .\scripts\mcp-health-check.ps1

Write-Host "Checking MCP server health..." -ForegroundColor Cyan

$MCP_FILE = ".mcp.json"
if (-not (Test-Path $MCP_FILE)) {
    Write-Host "ERROR: .mcp.json not found" -ForegroundColor Red
    exit 1
}

Write-Host "OK: .mcp.json found" -ForegroundColor Green

$mcp = Get-Content $MCP_FILE | ConvertFrom-Json

foreach ($server in $mcp.mcpServers.PSObject.Properties.Name) {
    $config = $mcp.mcpServers.$server
    $cmd = $config.command
    Write-Host "  Checking: $server" -ForegroundColor Yellow

    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        Write-Host "  OK: $server`: command '$cmd' available" -ForegroundColor Green
    } else {
        Write-Host "  WARNING: $server`: command '$cmd' not in PATH" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Tip: Run '/mcp' in Claude Code for live connection status" -ForegroundColor Cyan
