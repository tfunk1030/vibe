# Codebase Report: Parallel API Execution Patterns
Generated: 2026-01-11

## Summary
The codebase uses Promise.all for parallel execution in two distinct patterns:
1. Parallel I/O - Reading two image files simultaneously
2. Parallel AI Extraction - Running 3 AI API calls concurrently with 2-pass comparison

No other Promise.all patterns found. The solver runs sequentially with no parallel patterns.

## Questions Answered

### Q1: Current parallel extraction pattern (gemini.ts:1287-1307)

Location: C:\Users\tfunk\vibe\src\lib\services\gemini.ts:1287-1307

Pattern: Creates 3 promises with timing wrappers, executes in parallel via Promise.all
- 1x domino extraction (GPT-5.2)
- 2x grid extraction passes (Gemini models)

Performance: Reduces time from ~10-15s to ~5-8s (2x improvement)

Key characteristics:
- Each promise wrapped with .then() for individual timing logs
- All 3 API calls fire simultaneously
- Results destructured from Promise.all array

### Q2: Other Promise.all patterns

Found 2 total:

Pattern 1 - Parallel Image Reading (line 1262-1269):
Reads dominoImageUri and gridImageUri files concurrently
Purpose: I/O optimization for base64 encoding

Pattern 2 - Parallel AI Extraction (line 1303-1307):
See Q1 above

No Promise.allSettled or Promise.race patterns found.
Solver.ts has zero parallel patterns (sequential only).

### Q3: 2-pass comparison mechanism

Comparison function: compareGridResponses (lines 111-204)

Algorithm:
1. Dimension check - if different, return score 0.5
2. Cell position agreement - Sorensen-Dice coefficient
3. Constraint agreement - match regions by 50%+ cell overlap
4. Final score = average of cell score and constraint score

Selection logic (lines 1322-1343):
- Default: use pass 1 result
- If score < 0.8: choose pass with better cell count
  - With sizeHint: choose closest to dominoCount * 2
  - Without: choose pass with more cells

Result merge:
- Chooses ONE result (pass 1 or pass 2), does not merge
- Uncertain cells/regions tracked for UI highlighting
- Confidence metadata includes comparison warnings

## Existing Fallback Patterns

1. Multi-attempt retry (lines 1273-1410)
   - MAX_RETRIES = 3
   - Each retry re-runs ALL 3 parallel API calls
   - No exponential backoff

2. Model degradation (line 887-892)
   - Attempt 1: gemini-3-pro-preview
   - Attempt 2+: gemini-2.5-flash (faster)

## API Specifications

Domino extraction:
- Model: openai/gpt-5.2
- Function: extractDominoesFromImage (line 437)

Grid extraction:
- Models: gemini-3-pro-preview (attempt 1), gemini-2.5-flash (attempt 2+)
- Function: extractGridFromImage (line 848)
- Max tokens: 32000
- Temperature: 0.1

Both use OpenRouter endpoint with same headers.

## Architecture Flow

User captures images
  → extractFromDualImages()
  → Promise.all (read 2 images in parallel)
  → Promise.all (3 API calls: 1 domino + 2 grid)
  → compareGridResponses() 
  → Select best result
  → Validate counts
  → Return or retry (up to 3x)

## Key Files

src/lib/services/gemini.ts - 2x Promise.all patterns (I/O + API)
src/lib/services/solver.ts - Sequential only (no parallel)
