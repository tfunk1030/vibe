# Debug Report: Puzzle Extraction System Changes
Generated: 2026-01-11

## Symptom
Code review of recent changes to retry logic, extraction simplification, and animation in the puzzle extraction system.

## Investigation Steps
1. Read the debug skill methodology
2. Examined `src/lib/services/gemini.ts` retry logic implementation (lines 37-109)
3. Examined `extractDominoesFromImage()` with retry wrapper (lines 541-604)
4. Examined `extractGridFromImage()` with retry wrapper (lines 984-1054)
5. Examined `extractPuzzleFromDualImages()` with removed outer retry loop (lines 1360-1446)
6. Examined `ExtractionProgress.tsx` animation implementation (lines 32-55)
7. Reviewed git diff to understand full scope of changes

---

## Findings

### Bug 1: Status Code Extraction is Fragile (MEDIUM)

**Location:** `C:/Users/tfunk/vibe/src/lib/services/gemini.ts:94-95`

```typescript
const statusMatch = lastError.message.match(/(\d{3})/);
const status = statusMatch ? parseInt(statusMatch[1]) : undefined;
```

**Problem:** This regex matches ANY 3-digit number in the error message, not specifically HTTP status codes.

**Example failure scenarios:**
- Error message: "Request failed after 500ms timeout" - Would incorrectly detect "500" as status code
- Error message: "Rate limit: 429 requests per hour, max 100 allowed" - Would match "429" correctly but also could match "100" in different contexts
- Error message: "Token limit is 8000" - Would incorrectly detect "800" as a status code

**Recommended Fix:**
```typescript
// Look for status in a more structured way
const statusMatch = lastError.message.match(/(?:status|error)[:\s]*(\d{3})|^(\d{3})\s/i);
const status = statusMatch ? parseInt(statusMatch[1] || statusMatch[2]) : undefined;
```

Or better - pass status explicitly from the error handler rather than parsing from message.

---

### Bug 2: Retry on Final Attempt Still Delays (LOW)

**Location:** `C:/Users/tfunk/vibe/src/lib/services/gemini.ts:97-104`

```typescript
if (attempt < config.maxAttempts && isRetryableError(lastError, status)) {
  const delay = calculateRetryDelay(attempt, config);
  console.log(`[AI] ${operationName} failed (attempt ${attempt}/${config.maxAttempts}): ${lastError.message}`);
  console.log(`[AI] Retrying in ${delay}ms...`);
  await new Promise(resolve => setTimeout(resolve, delay));
} else if (!isRetryableError(lastError, status)) {
  throw lastError;
}
```

**Problem:** When `attempt === config.maxAttempts` and `isRetryableError` returns true, the code falls through without throwing. The error is only thrown after the loop at line 108. This is correct behavior, but the logic flow is confusing.

**Not a bug, but the code could be clearer.**

---

### Bug 3: Jitter Calculation Can Produce Negative Delay (LOW)

**Location:** `C:/Users/tfunk/vibe/src/lib/services/gemini.ts:53-59`

```typescript
function calculateRetryDelay(attempt: number, config: RetryConfig): number {
  const baseDelay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
    config.maxDelayMs
  );
  const jitter = baseDelay * config.jitterFactor * (Math.random() * 2 - 1);
  return Math.round(baseDelay + jitter);
}
```

**Analysis:** With `jitterFactor: 0.2`, the jitter ranges from -20% to +20% of baseDelay.

For attempt 1:
- baseDelay = 1000ms
- jitter = 1000 * 0.2 * (-1 to 1) = -200 to +200
- result = 800 to 1200ms (valid)

**This is actually correct** - the result will always be positive since jitter is at most 20% of baseDelay.

---

### Bug 4: Validation Failure After Retry Exhaustion is Not Retried (CRITICAL)

**Location:** `C:/Users/tfunk/vibe/src/lib/services/gemini.ts:1393-1401`

```typescript
// Validate counts
if (sizeHint) {
  const expectedCells = sizeHint.dominoCount * 2;
  if (validCells.length !== expectedCells) {
    throw new Error(`Cell count mismatch: got ${validCells.length}, expected ${expectedCells}`);
  }
  if (dominoResult.length !== sizeHint.dominoCount) {
    throw new Error(`Domino count mismatch: got ${dominoResult.length}, expected ${sizeHint.dominoCount}`);
  }
}
```

**Problem:** The OLD code had an outer retry loop (lines 1260-1284 in old version) that would retry the ENTIRE extraction if validation failed. The NEW code only has `withRetry()` around individual API calls, but validation happens OUTSIDE the retry wrapper.

**Scenario:**
1. API call succeeds (no HTTP errors)
2. Response is parsed successfully
3. Validation fails (wrong cell count)
4. Error is thrown and NOT retried

The `withRetry()` wrapper only retries on network/API errors, not on validation failures. The old outer loop would catch ANY error and retry.

**Impact:** If the AI returns a valid JSON response but with wrong cell counts, the extraction will fail immediately without retry. Previously it would retry up to 3 times.

**Recommended Fix:** Either:
1. Re-add the outer retry loop for validation failures, OR
2. Add validation failure to `isRetryableError()`:
```typescript
if (error.message.includes('count mismatch')) {
  return true;
}
```

---

### Bug 5: Promise.all Usage is Correct (NO BUG)

**Location:** `C:/Users/tfunk/vibe/src/lib/services/gemini.ts:1379-1382`

```typescript
const [dominoResult, gridResult] = await Promise.all([
  dominoPromise,
  gridPromise,
]);
```

**Analysis:** The change from 3 promises to 2 is handled correctly. Promise.all is used properly.

