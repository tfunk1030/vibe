import { create } from 'zustand';
import {
  PuzzleData,
  PuzzleSolution,
  PlacedDomino,
  Cell,
  SolveMode,
  Domino,
  Region,
  RegionConstraint,
  cellKey,
  dominoId,
  REGION_COLORS,
} from '../types/puzzle';

export type GridEditMode = 'none' | 'addCell' | 'removeCell' | 'assignRegion' | 'paintBucket';

interface PuzzleStore {
  // Puzzle state
  puzzle: PuzzleData | null;
  solution: PuzzleSolution | null;
  currentPlacements: PlacedDomino[];
  solveMode: SolveMode;
  stepIndex: number;
  selectedCell: Cell | null;
  isLoading: boolean;
  error: string | null;
  imageUri: string | null;
  isEditMode: boolean;
  editingDominoIndex: number | null;
  editingRegionId: string | null;
  gridEditMode: GridEditMode;
  selectedRegionForAssign: string | null;
  // Saved puzzle tracking
  currentSavedPuzzleId: string | null;
  currentSavedPuzzleName: string | null;

  // Actions
  setPuzzle: (puzzle: PuzzleData | null) => void;
  setSolution: (solution: PuzzleSolution | null) => void;
  setCurrentPlacements: (placements: PlacedDomino[]) => void;
  addPlacement: (placement: PlacedDomino) => void;
  removePlacement: (placement: PlacedDomino) => void;
  setSolveMode: (mode: SolveMode) => void;
  setStepIndex: (index: number) => void;
  incrementStep: () => void;
  setSelectedCell: (cell: Cell | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setImageUri: (uri: string | null) => void;
  setEditMode: (editing: boolean) => void;
  setEditingDominoIndex: (index: number | null) => void;
  setEditingRegionId: (regionId: string | null) => void;
  setGridEditMode: (mode: GridEditMode) => void;
  setSelectedRegionForAssign: (regionId: string | null) => void;
  setCurrentSavedPuzzle: (id: string | null, name: string | null) => void;
  reset: () => void;

  // Edit actions
  updateRegionConstraint: (regionId: string, constraint: RegionConstraint) => void;
  updateDomino: (index: number, pips: [number, number]) => void;
  addDomino: (pips: [number, number]) => void;
  removeDomino: (index: number) => void;
  addCell: (cell: Cell, regionId: string) => void;
  removeCell: (cell: Cell) => void;
  clearSolution: () => void;

  // Grid editing actions
  addRegion: (constraint: RegionConstraint) => void;
  removeRegion: (regionId: string) => void;
  moveCellToRegion: (cell: Cell, targetRegionId: string) => void;
  updateGridSize: (width: number, height: number) => void;
  toggleCellInGrid: (cell: Cell) => void;
  floodFillRegion: (startCell: Cell, targetRegionId: string) => void;
}

const initialState = {
  puzzle: null as PuzzleData | null,
  solution: null as PuzzleSolution | null,
  currentPlacements: [] as PlacedDomino[],
  solveMode: 'full' as SolveMode,
  stepIndex: 0,
  selectedCell: null as Cell | null,
  isLoading: false,
  error: null as string | null,
  imageUri: null as string | null,
  isEditMode: false,
  editingDominoIndex: null as number | null,
  editingRegionId: null as string | null,
  gridEditMode: 'none' as GridEditMode,
  selectedRegionForAssign: null as string | null,
  currentSavedPuzzleId: null as string | null,
  currentSavedPuzzleName: null as string | null,
};

export const usePuzzleStore = create<PuzzleStore>((set, get) => ({
  ...initialState,

  setPuzzle: (puzzle) => set({ puzzle, currentPlacements: [], stepIndex: 0, solution: null }),
  setSolution: (solution) => set({ solution }),
  setCurrentPlacements: (placements) => set({ currentPlacements: placements }),
  addPlacement: (placement) =>
    set((state) => ({
      currentPlacements: [...state.currentPlacements, placement],
    })),
  removePlacement: (placement) =>
    set((state) => ({
      currentPlacements: state.currentPlacements.filter(
        (p) => p.domino.id !== placement.domino.id
      ),
    })),
  setSolveMode: (mode) => set({ solveMode: mode, stepIndex: 0, currentPlacements: [] }),
  setStepIndex: (index) => set({ stepIndex: index }),
  incrementStep: () => {
    const { stepIndex, solution } = get();
    if (solution && stepIndex < solution.placements.length) {
      set({
        stepIndex: stepIndex + 1,
        currentPlacements: solution.placements.slice(0, stepIndex + 1),
      });
    }
  },
  setSelectedCell: (cell) => set({ selectedCell: cell }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setImageUri: (uri) => set({ imageUri: uri }),
  setEditMode: (editing) => set({
    isEditMode: editing,
    editingDominoIndex: null,
    editingRegionId: null,
    gridEditMode: 'none',
    selectedRegionForAssign: null,
  }),
  setEditingDominoIndex: (index) => set({ editingDominoIndex: index }),
  setEditingRegionId: (regionId) => set({ editingRegionId: regionId }),
  setGridEditMode: (mode) => set({ gridEditMode: mode }),
  setSelectedRegionForAssign: (regionId) => set({ selectedRegionForAssign: regionId }),
  setCurrentSavedPuzzle: (id, name) => set({ currentSavedPuzzleId: id, currentSavedPuzzleName: name }),
  reset: () => set(initialState),

  clearSolution: () => set({ solution: null, currentPlacements: [], stepIndex: 0 }),

  updateRegionConstraint: (regionId, constraint) => {
    const { puzzle } = get();
    if (!puzzle) return;

    const updatedRegions = puzzle.regions.map((region) =>
      region.id === regionId ? { ...region, constraint } : region
    );

    set({
      puzzle: { ...puzzle, regions: updatedRegions },
      solution: null,
      currentPlacements: [],
    });
  },

  updateDomino: (index, pips) => {
    const { puzzle } = get();
    if (!puzzle || index < 0 || index >= puzzle.availableDominoes.length) return;

    const updatedDominoes = [...puzzle.availableDominoes];
    updatedDominoes[index] = {
      id: dominoId(pips),
      pips,
    };

    set({
      puzzle: { ...puzzle, availableDominoes: updatedDominoes },
      solution: null,
      currentPlacements: [],
      editingDominoIndex: null,
    });
  },

  addDomino: (pips) => {
    const { puzzle } = get();
    if (!puzzle) return;

    const newDomino: Domino = {
      id: dominoId(pips),
      pips,
    };

    set({
      puzzle: {
        ...puzzle,
        availableDominoes: [...puzzle.availableDominoes, newDomino],
      },
      solution: null,
      currentPlacements: [],
    });
  },

  removeDomino: (index) => {
    const { puzzle } = get();
    if (!puzzle || index < 0 || index >= puzzle.availableDominoes.length) return;

    const updatedDominoes = puzzle.availableDominoes.filter((_, i) => i !== index);

    set({
      puzzle: { ...puzzle, availableDominoes: updatedDominoes },
      solution: null,
      currentPlacements: [],
      editingDominoIndex: null,
    });
  },

  addCell: (cell, regionId) => {
    const { puzzle } = get();
    if (!puzzle) return;

    // Check if cell already exists
    const key = cellKey(cell);
    if (puzzle.validCells.some((c) => cellKey(c) === key)) return;

    const updatedValidCells = [...puzzle.validCells, cell];
    const updatedRegions = puzzle.regions.map((region) =>
      region.id === regionId
        ? { ...region, cells: [...region.cells, cell] }
        : region
    );

    // Update dimensions if needed
    const newWidth = Math.max(puzzle.width, cell.col + 1);
    const newHeight = Math.max(puzzle.height, cell.row + 1);

    set({
      puzzle: {
        ...puzzle,
        validCells: updatedValidCells,
        regions: updatedRegions,
        width: newWidth,
        height: newHeight,
      },
      solution: null,
      currentPlacements: [],
    });
  },

  removeCell: (cell) => {
    const { puzzle } = get();
    if (!puzzle) return;

    const key = cellKey(cell);
    const updatedValidCells = puzzle.validCells.filter((c) => cellKey(c) !== key);
    const updatedRegions = puzzle.regions.map((region) => ({
      ...region,
      cells: region.cells.filter((c) => cellKey(c) !== key),
    }));

    set({
      puzzle: {
        ...puzzle,
        validCells: updatedValidCells,
        regions: updatedRegions,
      },
      solution: null,
      currentPlacements: [],
    });
  },

  addRegion: (constraint) => {
    const { puzzle } = get();
    if (!puzzle) return;

    const newRegionId = `region-${Date.now()}`;
    const colorIndex = puzzle.regions.length % REGION_COLORS.length;

    const newRegion: Region = {
      id: newRegionId,
      cells: [],
      color: REGION_COLORS[colorIndex],
      constraint,
    };

    set({
      puzzle: {
        ...puzzle,
        regions: [...puzzle.regions, newRegion],
      },
      solution: null,
      currentPlacements: [],
      selectedRegionForAssign: newRegionId,
    });
  },

  removeRegion: (regionId) => {
    const { puzzle } = get();
    if (!puzzle) return;

    const regionToRemove = puzzle.regions.find((r) => r.id === regionId);
    if (!regionToRemove) return;

    // Remove cells from validCells that were in this region
    const cellsToRemove = new Set(regionToRemove.cells.map(cellKey));
    const updatedValidCells = puzzle.validCells.filter(
      (c) => !cellsToRemove.has(cellKey(c))
    );

    const updatedRegions = puzzle.regions.filter((r) => r.id !== regionId);

    set({
      puzzle: {
        ...puzzle,
        validCells: updatedValidCells,
        regions: updatedRegions,
      },
      solution: null,
      currentPlacements: [],
      editingRegionId: null,
    });
  },

  moveCellToRegion: (cell, targetRegionId) => {
    const { puzzle } = get();
    if (!puzzle) return;

    const key = cellKey(cell);

    // Remove cell from all regions first
    const updatedRegions = puzzle.regions.map((region) => ({
      ...region,
      cells: region.cells.filter((c) => cellKey(c) !== key),
    }));

    // Add cell to target region
    const finalRegions = updatedRegions.map((region) =>
      region.id === targetRegionId
        ? { ...region, cells: [...region.cells, cell] }
        : region
    );

    // Ensure cell is in validCells
    const isInValidCells = puzzle.validCells.some((c) => cellKey(c) === key);
    const updatedValidCells = isInValidCells
      ? puzzle.validCells
      : [...puzzle.validCells, cell];

    set({
      puzzle: {
        ...puzzle,
        validCells: updatedValidCells,
        regions: finalRegions,
      },
      solution: null,
      currentPlacements: [],
    });
  },

  updateGridSize: (width, height) => {
    const { puzzle } = get();
    if (!puzzle) return;

    // Filter out cells that are outside new bounds
    const updatedValidCells = puzzle.validCells.filter(
      (c) => c.col < width && c.row < height
    );

    const updatedRegions = puzzle.regions.map((region) => ({
      ...region,
      cells: region.cells.filter((c) => c.col < width && c.row < height),
    }));

    set({
      puzzle: {
        ...puzzle,
        width,
        height,
        validCells: updatedValidCells,
        regions: updatedRegions,
      },
      solution: null,
      currentPlacements: [],
    });
  },

  toggleCellInGrid: (cell) => {
    const { puzzle, selectedRegionForAssign } = get();
    if (!puzzle) return;

    const key = cellKey(cell);
    const exists = puzzle.validCells.some((c) => cellKey(c) === key);

    if (exists) {
      // Remove cell
      const updatedValidCells = puzzle.validCells.filter((c) => cellKey(c) !== key);
      const updatedRegions = puzzle.regions.map((region) => ({
        ...region,
        cells: region.cells.filter((c) => cellKey(c) !== key),
      }));

      set({
        puzzle: {
          ...puzzle,
          validCells: updatedValidCells,
          regions: updatedRegions,
        },
        solution: null,
        currentPlacements: [],
      });
    } else {
      // Add cell to selected region or first region
      const targetRegionId = selectedRegionForAssign || puzzle.regions[0]?.id;
      if (!targetRegionId) return;

      const updatedValidCells = [...puzzle.validCells, cell];
      const updatedRegions = puzzle.regions.map((region) =>
        region.id === targetRegionId
          ? { ...region, cells: [...region.cells, cell] }
          : region
      );

      // Update dimensions if needed
      const newWidth = Math.max(puzzle.width, cell.col + 1);
      const newHeight = Math.max(puzzle.height, cell.row + 1);

      set({
        puzzle: {
          ...puzzle,
          validCells: updatedValidCells,
          regions: updatedRegions,
          width: newWidth,
          height: newHeight,
        },
        solution: null,
        currentPlacements: [],
      });
    }
  },

  floodFillRegion: (startCell, targetRegionId) => {
    const { puzzle } = get();
    if (!puzzle) return;

    // Find the current region of the start cell
    const startKey = cellKey(startCell);
    let sourceRegionId: string | null = null;
    for (const region of puzzle.regions) {
      if (region.cells.some(c => cellKey(c) === startKey)) {
        sourceRegionId = region.id;
        break;
      }
    }

    // If start cell is not in any region or same as target, do nothing
    if (!sourceRegionId || sourceRegionId === targetRegionId) return;

    // Build adjacency map for valid cells
    const validCellSet = new Set(puzzle.validCells.map(cellKey));
    const getAdjacentCells = (cell: Cell): Cell[] => {
      const adjacent: Cell[] = [
        { row: cell.row - 1, col: cell.col },
        { row: cell.row + 1, col: cell.col },
        { row: cell.row, col: cell.col - 1 },
        { row: cell.row, col: cell.col + 1 },
      ];
      return adjacent.filter(c => validCellSet.has(cellKey(c)));
    };

    // Get all cells in the source region
    const sourceRegion = puzzle.regions.find(r => r.id === sourceRegionId);
    if (!sourceRegion) return;
    const sourceCellKeys = new Set(sourceRegion.cells.map(cellKey));

    // Flood fill to find connected cells in the same region
    const visited = new Set<string>();
    const toFill: Cell[] = [];
    const queue: Cell[] = [startCell];

    while (queue.length > 0) {
      const cell = queue.shift()!;
      const key = cellKey(cell);

      if (visited.has(key)) continue;
      visited.add(key);

      // Only process cells in the source region
      if (!sourceCellKeys.has(key)) continue;

      toFill.push(cell);

      // Add adjacent cells to queue
      for (const adjacent of getAdjacentCells(cell)) {
        const adjKey = cellKey(adjacent);
        if (!visited.has(adjKey) && sourceCellKeys.has(adjKey)) {
          queue.push(adjacent);
        }
      }
    }

    if (toFill.length === 0) return;

    // Move all connected cells to the target region
    const toFillKeys = new Set(toFill.map(cellKey));
    const updatedRegions = puzzle.regions.map((region) => {
      if (region.id === sourceRegionId) {
        // Remove filled cells from source region
        return {
          ...region,
          cells: region.cells.filter(c => !toFillKeys.has(cellKey(c))),
        };
      } else if (region.id === targetRegionId) {
        // Add filled cells to target region
        return {
          ...region,
          cells: [...region.cells, ...toFill],
        };
      }
      return region;
    });

    set({
      puzzle: {
        ...puzzle,
        regions: updatedRegions,
      },
      solution: null,
      currentPlacements: [],
    });
  },
}));
