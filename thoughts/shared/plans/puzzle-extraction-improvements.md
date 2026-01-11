# Puzzle Extraction Reliability and UX Improvements

## Overview

This plan improves the puzzle extraction system's reliability and user experience. Based on pre-mortem analysis and user testing:

**Key Finding:** Gemini 3 Flash was tested and found INACCURATE for grid extraction. Gemini 3 Pro is the only accurate model for this use case.

**Revised Goals:**
1. ~~Faster extraction~~ → **Keep Pro for accuracy** (speed is secondary to correctness)
2. **Better reliability** - Exponential backoff with jitter for API calls
3. ~~Dual-pass verification~~ → **Single Pro pass** (Flash doesn't add value)
4. **Better UX** - Simplified progress feedback during extraction

## Current State Analysis

### Architecture (from `src/lib/services/gemini.ts`)

The current extraction flow:
1. `extractPuzzleFromDualImages()` - Main entry point
2. Parallel extraction of dominoes + 2 grid passes (Pro + Flash)
3. Compares grid results and picks the best one
4. Basic retry loop (MAX_RETRIES = 3) with no backoff

### Key Files
- **`src/lib/services/gemini.ts`** - All extraction logic
- **`src/components/ExtractionProgress.tsx`** - Progress UI component
- **`src/app/index.tsx`** - Main app with extraction state management

### Pre-Mortem Mitigations Applied
- ✅ Correct model ID: `google/gemini-3-pro-preview` (not gemini-3-flash)
- ✅ Pro-only extraction (Flash tested inaccurate)
- ✅ Simplified architecture (no dual-model complexity)
- ✅ Multi-island extraction will also be updated

## Desired End State

After implementation:
1. Pro-only grid extraction (accurate, ~63s)
2. API failures recover gracefully with exponential backoff
3. Clear progress feedback during the 60+ second wait
4. Multi-island extraction also uses improved patterns

## What We're NOT Doing

- Flash-first extraction (tested, doesn't work for puzzles)
- Dual-pass verification (Pro alone is accurate enough)
- Speed optimizations that sacrifice accuracy
- Changing the domino extraction model (GPT-5.2 works well)

---

## Phase 1: Simplify to Pro-Only Grid Extraction

### Overview
Remove the dual-model 2-pass system. Use Gemini 3 Pro exclusively for grid extraction since Flash was tested and found inaccurate.

### Goal
Simplify architecture while maintaining accuracy. Remove complexity that doesn't add value.

### Files to Modify

#### 1. `src/lib/services/gemini.ts`

**Remove dual-pass logic in `extractPuzzleFromDualImages()` (lines 1287-1343)**:

Current code runs Pro + Flash in parallel:
```typescript
// REMOVE: Two-pass parallel extraction
const gridPass1Promise = extractGridFromImage(gridBase64, sizeHint, 1); // Pro
const gridPass2Promise = extractGridFromImage(gridBase64, sizeHint, 2); // Flash
```

Replace with single Pro pass:
```typescript
// Single Pro pass - tested accurate for puzzle grids
console.log('[AI] Extracting grid with Gemini 3 Pro...');
const gridResult = await extractGridFromImage(gridBase64, sizeHint, 1);
```

**Simplify `extractGridFromImage()` (line 887-892)**:

Remove model degradation logic:
```typescript
// BEFORE: Model varies by attempt
const model = attempt === 1 ? 'google/gemini-3-pro-preview' : 'google/gemini-2.5-flash';

// AFTER: Always use Pro
const model = 'google/gemini-3-pro-preview';
console.log(`[AI] Extracting grid with Gemini 3 Pro (attempt ${attempt})...`);
```

**Remove `compareGridResponses()` usage in extraction**:

Since we now have a single pass, the comparison logic is unnecessary. Keep the function for potential future use but don't call it in the main flow.

### Test Strategy

#### Automated Verification
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] No runtime errors in Expo logs

#### Manual Verification
- [ ] Test with 5x4 puzzle - should extract correctly
- [ ] Test with L-shaped puzzle - should extract correctly
- [ ] Confirm timing logs show single grid API call

### Rollback Plan
Restore the dual-pass Promise.all pattern:
```typescript
const [gridPass1, gridPass2] = await Promise.all([
  extractGridFromImage(gridBase64, sizeHint, 1),
  extractGridFromImage(gridBase64, sizeHint, 2),
]);
```

---

## Phase 2: Exponential Backoff with Retry Logic

### Overview
Add robust retry logic with exponential backoff and jitter to handle API failures gracefully.

### Goal
Improve reliability by recovering from transient failures without overwhelming the API.

### Files to Modify

#### 1. `src/lib/services/gemini.ts`

**Add retry utility near the top of the file (around line 30)**:

```typescript
// Retry configuration
interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterFactor: 0.2,
};

function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  const baseDelay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
    config.maxDelayMs
  );
  const jitter = baseDelay * config.jitterFactor * (Math.random() * 2 - 1);
  return Math.round(baseDelay + jitter);
}

function isRetryableError(error: Error, status?: number): boolean {
  if (error.message.includes('network') || error.message.includes('timeout')) {
    return true;
  }
  if (status && (status >= 500 || status === 429)) {
    return true;
  }
  if (status && status >= 400 && status < 500 && status !== 429) {
    return false;
  }
  if (error.message.includes('ran out of tokens')) {
    return true;
  }
  return false;
}

async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const statusMatch = lastError.message.match(/(\d{3})/);
      const status = statusMatch ? parseInt(statusMatch[1]) : undefined;

      if (attempt < config.maxAttempts && isRetryableError(lastError, status)) {
        const delay = calculateRetryDelay(attempt, config);
        console.log(`[AI] ${operationName} failed (attempt ${attempt}/${config.maxAttempts}): ${lastError.message}`);
        console.log(`[AI] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (!isRetryableError(lastError, status)) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error(`${operationName} failed after ${config.maxAttempts} attempts`);
}
```

**Wrap API calls with retry logic**:

For `extractGridFromImage()`:
```typescript
// Wrap the fetch call
const response = await withRetry(
  async () => {
    const resp = await fetch(OPENROUTER_ENDPOINT, { ... });
    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(`API error ${resp.status}: ${errorText}`);
    }
    return resp;
  },
  'Grid extraction'
);
```

For `extractDominoesFromImage()`:
```typescript
// Wrap the fetch call similarly
const response = await withRetry(
  async () => { ... },
  'Domino extraction'
);
```

**Simplify outer retry loop in `extractPuzzleFromDualImages()`**:

The outer loop can be simplified since individual calls now have retry:
```typescript
export async function extractPuzzleFromDualImages(
  dominoImageUri: string,
  gridImageUri: string,
  sizeHint?: GridSizeHint,
  onProgress?: (stage: ExtractionStage) => void
): Promise<PuzzleData> {
  // ... setup code

  try {
    // Single attempt - retry logic is in individual API calls
    onProgress?.('dominoes');
    const dominoResult = await extractDominoesFromImage(dominoBase64, sizeHint?.dominoCount);

    onProgress?.('grid');
    const gridResult = await extractGridFromImage(gridBase64, sizeHint, 1);

    // ... build puzzle data
    return puzzleData;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[AI] Extraction failed:', err.message);
    throw new Error(`Puzzle extraction failed: ${err.message}`);
  }
}
```

### Test Strategy

#### Automated Verification
- [ ] TypeScript compiles
- [ ] Retry delays increase exponentially

#### Manual Verification
- [ ] Disconnect network briefly - should retry with backoff
- [ ] Check logs for retry messages with increasing delays

### Rollback Plan
Remove `withRetry` wrapper and restore direct fetch calls.

---

## Phase 3: Enhanced Progress Feedback

### Overview
Improve progress feedback to better communicate the ~60s extraction wait.

### Goal
Users understand what's happening during the long extraction process.

### Files to Modify

#### 1. `src/components/ExtractionProgress.tsx`

**Update stage messages with better timing expectations**:

```typescript
const stageMessages: Record<ExtractionStage, { text: string; progress: number }> = {
  idle: { text: 'Preparing...', progress: 0 },
  cropping: { text: 'Processing images...', progress: 10 },
  dominoes: { text: 'Reading domino pips...', progress: 25 },
  grid: { text: 'Analyzing puzzle grid (this takes ~60s)...', progress: 50 },
  solving: { text: 'Finding solution...', progress: 95 },
};
```

**Add pulsing animation for long waits**:

```typescript
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';

