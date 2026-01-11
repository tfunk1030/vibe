import {
  PuzzleData,
  PuzzleSolution,
  PlacedDomino,
  Domino,
  Cell,
  Region,
  cellKey,
  areCellsAdjacent,
} from '../types/puzzle';

// ==========================================
// Puzzle Validation
// ==========================================

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Comprehensive puzzle validation before solving.
 * Catches extraction errors and impossible puzzles early.
 */
export function validatePuzzle(puzzle: PuzzleData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const key = (c: Cell) => `${c.row},${c.col}`;
  const validSet = new Set(puzzle.validCells.map(key));

  // 1. Basic validation - empty puzzle
  if (puzzle.validCells.length === 0) {
    errors.push('No valid cells in puzzle.');
    return { ok: false, errors, warnings };
  }

  // 2. Check for duplicate valid cells
  const seenCells = new Set<string>();
  for (const cell of puzzle.validCells) {
    const k = key(cell);
    if (seenCells.has(k)) {
      errors.push(`Duplicate cell at (${cell.row},${cell.col}).`);
    }
    seenCells.add(k);
  }

  // 3. Tiling feasibility - odd cell count
  if (puzzle.validCells.length % 2 !== 0) {
    errors.push(`Tiling impossible: ${puzzle.validCells.length} cells (odd number). Dominoes need pairs.`);
  }

  // 4. Domino count match
  const expectedDominoes = puzzle.validCells.length / 2;
  if (puzzle.availableDominoes.length !== expectedDominoes) {
    errors.push(`Domino count mismatch: ${puzzle.availableDominoes.length} dominoes for ${puzzle.validCells.length} cells (need ${expectedDominoes}).`);
  }

  // 5. Domino pip validation (0-6 range)
  for (let i = 0; i < puzzle.availableDominoes.length; i++) {
    const d = puzzle.availableDominoes[i];
    if (d.pips[0] < 0 || d.pips[0] > 6 || d.pips[1] < 0 || d.pips[1] > 6) {
      errors.push(`Domino ${i + 1} has invalid pips [${d.pips[0]},${d.pips[1]}]. Must be 0-6.`);
    }
  }

  // 6. Region integrity checks
  const coveredByRegion = new Map<string, string>();

  for (const region of puzzle.regions) {
    // Check for empty region
    if (region.cells.length === 0) {
      warnings.push(`Region ${region.id} has no cells.`);
      continue;
    }

    // Check for duplicate cells within region
    const regionCellKeys = region.cells.map(key);
    if (new Set(regionCellKeys).size !== regionCellKeys.length) {
      errors.push(`Region ${region.id} has duplicate cells.`);
    }

    // Check cells valid and no overlaps between regions
    for (const cell of region.cells) {
      const k = key(cell);
      if (!validSet.has(k)) {
        errors.push(`Region ${region.id} contains cell (${cell.row},${cell.col}) not in valid grid.`);
      }
      if (coveredByRegion.has(k)) {
        errors.push(`Cell (${cell.row},${cell.col}) overlaps: regions ${coveredByRegion.get(k)} and ${region.id}.`);
      } else {
        coveredByRegion.set(k, region.id);
      }
    }

    // Check region contiguity via BFS
    if (region.cells.length > 1) {
      const regionSet = new Set(region.cells.map(key));
      const seen = new Set<string>();
      const stack: Cell[] = [region.cells[0]];

      while (stack.length > 0) {
        const cur = stack.pop()!;
        const k = key(cur);
        if (seen.has(k)) continue;
        seen.add(k);

        const neighbors = [
          { row: cur.row - 1, col: cur.col },
          { row: cur.row + 1, col: cur.col },
          { row: cur.row, col: cur.col - 1 },
          { row: cur.row, col: cur.col + 1 },
        ];

        for (const n of neighbors) {
          const nk = key(n);
          if (regionSet.has(nk) && !seen.has(nk)) {
            stack.push(n);
          }
        }
      }

      if (seen.size !== regionSet.size) {
        errors.push(`Region ${region.id} is not contiguous (${seen.size} connected, ${regionSet.size} total).`);
      }
    }
  }

  // 7. Check for orphan cells (warning, not error - they get 'any' constraint)
  const orphanCount = puzzle.validCells.filter(c => !coveredByRegion.has(key(c))).length;
  if (orphanCount > 0) {
    warnings.push(`${orphanCount} cell(s) not assigned to any region (will use 'any' constraint).`);
  }

  // 8. Checkerboard parity per connected component
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
  let componentIndex = 0;

  for (const cell of puzzle.validCells) {
    const startKey = key(cell);
    if (componentSeen.has(startKey)) continue;

    const stack = [startKey];
    let count = 0;
    let black = 0;
    let white = 0;

    while (stack.length > 0) {
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

    componentIndex++;

    if (count % 2 !== 0) {
      errors.push(`Island ${componentIndex}: ${count} cells (odd). Tiling impossible.`);
    }

    if (black !== white) {
      errors.push(`Island ${componentIndex}: checkerboard parity mismatch (${black} black, ${white} white cells).`);
    }
  }

  // 9. Constraint validation
  for (const region of puzzle.regions) {
    const size = region.cells.length;
    const c = region.constraint;

    if (c.type === 'sum' && c.value !== undefined) {
      const minPossible = 0; // All 0s
      const maxPossible = size * 6; // All 6s
      if (c.value < minPossible || c.value > maxPossible) {
        errors.push(`Region ${region.id}: sum=${c.value} impossible for ${size} cells (range: ${minPossible}-${maxPossible}).`);
      }
    }

    if (c.type === 'different' && size > 7) {
      errors.push(`Region ${region.id}: 'different' constraint impossible with ${size} cells (max 7 unique pips 0-6).`);
    }

    if (c.type === 'greater' && c.value !== undefined) {
      // Sum-based: max possible sum is size * 6
      const maxSum = size * 6;
      if (c.value >= maxSum) {
        errors.push(`Region ${region.id}: 'greater than ${c.value}' impossible for ${size} cells (max sum is ${maxSum}).`);
      }
    }

    if (c.type === 'less' && c.value !== undefined) {
      // Sum-based: min possible sum is 0
      if (c.value <= 0) {
        errors.push(`Region ${region.id}: 'less than ${c.value}' impossible (min sum is 0).`);
      }
    }
  }

  // 10. Check for sum constraints that can't be satisfied with available dominoes
  const dominoSums = puzzle.availableDominoes.map(d => d.pips[0] + d.pips[1]);
  const allPips = puzzle.availableDominoes.flatMap(d => d.pips);
  const totalPipSum = allPips.reduce((a, b) => a + b, 0);

  // For 2-cell adjacent sum regions, check if a domino with that sum exists
  for (const region of puzzle.regions) {
    if (region.constraint.type === 'sum' && region.cells.length === 2) {
      const [c1, c2] = region.cells;
      if (areCellsAdjacent(c1, c2)) {
        const neededSum = region.constraint.value!;
        if (!dominoSums.includes(neededSum)) {
          warnings.push(`Region ${region.id}: needs sum=${neededSum} for 2 adjacent cells, but no domino has that sum.`);
        }
      }
    }
  }

  // Check if total sum constraints exceed available pip sum
  let totalSumConstraints = 0;
  let sumConstraintRegionCells = 0;
  for (const region of puzzle.regions) {
    if (region.constraint.type === 'sum' && region.constraint.value !== undefined) {
      totalSumConstraints += region.constraint.value;
      sumConstraintRegionCells += region.cells.length;
    }
  }

  // If sum constraints cover all cells, total must match
  if (sumConstraintRegionCells === puzzle.validCells.length && totalSumConstraints !== totalPipSum) {
    warnings.push(`Sum constraints total ${totalSumConstraints} but available pips total ${totalPipSum}.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}

// Get pip value at a cell given current placements
function getPipAtCell(
  cell: Cell,
  placements: PlacedDomino[]
): number | null {
  for (const placement of placements) {
    const [c1, c2] = placement.cells;
    if (cellKey(c1) === cellKey(cell)) {
      return placement.domino.pips[0];
    }
    if (cellKey(c2) === cellKey(cell)) {
      return placement.domino.pips[1];
    }
  }
  return null;
}

// Check if a region constraint is satisfied
function checkRegionConstraint(
  region: Region,
  placements: PlacedDomino[],
  partial: boolean = false
): boolean {
  const pips: number[] = [];
  let hasEmpty = false;

  for (const cell of region.cells) {
    const pip = getPipAtCell(cell, placements);
    if (pip === null) {
      hasEmpty = true;
    } else {
      pips.push(pip);
    }
  }

  // If partial check, allow incomplete regions
  if (partial && hasEmpty) {
    return checkPartialConstraint(region.constraint, pips);
  }

  // Full check - region must be complete
  if (hasEmpty) {
    return false;
  }

  return checkConstraint(region.constraint, pips);
}

function checkConstraint(
  constraint: { type: string; value?: number },
  pips: number[]
): boolean {
  if (pips.length === 0) return true;

  switch (constraint.type) {
    case 'sum':
      return pips.reduce((a, b) => a + b, 0) === constraint.value;
    case 'equal':
      return pips.every((p) => p === pips[0]);
    case 'different':
      return new Set(pips).size === pips.length;
    case 'greater':
      // Sum of all pips must be greater than value
      return pips.reduce((a, b) => a + b, 0) > (constraint.value ?? 0);
    case 'less':
      // Sum of all pips must be less than value
      return pips.reduce((a, b) => a + b, 0) < (constraint.value ?? Infinity);
    case 'any':
      return true;
    default:
      return true;
  }
}

function checkPartialConstraint(
  constraint: { type: string; value?: number },
  pips: number[]
): boolean {
  if (pips.length === 0) return true;

  switch (constraint.type) {
    case 'sum':
      // Sum so far shouldn't exceed target
      return pips.reduce((a, b) => a + b, 0) <= (constraint.value ?? Infinity);
    case 'equal':
      // All current values should be equal
      return pips.every((p) => p === pips[0]);
    case 'different':
      // No duplicates so far
      return new Set(pips).size === pips.length;
    case 'greater':
      // Sum-based: can't prune early since adding more pips increases sum
      return true;
    case 'less':
      // Sum-based: if sum already >= value, we've failed (can't decrease by adding pips)
      return pips.reduce((a, b) => a + b, 0) < (constraint.value ?? Infinity);
    case 'any':
      return true;
    default:
      return true;
  }
}

// Get all valid adjacent cell pairs for a cell
function getAdjacentCells(cell: Cell, validCellSet: Set<string>): Cell[] {
  const neighbors = [
    { row: cell.row - 1, col: cell.col },
    { row: cell.row + 1, col: cell.col },
    { row: cell.row, col: cell.col - 1 },
    { row: cell.row, col: cell.col + 1 },
  ];

  return neighbors.filter(n => validCellSet.has(cellKey(n)));
}

// Get covered cells from placements
function getCoveredCells(placements: PlacedDomino[]): Set<string> {
  const covered = new Set<string>();
  for (const p of placements) {
    covered.add(cellKey(p.cells[0]));
    covered.add(cellKey(p.cells[1]));
  }
  return covered;
}

// Find first uncovered cell (prefer cells with fewer uncovered neighbors - MRV)
function findBestUncoveredCell(
  validCells: Cell[],
  coveredCells: Set<string>,
  adjacencyMap: Map<string, Cell[]>
): Cell | null {
  let bestCell: Cell | null = null;
  let minNeighbors = Infinity;

  for (const cell of validCells) {
    const key = cellKey(cell);
    if (coveredCells.has(key)) continue;

    const neighbors = adjacencyMap.get(key) || [];
    const uncoveredNeighbors = neighbors.filter(n => !coveredCells.has(cellKey(n)));

    // If a cell has no uncovered neighbors, we're stuck - return it immediately
    if (uncoveredNeighbors.length === 0) {
      return cell;
    }

    // MRV: prefer cells with fewer options
    if (uncoveredNeighbors.length < minNeighbors) {
      minNeighbors = uncoveredNeighbors.length;
      bestCell = cell;
    }
  }

  return bestCell;
}

// OPTIMIZATION: Forward checking - detect if any uncovered cell is stranded
function hasStrandedCell(
  validCells: Cell[],
  coveredCells: Set<string>,
  adjacencyMap: Map<string, Cell[]>
): boolean {
  for (const cell of validCells) {
    const key = cellKey(cell);
    if (coveredCells.has(key)) continue;

    const neighbors = adjacencyMap.get(key) || [];
    const uncoveredNeighbors = neighbors.filter(n => !coveredCells.has(cellKey(n)));

    // Cell has no valid pairing options - dead end
    if (uncoveredNeighbors.length === 0) {
      return true;
    }
  }
  return false;
}

// OPTIMIZATION: Order dominoes by constraint relevance
// Prioritize dominoes whose sums match 2-cell region constraints
function getOrderedDominoIndices(
  dominoes: Domino[],
  usedIndices: Set<number>,
  regionsToCheck: Region[]
): number[] {
  const indices = dominoes
    .map((_, i) => i)
    .filter(i => !usedIndices.has(i));

  // Find sums needed for 2-cell sum constraints (tightest constraints)
  const neededSums = new Set<number>();
  for (const r of regionsToCheck) {
    if (r.constraint.type === 'sum' && r.cells.length === 2 && r.constraint.value !== undefined) {
      neededSums.add(r.constraint.value);
    }
  }

  // If no specific constraints, return unsorted
  if (neededSums.size === 0) {
    return indices;
  }

  // Prioritize dominoes matching needed sums
  return indices.sort((a, b) => {
    const sumA = dominoes[a].pips[0] + dominoes[a].pips[1];
    const sumB = dominoes[b].pips[0] + dominoes[b].pips[1];
    const aNeeded = neededSums.has(sumA) ? 0 : 1;
    const bNeeded = neededSums.has(sumB) ? 0 : 1;
    return aNeeded - bNeeded;
  });
}

// Main solver using backtracking with optimizations
function solve(
  puzzle: PuzzleData,
  adjacencyMap: Map<string, Cell[]>,
  placements: PlacedDomino[],
  usedDominoes: Set<number>,
  regionsToCheck: Region[]
): PlacedDomino[] | null {
  const coveredCells = getCoveredCells(placements);

  // Find best uncovered cell (MRV heuristic)
  const uncoveredCell = findBestUncoveredCell(puzzle.validCells, coveredCells, adjacencyMap);

  // If all cells covered, verify final constraints
  if (!uncoveredCell) {
    for (const region of regionsToCheck) {
      if (!checkRegionConstraint(region, placements, false)) {
        return null;
      }
    }
    return [...placements];
  }

  // Get adjacent uncovered cells we can pair with
  const neighbors = adjacencyMap.get(cellKey(uncoveredCell)) || [];
  const uncoveredNeighbors = neighbors.filter(n => !coveredCells.has(cellKey(n)));

  // If no uncovered neighbors, this path is impossible
  if (uncoveredNeighbors.length === 0) {
    return null;
  }

  // OPTIMIZATION: Get dominoes ordered by constraint relevance
  const orderedDominoIndices = getOrderedDominoIndices(
    puzzle.availableDominoes,
    usedDominoes,
    regionsToCheck
  );

  // Try each neighbor cell
  for (const neighborCell of uncoveredNeighbors) {
    // Try each available domino (in optimized order)
    for (const i of orderedDominoIndices) {
      const domino = puzzle.availableDominoes[i];

      // Try both orientations of the domino (which pip goes to which cell)
      const orientations: [number, number][] = [
        [domino.pips[0], domino.pips[1]],
        [domino.pips[1], domino.pips[0]],
      ];

      for (const [pip1, pip2] of orientations) {
        const placement: PlacedDomino = {
          domino: { id: domino.id, pips: [pip1, pip2] },
          cells: [uncoveredCell, neighborCell],
        };

        // Add placement
        const newPlacements = [...placements, placement];
        const newUsed = new Set(usedDominoes);
        newUsed.add(i);

        // Check partial constraints (prune early)
        let valid = true;
        for (const region of regionsToCheck) {
          if (!checkRegionConstraint(region, newPlacements, true)) {
            valid = false;
            break;
          }
        }

        if (!valid) continue;

        // OPTIMIZATION: Forward checking - detect dead ends early
        const newCovered = getCoveredCells(newPlacements);
        if (hasStrandedCell(puzzle.validCells, newCovered, adjacencyMap)) {
          continue; // Skip this branch - will lead to dead end
        }

        const result = solve(puzzle, adjacencyMap, newPlacements, newUsed, regionsToCheck);
        if (result) {
          return result;
        }
      }
    }
  }

  return null;
}

export function solvePuzzle(puzzle: PuzzleData): PuzzleSolution {
  const solverStartTime = Date.now();
  console.log('[Solver] ========== SOLVER START ==========');
  console.log('[Solver] Starting solve...', {
    cells: puzzle.validCells.length,
    dominoes: puzzle.availableDominoes.length,
    regions: puzzle.regions.length,
  });

  // Run comprehensive validation first
  const validation = validatePuzzle(puzzle);

  if (validation.warnings.length > 0) {
    console.warn('[Solver] Validation warnings:', validation.warnings);
  }

  if (!validation.ok) {
    console.error('[Solver] Validation failed:', validation.errors);
    return {
      placements: [],
      isValid: false,
      error: validation.errors.join('\n'),
    };
  }

  // Log valid cells to check island structure
  console.log('[Solver] Valid cells:', puzzle.validCells.map(c => `(${c.row},${c.col})`).join(' '));

  // Detect islands (connected components)
  const validCellSet = new Set(puzzle.validCells.map(cellKey));
  const visited = new Set<string>();
  const islands: Cell[][] = [];

  for (const startCell of puzzle.validCells) {
    const key = cellKey(startCell);
    if (visited.has(key)) continue;

    // BFS to find connected component
    const island: Cell[] = [];
    const queue: Cell[] = [startCell];
    visited.add(key);

    while (queue.length > 0) {
      const cell = queue.shift()!;
      island.push(cell);

      // Check all 4 neighbors
      const neighbors = [
        { row: cell.row - 1, col: cell.col },
        { row: cell.row + 1, col: cell.col },
        { row: cell.row, col: cell.col - 1 },
        { row: cell.row, col: cell.col + 1 },
      ];

      for (const n of neighbors) {
        const nKey = cellKey(n);
        if (validCellSet.has(nKey) && !visited.has(nKey)) {
          visited.add(nKey);
          queue.push(n);
        }
      }
    }

    islands.push(island);
  }

  console.log(`[Solver] Found ${islands.length} island(s):`);
  islands.forEach((island, i) => {
    console.log(`[Solver]   Island ${i + 1}: ${island.length} cells - ${island.map(c => `(${c.row},${c.col})`).join(' ')}`);
  });

  // Log domino values for debugging
  console.log('[Solver] Dominoes:', puzzle.availableDominoes.map(d => `[${d.pips[0]},${d.pips[1]}]`).join(' '));

  // Log region constraints for debugging
  for (const region of puzzle.regions) {
    const cellsStr = region.cells.map(c => `(${c.row},${c.col})`).join(',');
    console.log(`[Solver] Region ${region.id}: ${region.constraint.type}${region.constraint.value !== undefined ? '=' + region.constraint.value : ''} cells:[${cellsStr}]`);
  }

  // Log domino pip sums to help debug constraint issues
  const dominoSums = puzzle.availableDominoes.map(d => d.pips[0] + d.pips[1]);
  console.log('[Solver] Domino pip sums:', dominoSums.sort((a, b) => a - b).join(', '));

  // Pre-check: For 2-cell sum regions where both cells are adjacent, check if a matching domino exists
  for (const region of puzzle.regions) {
    if (region.constraint.type === 'sum' && region.cells.length === 2) {
      const [c1, c2] = region.cells;
      if (areCellsAdjacent(c1, c2)) {
        const neededSum = region.constraint.value!;
        const hasDomino = dominoSums.includes(neededSum);
        if (!hasDomino) {
          console.log(`[Solver] WARNING: Region ${region.id} needs sum=${neededSum} for 2 adjacent cells, but no domino has that sum!`);
        }
      }
    }
  }

  // Validate puzzle has correct number of cells for dominoes
  if (puzzle.validCells.length !== puzzle.availableDominoes.length * 2) {
    console.log('[Solver] Cell/domino mismatch');
    return {
      placements: [],
      isValid: false,
      error: `Invalid puzzle: ${puzzle.validCells.length} cells but ${puzzle.availableDominoes.length} dominoes (need ${puzzle.availableDominoes.length * 2} cells)`,
    };
  }

  // Build set of all cells that are in regions
  const regionCellSet = new Set<string>();
  for (const region of puzzle.regions) {
    for (const cell of region.cells) {
      regionCellSet.add(cellKey(cell));
    }
  }

  // Find orphan cells (valid cells not in any region)
  const orphanCells = puzzle.validCells.filter(c => !regionCellSet.has(cellKey(c)));

  // Create a working copy of regions, adding orphans to an "any" region
  let regionsToCheck = [...puzzle.regions];
  if (orphanCells.length > 0) {
    console.log('[Solver] Found', orphanCells.length, 'orphan cells, treating as "any" constraint');
    regionsToCheck.push({
      id: 'orphan-region',
      cells: orphanCells,
      color: '#888888',
      constraint: { type: 'any' },
    });
  }

  // OPTIMIZATION: Precompute adjacency map once (avoids recalculating per cell)
  const adjacencyMap = new Map<string, Cell[]>();
  for (const cell of puzzle.validCells) {
    adjacencyMap.set(cellKey(cell), getAdjacentCells(cell, validCellSet));
  }
  console.log('[Solver] Precomputed adjacency map for', adjacencyMap.size, 'cells');

  const solveStart = Date.now();
  try {
    const result = solve(puzzle, adjacencyMap, [], new Set(), regionsToCheck);

    const solveDuration = Date.now() - solveStart;
    const totalSolverTime = Date.now() - solverStartTime;
    if (result) {
      console.log('[Solver] ========== SOLVER COMPLETE ==========');
      console.log(`[Solver] [TIMING] Backtracking search: ${solveDuration}ms`);
      console.log(`[Solver] [TIMING] Total solver time: ${totalSolverTime}ms`);
      console.log(`[Solver] Solution found with ${result.length} placements`);
      return {
        placements: result,
        isValid: true,
      };
    } else {
      console.log(`[Solver] No solution found (searched for ${solveDuration}ms)`);

      // Analyze why - check if constraints are even satisfiable
      const allPips = puzzle.availableDominoes.flatMap(d => d.pips);
      const pipSum = allPips.reduce((a, b) => a + b, 0);
      const pipCounts = new Map<number, number>();
      for (const p of allPips) {
        pipCounts.set(p, (pipCounts.get(p) || 0) + 1);
      }

      console.log('[Solver] Available pips:', allPips.sort((a, b) => a - b).join(','));
      console.log('[Solver] Pip counts:', Array.from(pipCounts.entries()).map(([p, c]) => `${p}:${c}`).join(' '));
      console.log('[Solver] Total pip sum:', pipSum);

      // Log constraint details for debugging
      for (const region of regionsToCheck) {
        if (region.constraint.type === 'sum' && region.constraint.value !== undefined) {
          console.log(`[Solver] Sum constraint: ${region.cells.length} cells need sum=${region.constraint.value}`);
        }
        if (region.constraint.type === 'different') {
          console.log(`[Solver] Different constraint: ${region.cells.length} cells need unique values`);
        }
        if (region.constraint.type === 'equal') {
          console.log(`[Solver] Equal constraint: ${region.cells.length} cells need same value`);
        }
      }

      return {
        placements: [],
        isValid: false,
        error: 'No solution found. Check that regions and dominoes are correct.',
      };
    }
  } catch (error) {
    console.error('[Solver] Error:', error);
    return {
      placements: [],
      isValid: false,
      error: `Solver error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// Verify a partial solution
export function verifyPartialSolution(
  puzzle: PuzzleData,
  placements: PlacedDomino[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for overlapping cells
  const usedCells = new Set<string>();
  for (const placement of placements) {
    const [c1, c2] = placement.cells;
    const k1 = cellKey(c1);
    const k2 = cellKey(c2);

    if (usedCells.has(k1)) {
      errors.push(`Cell (${c1.row}, ${c1.col}) used by multiple dominoes`);
    }
    if (usedCells.has(k2)) {
      errors.push(`Cell (${c2.row}, ${c2.col}) used by multiple dominoes`);
    }

    usedCells.add(k1);
    usedCells.add(k2);
  }

  // Check domino adjacency
  for (const placement of placements) {
    const [c1, c2] = placement.cells;
    if (!areCellsAdjacent(c1, c2)) {
      errors.push(`Domino cells (${c1.row},${c1.col}) and (${c2.row},${c2.col}) are not adjacent`);
    }
  }

  // Check partial region constraints
  for (const region of puzzle.regions) {
    if (!checkRegionConstraint(region, placements, true)) {
      errors.push(`Region constraint violated: ${region.constraint.type}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Get hint for a specific cell
export function getHintForCell(
  puzzle: PuzzleData,
  solution: PuzzleSolution,
  cell: Cell
): PlacedDomino | null {
  const targetKey = cellKey(cell);

  for (const placement of solution.placements) {
    const [c1, c2] = placement.cells;
    if (cellKey(c1) === targetKey || cellKey(c2) === targetKey) {
      return placement;
    }
  }

  return null;
}
