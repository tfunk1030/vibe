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
      return pips.every((p) => p > (constraint.value ?? 0));
    case 'less':
      return pips.every((p) => p < (constraint.value ?? 7));
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
      return pips.every((p) => p > (constraint.value ?? 0));
    case 'less':
      return pips.every((p) => p < (constraint.value ?? 7));
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
  validCellSet: Set<string>
): Cell | null {
  let bestCell: Cell | null = null;
  let minNeighbors = Infinity;

  for (const cell of validCells) {
    if (coveredCells.has(cellKey(cell))) continue;

    const neighbors = getAdjacentCells(cell, validCellSet);
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

// Main solver using backtracking
function solve(
  puzzle: PuzzleData,
  validCellSet: Set<string>,
  placements: PlacedDomino[],
  usedDominoes: Set<number>,
  regionsToCheck: Region[]
): PlacedDomino[] | null {
  const coveredCells = getCoveredCells(placements);

  // Find best uncovered cell (MRV heuristic)
  const uncoveredCell = findBestUncoveredCell(puzzle.validCells, coveredCells, validCellSet);

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
  const neighbors = getAdjacentCells(uncoveredCell, validCellSet);
  const uncoveredNeighbors = neighbors.filter(n => !coveredCells.has(cellKey(n)));

  // If no uncovered neighbors, this path is impossible
  if (uncoveredNeighbors.length === 0) {
    return null;
  }

  // Try each neighbor cell
  for (const neighborCell of uncoveredNeighbors) {
    // Try each available domino
    for (let i = 0; i < puzzle.availableDominoes.length; i++) {
      if (usedDominoes.has(i)) continue;

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

        if (valid) {
          const result = solve(puzzle, validCellSet, newPlacements, newUsed, regionsToCheck);
          if (result) {
            return result;
          }
        }
      }
    }
  }

  return null;
}

export function solvePuzzle(puzzle: PuzzleData): PuzzleSolution {
  console.log('[Solver] Starting solve...', {
    cells: puzzle.validCells.length,
    dominoes: puzzle.availableDominoes.length,
    regions: puzzle.regions.length,
  });

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

  // validCellSet is already defined above for island detection, reuse it
  try {
    const result = solve(puzzle, validCellSet, [], new Set(), regionsToCheck);

    if (result) {
      console.log('[Solver] Solution found with', result.length, 'placements');
      return {
        placements: result,
        isValid: true,
      };
    } else {
      console.log('[Solver] No solution found');

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
