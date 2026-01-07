// Pips Solver Types

export interface Cell {
  row: number;
  col: number;
}

export interface Domino {
  id: string;
  pips: [number, number]; // e.g., [3, 5] for a 3-5 domino
}

export type ConstraintType =
  | 'sum' // Sum equals X
  | 'equal' // All pips equal
  | 'different' // All pips different
  | 'greater' // All pips greater than X
  | 'less' // All pips less than X
  | 'any'; // No constraint - any value allowed

export interface RegionConstraint {
  type: ConstraintType;
  value?: number; // For sum, greater, less constraints
}

export interface Region {
  id: string;
  cells: Cell[];
  color: string;
  constraint: RegionConstraint;
}

export interface PlacedDomino {
  domino: Domino;
  cells: [Cell, Cell]; // The two cells this domino occupies
}

export interface PuzzleData {
  // Grid dimensions (for bounding box)
  width: number;
  height: number;
  // All valid cells (may not be rectangular)
  validCells: Cell[];
  // Regions with their constraints
  regions: Region[];
  // Available dominoes
  availableDominoes: Domino[];
  // Blocked/invalid cells
  blockedCells: Cell[];
}

export interface PuzzleSolution {
  placements: PlacedDomino[];
  isValid: boolean;
  error?: string;
}

export type SolveMode = 'full' | 'hint' | 'step' | 'verify';

export interface PuzzleState {
  puzzle: PuzzleData | null;
  solution: PuzzleSolution | null;
  currentPlacements: PlacedDomino[];
  solveMode: SolveMode;
  stepIndex: number;
  selectedCell: Cell | null;
  isLoading: boolean;
  error: string | null;
}

// Helper to create a cell key for maps/sets
export function cellKey(cell: Cell): string {
  return `${cell.row},${cell.col}`;
}

// Helper to parse cell key
export function parseCell(key: string): Cell {
  const [row, col] = key.split(',').map(Number);
  return { row, col };
}

// Helper to create domino ID
export function dominoId(pips: [number, number]): string {
  const sorted = [...pips].sort((a, b) => a - b);
  return `${sorted[0]}-${sorted[1]}`;
}

// Check if two cells are adjacent
export function areCellsAdjacent(a: Cell, b: Cell): boolean {
  const rowDiff = Math.abs(a.row - b.row);
  const colDiff = Math.abs(a.col - b.col);
  return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
}

// Region colors for visual distinction - more vibrant and distinct
export const REGION_COLORS = [
  '#E53935', // Vivid Red
  '#1E88E5', // Strong Blue
  '#43A047', // Forest Green
  '#FB8C00', // Bright Orange
  '#8E24AA', // Deep Purple
  '#00ACC1', // Cyan
  '#FFB300', // Amber
  '#D81B60', // Pink/Magenta
  '#5E35B1', // Indigo
  '#00897B', // Teal
  '#C0CA33', // Lime
  '#6D4C41', // Brown
];

// Constraint display helpers
export function constraintLabel(constraint: RegionConstraint): string {
  switch (constraint.type) {
    case 'sum':
      return `Σ${constraint.value}`;
    case 'equal':
      return '=';
    case 'different':
      return '≠';
    case 'greater':
      return `>${constraint.value}`;
    case 'less':
      return `<${constraint.value}`;
    case 'any':
      return '*';
    default:
      return '';
  }
}
