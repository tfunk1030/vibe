# Puzzle Extraction Accuracy and Performance Improvements

## Overview

This plan implements four key improvements to the puzzle extraction system based on research findings. The goals are:
1. **Faster extraction** - Use Flash model first, Pro only when needed (2-3x speedup)
2. **Better reliability** - Exponential backoff with jitter for API calls
3. **Higher accuracy** - Dual-pass verification for uncertain extractions
4. **Better UX** - Staged progress feedback during long operations

## Current State Analysis

### Architecture (from `src/lib/services/gemini.ts`)

The current extraction flow:
1. `extractPuzzleFromDualImages()` - Main entry point
2. Parallel extraction of dominoes + 2 grid passes
3. Uses `google/gemini-3-pro-preview` for pass 1, `google/gemini-2.5-flash` for pass 2
4. Compares grid results and picks the best one
5. Basic retry loop (MAX_RETRIES = 3) with no backoff

### Key Files
- **`src/lib/services/gemini.ts`** - All extraction logic (lines 1-1400+)
- **`src/components/ExtractionProgress.tsx`** - Progress UI component
- **`src/app/index.tsx`** - Main app with extraction state management

### Key Discoveries
- Grid extraction uses `extractGridFromImage()` with model selection based on attempt number (line 890)
- Domino extraction uses `extractDominoesFromImage()` with GPT-5.2 (line 467)
- Progress stages are: `'idle' | 'cropping' | 'dominoes' | 'grid' | 'solving'` (line 1241)
- Two-pass grid comparison already exists via `compareGridResponses()` (line 111-204)
- Retry logic exists but lacks exponential backoff (lines 1276-1400)

## Desired End State

After implementation:
1. Simple puzzles extract in ~25s (down from ~63s) using Flash-first
2. API failures recover gracefully with exponential backoff (1s, 2s, 4s)
3. Uncertain extractions trigger additional verification passes
4. Users see detailed progress stages with sub-stage messages

## What We're NOT Doing

- Client-side image preprocessing (complexity vs. benefit unclear)
- Caching extractions by image hash (future optimization)
- Changing the domino extraction model (GPT-5.2 works well)
- Modifying the solver logic

---

## Phase 1: Flash-First with Pro Fallback

### Overview
Restructure model selection to try Gemini 3 Flash first for all grid extractions, falling back to Gemini 3 Pro only when validation fails or confidence is low.

### Goal
2-3x speedup for simple puzzles (~25s vs ~63s) while maintaining accuracy for complex grids.

### Files to Modify

#### 1. `src/lib/services/gemini.ts`
**Changes**: Add Flash-first extraction logic with Pro fallback

```typescript
// Add new types near line 70
interface ModelConfig {
  primary: string;
  fallback: string;
  confidenceThreshold: number;
}

const GRID_MODEL_CONFIG: ModelConfig = {
  primary: 'google/gemini-3-flash',      // Fast, ~25s
  fallback: 'google/gemini-3-pro-preview', // Accurate, ~63s
  confidenceThreshold: 0.8,
};
```

**Modify `extractGridFromImage()` around line 848-890**:

```typescript
async function extractGridFromImage(
  base64Image: string,
  sizeHint?: GridSizeHint,
  attempt: number = 1,
  forceModel?: string  // NEW: allow forcing a specific model
): Promise<GridExtractionResponse> {
  // Use forced model or select based on attempt
  const model = forceModel
    ? forceModel
    : attempt === 1
      ? GRID_MODEL_CONFIG.primary
      : GRID_MODEL_CONFIG.fallback;

  console.log(`[AI] Extracting grid with ${model} (attempt ${attempt})...`);
  // ... rest of function
}
```

**Add new validation function around line 1065**:

