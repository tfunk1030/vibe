# Puzzle Extraction & Solver Accuracy Improvements

## Problem Summary

**User Report**: Easy/medium puzzles work. Hard puzzles fail on:
1. Wrong regions/constraints (extraction accuracy)
2. Solver says "no solution" on solvable puzzles (even after manual correction)
3. Constraints display correctly but solver still fails

**Root Causes Identified** (GPT-reviewed):

### BUG 1: Region/Cell Mismatch
Region cells that don't exist in validCells can never be covered → regions never complete

### BUG 2: No Pre-Validation
Missing checks for mathematically impossible constraints

### BUG 3: Tiling Feasibility (NEW)
- Odd cell count makes tiling impossible
- Checkerboard parity mismatch in connected components
- Disconnected islands with odd sizes

### BUG 4: Region Integrity (NEW)
- Non-contiguous regions
- Overlapping region cells
- Valid cells not covered by any region

---

## Implementation Plan

### Phase 1: Add Comprehensive Validation (HIGH PRIORITY)

**File**: `src/lib/services/solver.ts`

Add new `validatePuzzle()` function that checks ALL of the following before solving:

#### 1.1 Basic Cell Integrity
- Empty validCells → error
- Duplicate validCells → error

#### 1.2 Tiling Feasibility
- Odd cell count → "Tiling impossible: validCells count is odd"
- Checkerboard parity per component → "Tiling impossible: checkerboard parity mismatch"
- Odd-sized connected components → error

#### 1.3 Domino Inventory
- Pips out of range 0-6 → error
- Count mismatch (dominoes ≠ cells/2) → error

#### 1.4 Region Integrity
- Region cells not in validCells → "Region X contains invalid cell"
- Overlapping regions → "Region overlap at cell between region A and B"
- Non-contiguous region → "Region X is not contiguous"
- Valid cells not in any region → "Valid cell not covered by any region"

#### 1.5 Constraint Validation
- `sum`: value must be 0 to (size × 6)
- `equal`: value must be 0-6 if specified
- `different`: size must be ≤ 7
- `greater`: value must be < 6 (so at least 6 is valid)
- `less`: value must be > 0 (so at least 0 is valid)

#### 1.6 Implementation
```typescript
export function validatePuzzle(puzzle: PuzzleData): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const key = (c: Cell) => `${c.row},${c.col}`;
  const validSet = new Set(puzzle.validCells.map(key));

  // 1. Tiling feasibility - odd count
  if (puzzle.validCells.length % 2 !== 0) {
    errors.push("Tiling impossible: validCells count is odd.");
  }

  // 2. Domino count match
  if (puzzle.availableDominoes.length !== puzzle.validCells.length / 2) {
    errors.push("Domino count mismatch.");
  }

  // 3. Region integrity - overlaps, invalid cells, contiguity
  const covered = new Map<string, string>();
  for (const region of puzzle.regions) {
    // Check cells valid and no overlaps
    for (const cell of region.cells) {
      const k = key(cell);
      if (!validSet.has(k)) {
        errors.push(`Region ${region.id} contains invalid cell ${k}.`);
      }
      if (covered.has(k)) {
        errors.push(`Region overlap at ${k}.`);
      } else {
        covered.set(k, region.id);
      }
    }

    // Check contiguity via BFS
    const regionSet = new Set(region.cells.map(key));
    const seen = new Set<string>();
    const stack = [region.cells[0]];
    while (stack.length) {
      const cur = stack.pop()!;
      const k = key(cur);
      if (seen.has(k)) continue;
      seen.add(k);
      for (const n of [{row: cur.row-1, col: cur.col}, {row: cur.row+1, col: cur.col},
                       {row: cur.row, col: cur.col-1}, {row: cur.row, col: cur.col+1}]) {
        if (regionSet.has(key(n)) && !seen.has(key(n))) stack.push(n);
      }
    }
    if (seen.size !== regionSet.size) {
      errors.push(`Region ${region.id} is not contiguous.`);
    }
  }

  // 4. All valid cells must be in a region
  for (const cell of puzzle.validCells) {
    if (!covered.has(key(cell))) {
      errors.push(`Valid cell ${key(cell)} not covered by any region.`);
    }
  }

  // 5. Checkerboard parity per component
  // Build adjacency and check each connected component
  const adj = new Map<string, string[]>();
  for (const cell of puzzle.validCells) {
    const k = key(cell);
    const neighbors = [
      { row: cell.row - 1, col: cell.col },
      { row: cell.row + 1, col: cell.col },
      { row: cell.row, col: cell.col - 1 },
      { row: cell.row, col: cell.col + 1 },
    ].map(key).filter(nk => validSet.has(nk));
    adj.set(k, neighbors);
  }

  const componentSeen = new Set<string>();
  for (const cell of puzzle.validCells) {
    const startKey = key(cell);
    if (componentSeen.has(startKey)) continue;

    const stack = [startKey];
    let count = 0;
    let black = 0;
    let white = 0;

    while (stack.length) {
      const k = stack.pop()!;
      if (componentSeen.has(k)) continue;
      componentSeen.add(k);
      count++;

      const [rStr, cStr] = k.split(',');
      const r = Number(rStr);
      const c = Number(cStr);
      if ((r + c) % 2 === 0) black++;
      else white++;

      for (const nk of adj.get(k) ?? []) {
        if (!componentSeen.has(nk)) stack.push(nk);
      }
    }

    if (count % 2 !== 0) {
      errors.push("Tiling impossible: a connected component has odd size.");
    }
    if (black !== white) {
      errors.push("Tiling impossible: checkerboard parity mismatch in a component.");
    }
  }

  // 6. Constraint validation
  for (const region of puzzle.regions) {
    const size = region.cells.length;
    const c = region.constraint;

    if (c.type === 'sum') {
      if (c.value === undefined || c.value < 0 || c.value > size * 6) {
        errors.push(`Region ${region.id}: sum=${c.value} impossible for ${size} cells (range: 0-${size * 6}).`);
      }
    }
    if (c.type === 'different' && size > 7) {
      errors.push(`Region ${region.id}: different impossible with ${size} cells (max 7 unique pip values 0-6).`);
    }
    if (c.type === 'greater' && c.value !== undefined && c.value >= 6) {
      errors.push(`Region ${region.id}: greater than ${c.value} impossible (max pip is 6).`);
    }
    if (c.type === 'less' && c.value !== undefined && c.value <= 0) {
      errors.push(`Region ${region.id}: less than ${c.value} impossible (min pip is 0).`);
    }
  }

  return { ok: errors.length === 0, errors };
}
```

