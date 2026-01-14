#!/bin/bash
# Ralph UI Pipeline - Vibe (Pips Solver)
# Usage: ./ralph-ui-pipeline.sh [max_iterations]

set -e
MAX_ITERATIONS=${1:-50}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           Vibe (Pips Solver) UI Review Pipeline                ║"
echo "╚════════════════════════════════════════════════════════════════╝"

if ! command -v claude &> /dev/null; then
    echo "❌ Claude Code CLI not found"
    exit 1
fi

PRD_PATH="$SCRIPT_DIR/prd.json"
PROMPT_PATH="$SCRIPT_DIR/prompt.md"

cd "$PROJECT_ROOT"

echo "🔄 Starting Ralph (max: $MAX_ITERATIONS iterations)"

for i in $(seq 1 $MAX_ITERATIONS); do
    echo "═══ Iteration $i / $MAX_ITERATIONS ═══"
    
    OUTPUT=$(cat "$PROMPT_PATH" | claude --dangerously-skip-permissions 2>&1 | tee /dev/stderr) || true
    
    if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
        echo "✅ PIPELINE COMPLETE!"
        exit 0
    fi
    
    sleep 3
done

echo "⚠️  Max iterations reached"
exit 1