```typescript
// Validate grid quality and determine if fallback is needed
function needsProFallback(
  gridData: GridExtractionResponse,
  sizeHint?: GridSizeHint
): { needsFallback: boolean; reason: string } {
  // Check cell count
  if (sizeHint) {
    const expectedCells = sizeHint.dominoCount * 2;
    const actualCells = gridData.regions.reduce((acc, r) => acc + r.cells.length, 0);

    if (Math.abs(actualCells - expectedCells) > 2) {
      return {
        needsFallback: true,
        reason: `Cell count mismatch: ${actualCells} vs expected ${expectedCells}`
      };
    }
  }

  // Check for non-contiguous regions
  for (const region of gridData.regions) {
    const cells = region.cells.map(c => parseCoordinate(c)).filter(Boolean) as ExtractedCell[];
    if (cells.length > 1 && !checkRegionContiguity(cells)) {
      return {
        needsFallback: true,
        reason: `Region ${region.id} is not contiguous`
      };
    }
  }

  // Check for missing constraint values on sum regions
  for (const region of gridData.regions) {
    if (region.constraint_type === 'sum' && region.constraint_value === undefined) {
      return {
        needsFallback: true,
        reason: `Region ${region.id} has sum constraint but no value`
      };
    }
  }

  return { needsFallback: false, reason: '' };
}
```

**Modify parallel extraction in `extractPuzzleFromDualImages()` around line 1280-1345**:

```typescript
// OPTIMIZATION: Try Flash first, only use Pro if needed
onProgress?.('dominoes');
console.log('[AI] Starting Flash-first extraction...');
const parallelStart = Date.now();

// Step 1: Run domino extraction + Flash grid pass in parallel
const dominoPromise = extractDominoesFromImage(dominoBase64, sizeHint?.dominoCount);
const flashGridPromise = extractGridFromImage(
  gridBase64,
  sizeHint,
  1,
  GRID_MODEL_CONFIG.primary
);

const [dominoResult, flashGrid] = await Promise.all([dominoPromise, flashGridPromise]);

console.log(`[AI] [TIMING] Flash extraction: ${Date.now() - parallelStart}ms`);
onProgress?.('grid');

// Step 2: Validate Flash result
const validation = needsProFallback(flashGrid, sizeHint);

let gridResult = flashGrid;
let usedFallback = false;

if (validation.needsFallback) {
  console.log(`[AI] Flash extraction needs fallback: ${validation.reason}`);
  console.log('[AI] Running Pro fallback...');

  const proStart = Date.now();
  gridResult = await extractGridFromImage(
    gridBase64,
    sizeHint,
    2,
    GRID_MODEL_CONFIG.fallback
  );
  usedFallback = true;
  console.log(`[AI] [TIMING] Pro fallback: ${Date.now() - proStart}ms`);
}

// Build confidence metadata
const confidence: ExtractionConfidence = {
  overall: usedFallback ? 0.9 : 1.0, // Slightly lower if fallback was needed
  dominoConfidence: 1.0,
  gridConfidence: usedFallback ? 0.85 : 0.95,
  warnings: usedFallback ? [validation.reason] : [],
  uncertainCells: [],
  uncertainRegions: [],
};
```

### Test Strategy

#### Automated Verification
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] No runtime errors in Expo logs

#### Manual Verification
- [ ] Test with simple 5x4 puzzle - should complete in ~25-30s
- [ ] Test with complex irregular grid - should use Pro fallback
- [ ] Verify extraction accuracy matches current implementation

### Rollback Plan
Revert the model selection changes in `extractGridFromImage()` to use Pro first:
```typescript
const model = attempt === 1 ? 'google/gemini-3-pro-preview' : 'google/gemini-2.5-flash';
```

---

## Phase 2: Exponential Backoff with Retry Logic

### Overview
Add robust retry logic with exponential backoff and jitter to handle API failures gracefully.

### Goal
Improve reliability by recovering from transient failures without overwhelming the API.

### Files to Modify

#### 1. `src/lib/services/gemini.ts`
**Add retry utility around line 30**:

```typescript
// Retry configuration
interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;  // 0.2 = +/- 20% randomness
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterFactor: 0.2,
};

// Calculate delay with exponential backoff and jitter
function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  const baseDelay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
    config.maxDelayMs
  );

  // Add jitter: +/- jitterFactor
  const jitter = baseDelay * config.jitterFactor * (Math.random() * 2 - 1);
  return Math.round(baseDelay + jitter);
}

// Check if error is retryable
function isRetryableError(error: Error, status?: number): boolean {
  // Retry on network errors
  if (error.message.includes('network') || error.message.includes('timeout')) {
    return true;
  }

  // Retry on server errors (5xx) and rate limits (429)
  if (status && (status >= 500 || status === 429)) {
    return true;
  }

  // Do NOT retry on client errors (4xx except 429)
  if (status && status >= 400 && status < 500) {
    return false;
  }

  // Retry on "ran out of tokens" errors (can succeed with different approach)
  if (error.message.includes('ran out of tokens')) {
    return true;
  }

  return false;
}

// Generic retry wrapper
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

      // Extract status code if available
      const statusMatch = lastError.message.match(/(\d{3})/);
      const status = statusMatch ? parseInt(statusMatch[1]) : undefined;

      if (attempt < config.maxAttempts && isRetryableError(lastError, status)) {
        const delay = calculateRetryDelay(attempt, config);
        console.log(`[AI] ${operationName} failed (attempt ${attempt}/${config.maxAttempts}): ${lastError.message}`);
        console.log(`[AI] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (!isRetryableError(lastError, status)) {
        // Non-retryable error, throw immediately
        throw lastError;
      }
    }
  }

  throw lastError || new Error(`${operationName} failed after ${config.maxAttempts} attempts`);
}
```

**Wrap API calls with retry logic**:

Modify `extractDominoesFromImage()` around line 457:

```typescript
async function extractDominoesFromImage(
  base64Image: string,
  expectedCount?: number
): Promise<ExtractedDomino[]> {
  return withRetry(
    () => extractDominoesFromImageInternal(base64Image, expectedCount),
    'Domino extraction'
  );
}

// Rename existing function to internal
async function extractDominoesFromImageInternal(
  base64Image: string,
  expectedCount?: number
): Promise<ExtractedDomino[]> {
  // ... existing implementation
}
```

Modify `extractGridFromImage()` around line 848:

```typescript
async function extractGridFromImage(
  base64Image: string,
  sizeHint?: GridSizeHint,
  attempt: number = 1,
  forceModel?: string
): Promise<GridExtractionResponse> {
  return withRetry(
    () => extractGridFromImageInternal(base64Image, sizeHint, attempt, forceModel),
    `Grid extraction (${forceModel || 'auto'})`
  );
}