---

### Phase 2: Wire Validation into Solver (HIGH PRIORITY)

**File**: `src/lib/services/solver.ts`

Call `validatePuzzle()` at the start of `solvePuzzle()`:

```typescript
export function solvePuzzle(puzzle: PuzzleData): PuzzleSolution {
  // NEW: Run comprehensive validation first
  const validation = validatePuzzle(puzzle);
  if (!validation.ok) {
    console.error('[Solver] Validation failed:', validation.errors);
    return {
      placements: [],
      isValid: false,
      error: validation.errors.join('\n'),
    };
  }

  // Existing solver code continues here...
}
```

---

### Phase 3: Surface Errors to User (MEDIUM PRIORITY)

**File**: `src/app/index.tsx`

**Changes**:
- Display validation/solver errors in the UI (not just console)
- Format multi-line errors nicely
- Add "Show Details" button for full error list

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/lib/services/solver.ts` | Add `validatePuzzle()` function, call it before solving |
| `src/app/index.tsx` | Display validation errors in UI |

---

## Verification Plan

### Test Scenarios

1. **Odd Cell Count**
   - Create puzzle with 15 cells (odd)
   - Verify: "Tiling impossible: validCells count is odd"

2. **Region/Cell Mismatch**
   - Create region with cell outside valid grid
   - Verify: "Region X contains invalid cell"

3. **Impossible Constraint**
   - Create 8-cell region with "different" constraint
   - Verify: "Region X: different impossible with 8 cells"

4. **Non-Contiguous Region**
   - Create region with cells that don't connect
   - Verify: "Region X is not contiguous"

5. **Checkerboard Parity**
   - Create L-shaped grid with mismatched black/white cells
   - Verify: "Tiling impossible: checkerboard parity mismatch"

6. **Easy/Medium Regression**
   - Run existing working puzzles
   - Verify no regression

### Manual Testing

1. Take screenshot of hard NYT Pips puzzle
2. Extract puzzle
3. Attempt solve
4. If fails: verify specific error message (not generic "no solution")
5. Error should identify which region/cell is problematic
6. Edit to fix → re-solve

---

## Implementation Order

1. Add `validatePuzzle()` function to solver.ts
2. Call validation at start of `solvePuzzle()`
3. Update UI to display validation errors
4. Test with known-failing hard puzzles

---

## Estimated Effort

- Phase 1 (validatePuzzle function): ~1 hour
- Phase 2 (Wire into solver): ~15 minutes
- Phase 3 (UI error display): ~30 minutes
- Testing: ~30 minutes

**Total: ~2-3 hours of implementation**