---

### Bug 6: Unhandled Promise Rejection Edge Case (LOW)

**Location:** `C:/Users/tfunk/vibe/src/lib/services/gemini.ts:1368-1377`

```typescript
const dominoPromise = extractDominoesFromImage(dominoBase64, sizeHint?.dominoCount)
  .then(result => {
    console.log(`[AI] [TIMING] Domino extraction: ${Date.now() - parallelStart}ms`);
    return result;
  });
```

**Problem:** If `extractDominoesFromImage` throws before the `.then()` is attached, there's a brief window where the rejection is unhandled. However, since `Promise.all` is called immediately after, this is not a practical issue.

**Not a bug in practice.**

---

### Bug 7: Animation Cleanup is Correct (NO BUG)

**Location:** `C:/Users/tfunk/vibe/src/components/ExtractionProgress.tsx:35-50`

```typescript
useEffect(() => {
  if (stage === 'grid') {
    pulse.value = withRepeat(
      withTiming(0.6, { duration: 1200 }),
      -1,
      true
    );
  } else {
    cancelAnimation(pulse);
    pulse.value = 1;
  }

  return () => {
    cancelAnimation(pulse);
  };
}, [stage, pulse]);
```

**Analysis:**
- Cleanup function calls `cancelAnimation(pulse)` - correct
- Animation is cancelled when stage changes away from 'grid' - correct
- No memory leaks - the shared value `pulse` is managed by reanimated
- The `pulse` in dependencies is a shared value (stable reference)

**This is correctly implemented.**

---

### Bug 8: isRetryableError Missing Common Error Patterns (MEDIUM)

**Location:** `C:/Users/tfunk/vibe/src/lib/services/gemini.ts:62-80`

```typescript
function isRetryableError(error: Error, status?: number): boolean {
  // Retry on network errors
  if (error.message.includes('network') || error.message.includes('timeout')) {
    return true;
  }
  // ... rest
}
```

**Missing patterns:**
- `ECONNRESET` - connection reset by peer
- `ETIMEDOUT` - connection timed out
- `ENOTFOUND` - DNS lookup failed
- `fetch failed` - generic fetch failure
- `AbortError` - request was aborted
- `ECONNREFUSED` - connection refused
- `socket hang up` - socket disconnected

**Recommended Fix:**
```typescript
const NETWORK_ERROR_PATTERNS = [
  'network', 'timeout', 'ECONNRESET', 'ETIMEDOUT',
  'ENOTFOUND', 'fetch failed', 'AbortError',
  'ECONNREFUSED', 'socket hang up'
];

if (NETWORK_ERROR_PATTERNS.some(p => error.message.includes(p))) {
  return true;
}
```

---

### Bug 9: Empty Response Retries May Not Work as Expected (MEDIUM)

**Location:** `C:/Users/tfunk/vibe/src/lib/services/gemini.ts:1059-1074`

```typescript
if (!text || text.length < 10) {
  // ...
  if (finishReason === 'length' || finishReason === 'MAX_TOKENS') {
    throw new Error('Model ran out of tokens (spent on reasoning). Retrying with different approach...');
  }
  throw new Error('Gemini returned empty response - may be a complex/disconnected grid. Retrying...');
}
```

**Problem:** These errors will be caught by `withRetry()`, but `isRetryableError()` will return `false` for them:
- No status code in the message
- Message doesn't contain 'network' or 'timeout'
- Message doesn't contain 'ran out of tokens' (it says 'ran out of tokens (spent on reasoning)')

Wait - actually looking more carefully:
```typescript
if (error.message.includes('ran out of tokens')) {
  return true;
}
```

This WILL match 'Model ran out of tokens (spent on reasoning)' because it includes 'ran out of tokens'.

But the empty response error "Gemini returned empty response" will NOT be retried because it doesn't match any patterns.

**This may be intentional** (empty response means try a different approach, not just retry), but it's worth noting.

---

## Root Cause Analysis

**Primary Issue:** The removal of the outer retry loop means validation failures (cell count mismatch, domino count mismatch) are no longer retried.

**Confidence:** High

**Alternative hypotheses:**
1. The withRetry wrapper around API calls should be sufficient for most cases (network issues, rate limits)
2. Validation failures might indicate a fundamental problem that retrying won't fix

---

## Recommended Fix

### Files to modify:
- `C:/Users/tfunk/vibe/src/lib/services/gemini.ts` (line 76) - Add validation failure to retry patterns

### Steps:

1. **Add validation failures to isRetryableError:**
```typescript
// At line 76, before the final return false:
// Retry on validation failures (AI returned wrong counts)
if (error.message.includes('count mismatch')) {
  return true;
}
```

2. **Improve status code extraction (optional):**
```typescript
// Replace lines 94-95 with:
const statusMatch = lastError.message.match(/(?:status|error)[:\s]*(\d{3})\b/i);
const status = statusMatch ? parseInt(statusMatch[1]) : undefined;
```

3. **Add more network error patterns (optional):**
```typescript
// Replace lines 63-66 with:
const networkPatterns = ['network', 'timeout', 'ECONNRESET', 'ETIMEDOUT', 'fetch failed'];
if (networkPatterns.some(p => error.message.toLowerCase().includes(p.toLowerCase()))) {
  return true;
}
```

---

## Prevention

1. **Testing:** Add unit tests for `isRetryableError()` and `withRetry()` to verify all expected error patterns are handled
2. **Monitoring:** Log when retries happen and why, to understand failure patterns in production
3. **Design:** Consider a two-tier retry strategy - low-level for API errors, high-level for validation failures