// Rename existing function to internal
async function extractGridFromImageInternal(
  base64Image: string,
  sizeHint?: GridSizeHint,
  attempt: number = 1,
  forceModel?: string
): Promise<GridExtractionResponse> {
  // ... existing implementation
}
```

**Remove old retry loop in `extractPuzzleFromDualImages()`**:

The outer retry loop (lines 1276-1400) can be simplified since individual API calls now have retry logic:

```typescript
export async function extractPuzzleFromDualImages(
  dominoImageUri: string,
  gridImageUri: string,
  sizeHint?: GridSizeHint,
  onProgress?: (stage: ExtractionStage) => void
): Promise<PuzzleData> {
  // ... setup code

  // No outer retry loop needed - individual API calls handle retries
  try {
    // ... extraction logic (from Phase 1)
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
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Retry delays are within expected range

#### Manual Verification
- [ ] Simulate network timeout - should retry 3 times with increasing delays
- [ ] Simulate 429 rate limit - should retry with backoff
- [ ] Simulate 401 auth error - should fail immediately (no retry)

### Rollback Plan
Remove the `withRetry` wrapper calls and restore direct function calls:
```typescript
const dominoResult = await extractDominoesFromImageInternal(dominoBase64, sizeHint?.dominoCount);
```

---

## Phase 3: Dual-Pass Verification for Uncertain Extractions

### Overview
When initial extraction has low confidence or validation issues, run a second verification pass and merge results.

### Goal
20-30% accuracy improvement on irregular grids by detecting and flagging uncertainties.

### Files to Modify

#### 1. `src/lib/services/gemini.ts`
**Add verification pass logic after initial extraction**:

```typescript
// Configuration for when to trigger verification pass
interface VerificationConfig {
  minConfidenceForSkip: number;  // Skip verification if confidence above this
  maxCellDifference: number;     // Trigger verification if cell count differs by more
  maxConstraintMismatches: number;
}

const VERIFICATION_CONFIG: VerificationConfig = {
  minConfidenceForSkip: 0.95,
  maxCellDifference: 0,
  maxConstraintMismatches: 1,
};

// Determine if verification pass is needed
function needsVerificationPass(
  gridResult: GridExtractionResponse,
  sizeHint?: GridSizeHint,
  usedFallback: boolean = false
): boolean {
  // Always verify if we used fallback
  if (usedFallback) return true;

  // Verify if cell count doesn't match exactly
  if (sizeHint) {
    const expectedCells = sizeHint.dominoCount * 2;
    const actualCells = gridResult.regions.reduce((acc, r) => acc + r.cells.length, 0);
    if (actualCells !== expectedCells) return true;
  }

  // Verify if we have regions with questionable constraints
  let questionableConstraints = 0;
  for (const region of gridResult.regions) {
    if (region.constraint_type === 'any' && region.cells.length > 1) {
      questionableConstraints++;
    }
    if (region.constraint_type === 'sum' && region.constraint_value === undefined) {
      questionableConstraints++;
    }
  }

  return questionableConstraints > VERIFICATION_CONFIG.maxConstraintMismatches;
}

// Merge two grid results, preferring the more complete/consistent one
function mergeGridResults(
  primary: GridExtractionResponse,
  verification: GridExtractionResponse,
  sizeHint?: GridSizeHint
): { merged: GridExtractionResponse; uncertainCells: string[]; uncertainRegions: string[] } {
  const comparison = compareGridResponses(primary, verification);

  // If high agreement, trust primary
  if (comparison.score >= 0.95) {
    return {
      merged: primary,
      uncertainCells: [],
      uncertainRegions: [],
    };
  }

  // Otherwise, merge intelligently
  const merged = { ...primary };
  const uncertainCells: string[] = [...comparison.uncertainCells];
  const uncertainRegions: string[] = [...comparison.uncertainRegions];

  // If verification has better cell count, use its regions
  if (sizeHint) {
    const expectedCells = sizeHint.dominoCount * 2;
    const primaryCells = primary.regions.reduce((acc, r) => acc + r.cells.length, 0);
    const verifyCells = verification.regions.reduce((acc, r) => acc + r.cells.length, 0);

    const primaryDiff = Math.abs(primaryCells - expectedCells);
    const verifyDiff = Math.abs(verifyCells - expectedCells);

    if (verifyDiff < primaryDiff) {
      console.log('[AI] Verification pass has better cell count, using its regions');
      merged.regions = verification.regions;
    }
  }

  // Merge constraint values where verification is more complete
  for (let i = 0; i < merged.regions.length; i++) {
    const primaryRegion = merged.regions[i];

    // Find matching region in verification by cell overlap
    const verifyRegion = verification.regions.find(r => {
      const primaryCells = new Set(primaryRegion.cells);
      const overlap = r.cells.filter(c => primaryCells.has(c)).length;
      return overlap >= primaryRegion.cells.length * 0.5;
    });

    if (verifyRegion) {
      // If primary has 'any' but verification has a real constraint, use verification
      if (primaryRegion.constraint_type === 'any' && verifyRegion.constraint_type !== 'any') {
        merged.regions[i] = {
          ...primaryRegion,
          constraint_type: verifyRegion.constraint_type,
          constraint_value: verifyRegion.constraint_value,
        };
        uncertainRegions.push(primaryRegion.id);
      }

      // If sum constraint but missing value, take from verification
      if (primaryRegion.constraint_type === 'sum' &&
          primaryRegion.constraint_value === undefined &&
          verifyRegion.constraint_value !== undefined) {
        merged.regions[i].constraint_value = verifyRegion.constraint_value;
        uncertainRegions.push(primaryRegion.id);
      }
    }
  }

  return { merged, uncertainCells, uncertainRegions };
}
```

**Integrate verification into `extractPuzzleFromDualImages()`**:

After the Flash/Pro extraction (from Phase 1), add:

```typescript
// Step 3: Verification pass if needed
if (needsVerificationPass(gridResult, sizeHint, usedFallback)) {
  console.log('[AI] Running verification pass...');
  onProgress?.('grid');  // Stay on grid stage

  const verifyStart = Date.now();
  const verificationGrid = await extractGridFromImage(
    gridBase64,
    sizeHint,
    3,  // Third attempt uses a different approach
    GRID_MODEL_CONFIG.primary  // Use Flash for speed
  );
  console.log(`[AI] [TIMING] Verification pass: ${Date.now() - verifyStart}ms`);

  // Merge results
  const { merged, uncertainCells, uncertainRegions } = mergeGridResults(
    gridResult,
    verificationGrid,
    sizeHint
  );

  gridResult = merged;
  confidence.uncertainCells = uncertainCells;
  confidence.uncertainRegions = uncertainRegions;

  if (uncertainCells.length > 0 || uncertainRegions.length > 0) {
    console.log('[AI] Verification found uncertainties:', {
      cells: uncertainCells.length,
      regions: uncertainRegions.length,
    });
  }
}
```

#### 2. `src/lib/types/puzzle.ts`
**Ensure ExtractionConfidence includes uncertainty tracking** (verify this exists):

```typescript
export interface ExtractionConfidence {
  overall: number;
  dominoConfidence: number;
  gridConfidence: number;
  warnings: string[];
  uncertainCells: string[];    // Cells that differ between passes
  uncertainRegions: string[];  // Regions with constraint disagreement
}
```

### Test Strategy

#### Automated Verification
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] `needsVerificationPass` returns true for edge cases

#### Manual Verification
- [ ] Test with L-shaped puzzle - should not trigger verification if clean
- [ ] Test with complex multi-island puzzle - should trigger verification
- [ ] Verify merged results are more accurate than single-pass

### Rollback Plan
Remove the verification pass block and set `confidence.uncertainCells = []` and `confidence.uncertainRegions = []` directly.

---

## Phase 4: Enhanced Progress Feedback

### Overview
Add more granular progress stages and sub-stage messages for better user feedback during long extractions.

### Goal
Users understand what's happening during the ~25-60s extraction process.

### Files to Modify

#### 1. `src/lib/services/gemini.ts`
**Expand ExtractionStage type** (line 1241):

```typescript
export type ExtractionStage =
  | 'idle'
  | 'cropping'
  | 'dominoes'
  | 'dominoes_retry'
  | 'grid'
  | 'grid_flash'
  | 'grid_pro'
  | 'grid_verify'
  | 'solving';

// Add sub-stage messages for UI
export const STAGE_MESSAGES: Record<ExtractionStage, string> = {
  idle: 'Preparing...',
  cropping: 'Processing images...',
  dominoes: 'Reading domino pips...',
  dominoes_retry: 'Re-reading domino pips...',
  grid: 'Extracting puzzle grid...',
  grid_flash: 'Quick grid scan...',
  grid_pro: 'Detailed grid analysis...',
  grid_verify: 'Verifying extraction...',
  solving: 'Finding solution...',
};
```

**Update progress callbacks throughout extraction**:

```typescript
// In extractPuzzleFromDualImages()
onProgress?.('dominoes');  // Start domino extraction

// After domino extraction
onProgress?.('grid_flash');  // Flash pass

// If fallback needed
if (validation.needsFallback) {
  onProgress?.('grid_pro');  // Pro fallback
}

// If verification needed
if (needsVerificationPass(gridResult, sizeHint, usedFallback)) {
  onProgress?.('grid_verify');  // Verification pass
}

// Before returning
onProgress?.('solving');
```

#### 2. `src/components/ExtractionProgress.tsx`
**Update stage messages and progress percentages**:

```typescript
import type { ExtractionStage, STAGE_MESSAGES } from '@/lib/services/gemini';

const stageMessages: Record<ExtractionStage, { text: string; progress: number }> = {
  idle: { text: 'Preparing...', progress: 0 },
  cropping: { text: 'Processing images...', progress: 10 },
  dominoes: { text: 'Reading domino pips...', progress: 25 },
  dominoes_retry: { text: 'Re-reading domino pips...', progress: 30 },
  grid: { text: 'Extracting puzzle grid...', progress: 50 },
  grid_flash: { text: 'Quick grid scan...', progress: 55 },
  grid_pro: { text: 'Detailed grid analysis...', progress: 70 },
  grid_verify: { text: 'Verifying extraction...', progress: 85 },
  solving: { text: 'Finding solution...', progress: 95 },
};

// Update stage indicators to show all stages
const stages: ExtractionStage[] = ['cropping', 'dominoes', 'grid', 'solving'];
const detailedStages: ExtractionStage[] = [
  'cropping',
  'dominoes',
  'grid_flash',
  'grid_pro',
  'grid_verify',
  'solving'
];
```

**Add estimated time remaining** (optional enhancement):

```typescript
interface ExtractionProgressProps {
  stage: ExtractionStage;
  isDark: boolean;
  startTime?: number;  // NEW: track when extraction started
}

export function ExtractionProgress({ stage, isDark, startTime }: ExtractionProgressProps) {
  const stageInfo = stageMessages[stage] || stageMessages.idle;

  // Estimate remaining time based on typical durations
  const estimatedTotalMs = 30000;  // 30s for Flash path
  const elapsedMs = startTime ? Date.now() - startTime : 0;
  const remainingMs = Math.max(0, estimatedTotalMs * (1 - stageInfo.progress / 100));

  return (
    <Animated.View ...>
      {/* ... existing content ... */}

      {startTime && remainingMs > 0 && (
        <Text className={`text-xs mt-1 text-center ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>
          ~{Math.ceil(remainingMs / 1000)}s remaining
        </Text>
      )}
    </Animated.View>
  );
}
```

#### 3. `src/app/index.tsx`
**Track extraction start time**:

```typescript
// Add state for tracking extraction start time
const [extractionStartTime, setExtractionStartTime] = useState<number | null>(null);