// In component:
const pulse = useSharedValue(1);

useEffect(() => {
  if (stage === 'grid') {
    pulse.value = withRepeat(
      withTiming(0.7, { duration: 1000 }),
      -1,
      true
    );
  } else {
    pulse.value = 1;
  }
}, [stage]);

const pulseStyle = useAnimatedStyle(() => ({
  opacity: pulse.value,
}));
```

#### 2. `src/app/index.tsx`

**Add elapsed time tracking** (optional enhancement):

```typescript
const [extractionStartTime, setExtractionStartTime] = useState<number | null>(null);

// In mutation onMutate:
setExtractionStartTime(Date.now());

// In onSuccess/onError:
setExtractionStartTime(null);
```

### Test Strategy

#### Manual Verification
- [ ] Progress message updates for each stage
- [ ] Grid stage shows "~60s" expectation message
- [ ] Pulse animation runs during grid extraction

### Rollback Plan
Revert to original static messages.

---

## Phase 4: Apply to Multi-Island Extraction

### Overview
Apply the same improvements to `extractMultiIslandPuzzle()` and `extractPuzzleFromImage()`.

### Goal
Consistent behavior across all extraction paths.

### Files to Modify

#### 1. `src/lib/services/gemini.ts`

**Update `extractMultiIslandPuzzle()` (line 1414+)**:
- Use Pro-only for grid extraction
- Wrap API calls with `withRetry()`
- Update progress callbacks

**Update `extractPuzzleFromImage()` (line 1835+)**:
- Same changes as above

### Test Strategy

#### Manual Verification
- [ ] Multi-island puzzle extracts correctly
- [ ] Single-image extraction works with retry logic

### Rollback Plan
Restore original function implementations.

---

## Testing Strategy

### Manual Testing Steps

1. **Simple Puzzle (5x4 grid)**
   - Expected: Completes in ~60-70s
   - Uses Pro only
   - Progress shows "Analyzing puzzle grid (~60s)..."

2. **Complex Puzzle (L-shaped)**
   - Expected: Same timing as simple
   - Pro handles irregular shapes accurately

3. **Network Failure Simulation**
   - Disconnect network briefly during extraction
   - Should retry with exponential backoff
   - Should eventually fail gracefully with clear error

---

## Performance Expectations

| Scenario | Before | After | Notes |
|----------|--------|-------|-------|
| Simple puzzle | ~63s | ~63s | Same - Pro is accurate |
| Complex puzzle | ~63s | ~63s | Same - Pro is accurate |
| Network failure | Fails immediately | Retries 3x | More reliable |
| UX during wait | Unclear progress | Clear "~60s" message | Better UX |

---

## Pre-Mortem Mitigations Applied

### Tigers Addressed:
1. **Model ID corrected** - Using `google/gemini-3-pro-preview`
2. **Parallel architecture simplified** - Single Pro pass (Flash tested inaccurate)
3. **Retry ordering fixed** - withRetry() added before removing outer loop
4. **Multi-island included** - Phase 4 covers all extraction paths

### Accepted Trade-offs:
- Speed remains ~63s (accuracy is priority)
- Removed Flash from pipeline (doesn't help accuracy)

### Pre-Mortem Run:
- Date: 2026-01-11
- Mode: deep
- Tigers: 4 (all addressed)
- Elephants: 2 (accepted)

---

## References

- Research findings: `thoughts/handoffs/puzzle-extraction-research.md`
- Pre-mortem analysis: User testing showed Flash inaccurate for puzzles
- AWS Retry Best Practices: https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html
