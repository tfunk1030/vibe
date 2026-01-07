# Ralph for Claude Code (PowerShell version)
# Usage: .\ralph-claude.ps1 [max_iterations]

param(
    [int]$MaxIterations = 10
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "🚀 Starting Ralph (Claude Code)" -ForegroundColor Cyan

for ($i = 1; $i -le $MaxIterations; $i++) {
    Write-Host "═══ Iteration $i ═══" -ForegroundColor Yellow
    
    try {
        $PromptContent = Get-Content "$ScriptDir\prompt.md" -Raw
        $Output = $PromptContent | claude --dangerously-skip-permissions 2>&1 | Tee-Object -Variable OutputCapture
        Write-Host $Output
        
        if ($Output -match "<promise>COMPLETE</promise>") {
            Write-Host "✅ Done!" -ForegroundColor Green
            exit 0
        }
    }
    catch {
        Write-Host "Error in iteration: $_" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 2
}

Write-Host "⚠️ Max iterations reached" -ForegroundColor Yellow
exit 1
