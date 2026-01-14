# Ralph UI Pipeline for Claude Code (PowerShell) - Vibe
# 
# Multi-agent UI review pipeline for Pips Solver
# Usage: .\ralph-ui-pipeline.ps1 [-MaxIterations 50] [-Verbose]

param(
    [int]$MaxIterations = 50,
    [switch]$Verbose,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Get-Item "$ScriptDir\..\..\..").FullName

# Banner
Write-Host @"
╔════════════════════════════════════════════════════════════════╗
║           Vibe (Pips Solver) UI Review Pipeline                ║
║                                                                ║
║  Reviewers: RAMS → GPT → frontend-app-design → RAMS           ║
║  Strategy: Per-component, then global consistency              ║
╚════════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Magenta

# Check prerequisites
Write-Host "🔄 Checking prerequisites..." -ForegroundColor Cyan

if (-not (Get-Command "claude" -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Claude Code CLI not found." -ForegroundColor Red
    exit 1
}

$PrdPath = "$ScriptDir\prd.json"
$PromptPath = "$ScriptDir\prompt.md"

if (-not (Test-Path $PrdPath)) {
    Write-Host "❌ prd.json not found" -ForegroundColor Red
    exit 1
}

$prd = Get-Content $PrdPath -Raw | ConvertFrom-Json

Write-Host "ℹ️  Branch: $($prd.branchName)" -ForegroundColor White
Write-Host "ℹ️  Components: $($prd.userStories.Count)" -ForegroundColor White

$pendingComponents = $prd.userStories | Where-Object { -not $_.passes }
if ($pendingComponents.Count -eq 0) {
    Write-Host "✅ All components already complete!" -ForegroundColor Green
    exit 0
}

Write-Host "`nPending:" -ForegroundColor Yellow
foreach ($story in $pendingComponents) {
    Write-Host "  - [$($story.id)] $($story.title)" -ForegroundColor Gray
}

Set-Location $ProjectRoot

# Main loop
Write-Host "`n🔄 Starting Ralph iterations (max: $MaxIterations)" -ForegroundColor Cyan

for ($i = 1; $i -le $MaxIterations; $i++) {
    Write-Host "═══ Iteration $i / $MaxIterations ═══" -ForegroundColor Yellow
    
    $prd = Get-Content $PrdPath -Raw | ConvertFrom-Json
    $currentComponent = $prd.userStories | Where-Object { -not $_.passes } | Select-Object -First 1
    
    if ($null -eq $currentComponent) {
        Write-Host "✅ All components complete!" -ForegroundColor Green
        break
    }
    
    Write-Host "Current: [$($currentComponent.id)] $($currentComponent.title)" -ForegroundColor White
    Write-Host "Phase: $($currentComponent.currentPhase)" -ForegroundColor White
    
    if ($DryRun) {
        Write-Host "DRY RUN - skipping" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
        continue
    }
    
    try {
        $PromptContent = Get-Content $PromptPath -Raw
        $Output = $PromptContent | claude --dangerously-skip-permissions 2>&1 | Tee-Object -Variable OutputCapture
        Write-Host $Output
        
        if ($Output -match "<promise>COMPLETE</promise>") {
            Write-Host "`n✅ PIPELINE COMPLETE!" -ForegroundColor Green
            exit 0
        }
        
        Write-Host "`nNext iteration in 3s..." -ForegroundColor Gray
        Start-Sleep -Seconds 3
        
    } catch {
        Write-Host "Error: $_" -ForegroundColor Red
        Start-Sleep -Seconds 5
    }
}

Write-Host "⚠️  Max iterations reached" -ForegroundColor Yellow
exit 1