// Update mutation onMutate
const dualExtractMutation = useMutation({
  mutationFn: ...,
  onMutate: () => {
    setLoading(true);
    setError(null);
    setExtractionStage('idle');
    setExtractionStartTime(Date.now());  // NEW
  },
  onSuccess: (puzzleData) => {
    // ... existing code
    setExtractionStartTime(null);  // NEW
  },
  onError: (err: Error) => {
    // ... existing code
    setExtractionStartTime(null);  // NEW
  },
});

// Pass to ExtractionProgress
{isLoading && (
  <ExtractionProgress
    stage={extractionStage}
    isDark={isDark}
    startTime={extractionStartTime ?? undefined}
  />
)}
```

### Test Strategy

#### Automated Verification
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] All stage types are handled in UI component

#### Manual Verification
- [ ] Progress bar updates smoothly through stages
- [ ] Stage messages accurately reflect current operation
- [ ] Time estimate is reasonably accurate

### Rollback Plan
Revert to original 5-stage enum and remove time tracking:
```typescript
export type ExtractionStage = 'idle' | 'cropping' | 'dominoes' | 'grid' | 'solving';
```

---

## Testing Strategy

### Unit Tests
Not applicable for this React Native app - testing is manual.

### Integration Tests
Not applicable - relying on manual verification.

### Manual Testing Steps

1. **Simple Puzzle (5x4 grid)**
   - Expected: Completes in ~25-30s
   - Uses Flash only
   - Progress shows "Quick grid scan..."

2. **Complex Puzzle (irregular L-shape)**
   - Expected: May trigger Pro fallback
   - Progress shows "Detailed grid analysis..."

3. **Multi-Island Puzzle**
   - Expected: Triggers verification pass
   - Progress shows "Verifying extraction..."

4. **Network Failure Simulation**
   - Disconnect network briefly during extraction
   - Should retry with exponential backoff
   - Should eventually fail gracefully with clear error

5. **Rate Limit Simulation**
   - Run multiple extractions quickly
   - Should handle 429 responses with backoff

---

## Performance Considerations

| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| Simple puzzle | ~63s | ~25s | 2.5x faster |
| Complex puzzle | ~63s | ~65s | Same (Pro used) |
| Multi-island | ~63s | ~35s | 1.8x faster |
| With retries | Fails | Recovers | More reliable |

---

## Migration Notes

No data migration required. Changes are purely in extraction logic and UI.

---

## References

- Research findings: `thoughts/handoffs/puzzle-extraction-research.md`
- Current implementation: `src/lib/services/gemini.ts`
- Progress UI: `src/components/ExtractionProgress.tsx`
- AWS Retry Best Practices: https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html
