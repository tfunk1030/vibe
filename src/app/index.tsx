import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  Image,
  Modal,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { colors, sizing, spacing, typography } from '@/theme/tokens';
import { useMutation } from '@tanstack/react-query';
import {
  Play,
  RotateCcw,
  ChevronRight,
  Pencil,
  Check,
  RefreshCw,
  Save,
  FolderOpen,
  Trash2,
  X,
  ZoomIn,
  Home,
} from 'lucide-react-native';

import { useColorScheme } from '@/lib/useColorScheme';
import { usePuzzleStore, GridEditMode } from '@/lib/state/puzzle-store';
import { extractPuzzleFromImage, extractPuzzleFromDualImages, extractMultiIslandPuzzle, createSamplePuzzle, createLShapedPuzzle, GridSizeHint, ExtractionStage } from '@/lib/services/gemini';
import { solvePuzzle, getHintForCell, verifyPartialSolution } from '@/lib/services/solver';
import { PuzzleGrid } from '@/components/PuzzleGrid';
import { DominoTray } from '@/components/DominoTray';
import { SolveModeSelector } from '@/components/SolveModeSelector';
import { DominoEditor } from '@/components/DominoEditor';
import { RegionEditor } from '@/components/RegionEditor';
import { GridSizeEditor } from '@/components/GridSizeEditor';
import { EditToolbar } from '@/components/EditToolbar';
import { SavePuzzleModal } from '@/components/SavePuzzleModal';
import { GridSizeHintModal } from '@/components/GridSizeHintModal';
import { DualImageCropper } from '@/components/DualImageCropper';
import { IslandConfigModal } from '@/components/IslandConfigModal';
import { PuzzleSetupWizard } from '@/components/PuzzleSetupWizard';
import { ActionButton } from '@/components/ActionButton';
import { ExtractionProgress } from '@/components/ExtractionProgress';
import { EmptyPuzzleState } from '@/components/EmptyPuzzleState';
import { useSavedPuzzlesStore } from '@/lib/state/saved-puzzles-store';
import { Cell, SolveMode, RegionConstraint, IslandConfig } from '@/lib/types/puzzle';

interface ExtractionParams {
  imageUri: string;
  sizeHint?: GridSizeHint;
}

interface DualExtractionParams {
  dominoImageUri: string;
  gridImageUri: string;
  sizeHint?: GridSizeHint;
}

interface MultiIslandExtractionParams {
  dominoImageUri: string;
  gridImageUris: string[];
  islandConfigs: IslandConfig[];
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  // Local state for editors
  const [showDominoEditor, setShowDominoEditor] = useState(false);
  const [isAddingDomino, setIsAddingDomino] = useState(false);
  const [showRegionEditor, setShowRegionEditor] = useState(false);
  const [showGridSizeEditor, setShowGridSizeEditor] = useState(false);
  const [isAddingRegion, setIsAddingRegion] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [isRemoveCellMode, setIsRemoveCellMode] = useState(false);
  const [isPaintBucketMode, setIsPaintBucketMode] = useState(false);
  const [showReferenceImage, setShowReferenceImage] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSizeHintModal, setShowSizeHintModal] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [showDualCropper, setShowDualCropper] = useState(false);
  const [pendingSizeHint, setPendingSizeHint] = useState<GridSizeHint | null>(null);
  const [extractionStage, setExtractionStage] = useState<
    'idle' | 'cropping' | 'dominoes' | 'grid' | 'solving'
  >('idle');

  // Multi-island state
  const [showIslandModeChoice, setShowIslandModeChoice] = useState(false);
  const [showIslandConfigModal, setShowIslandConfigModal] = useState(false);
  const [islandConfigs, setIslandConfigs] = useState<IslandConfig[]>([]);
  const [isMultiIslandMode, setIsMultiIslandMode] = useState(false);

  // New unified wizard
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  // Store state
  const puzzle = usePuzzleStore((s) => s.puzzle);
  const solution = usePuzzleStore((s) => s.solution);
  const currentPlacements = usePuzzleStore((s) => s.currentPlacements);
  const solveMode = usePuzzleStore((s) => s.solveMode);
  const stepIndex = usePuzzleStore((s) => s.stepIndex);
  const selectedCell = usePuzzleStore((s) => s.selectedCell);
  const isLoading = usePuzzleStore((s) => s.isLoading);
  const error = usePuzzleStore((s) => s.error);
  const isEditMode = usePuzzleStore((s) => s.isEditMode);
  const editingDominoIndex = usePuzzleStore((s) => s.editingDominoIndex);
  const editingRegionId = usePuzzleStore((s) => s.editingRegionId);
  const gridEditMode = usePuzzleStore((s) => s.gridEditMode);
  const selectedRegionForAssign = usePuzzleStore((s) => s.selectedRegionForAssign);
  const currentSavedPuzzleId = usePuzzleStore((s) => s.currentSavedPuzzleId);
  const currentSavedPuzzleName = usePuzzleStore((s) => s.currentSavedPuzzleName);
  const imageUri = usePuzzleStore((s) => s.imageUri);

  // Store actions
  const setPuzzle = usePuzzleStore((s) => s.setPuzzle);
  const setSolution = usePuzzleStore((s) => s.setSolution);
  const setCurrentPlacements = usePuzzleStore((s) => s.setCurrentPlacements);
  const setSolveMode = usePuzzleStore((s) => s.setSolveMode);
  const incrementStep = usePuzzleStore((s) => s.incrementStep);
  const setSelectedCell = usePuzzleStore((s) => s.setSelectedCell);
  const setLoading = usePuzzleStore((s) => s.setLoading);
  const setError = usePuzzleStore((s) => s.setError);
  const reset = usePuzzleStore((s) => s.reset);
  const setEditMode = usePuzzleStore((s) => s.setEditMode);
  const setEditingDominoIndex = usePuzzleStore((s) => s.setEditingDominoIndex);
  const setEditingRegionId = usePuzzleStore((s) => s.setEditingRegionId);
  const setGridEditMode = usePuzzleStore((s) => s.setGridEditMode);
  const setSelectedRegionForAssign = usePuzzleStore((s) => s.setSelectedRegionForAssign);
  const updateDomino = usePuzzleStore((s) => s.updateDomino);
  const addDomino = usePuzzleStore((s) => s.addDomino);
  const removeDomino = usePuzzleStore((s) => s.removeDomino);
  const clearSolution = usePuzzleStore((s) => s.clearSolution);
  const updateRegionConstraint = usePuzzleStore((s) => s.updateRegionConstraint);
  const addRegion = usePuzzleStore((s) => s.addRegion);
  const removeRegion = usePuzzleStore((s) => s.removeRegion);
  const updateGridSize = usePuzzleStore((s) => s.updateGridSize);
  const toggleCellInGrid = usePuzzleStore((s) => s.toggleCellInGrid);
  const moveCellToRegion = usePuzzleStore((s) => s.moveCellToRegion);
  const removeCell = usePuzzleStore((s) => s.removeCell);
  const floodFillRegion = usePuzzleStore((s) => s.floodFillRegion);
  const setCurrentSavedPuzzle = usePuzzleStore((s) => s.setCurrentSavedPuzzle);
  const setImageUri = usePuzzleStore((s) => s.setImageUri);

  // Undo/Redo
  const canUndo = usePuzzleStore((s) => s.canUndo);
  const canRedo = usePuzzleStore((s) => s.canRedo);
  const undo = usePuzzleStore((s) => s.undo);
  const redo = usePuzzleStore((s) => s.redo);
  const pushToHistory = usePuzzleStore((s) => s.pushToHistory);

  // Saved puzzles store
  const savePuzzle = useSavedPuzzlesStore((s) => s.savePuzzle);
  const updateSavedPuzzle = useSavedPuzzlesStore((s) => s.updatePuzzle);
  const loadSavedPuzzles = useSavedPuzzlesStore((s) => s.loadPuzzles);

  // Extract puzzle mutation
  const extractMutation = useMutation({
    mutationFn: (params: ExtractionParams) =>
      extractPuzzleFromImage(params.imageUri, params.sizeHint),
    onMutate: () => {
      setLoading(true);
      setError(null);
    },
    onSuccess: (puzzleData) => {
      setPuzzle(puzzleData);
      // Auto-solve
      const sol = solvePuzzle(puzzleData);
      setSolution(sol);
      if (!sol.isValid) {
        setError(sol.error || 'Could not solve puzzle - try editing the puzzle data');
      }
      setLoading(false);
    },
    onError: (err: Error) => {
      setError(err.message);
      setLoading(false);
    },
  });

  const { mutate: extractPuzzle } = extractMutation;

  // Dual extraction mutation (separate domino and grid images)
  const dualExtractMutation = useMutation({
    mutationFn: (params: DualExtractionParams) =>
      extractPuzzleFromDualImages(
        params.dominoImageUri,
        params.gridImageUri,
        params.sizeHint,
        (stage) => setExtractionStage(stage)
      ),
    onMutate: () => {
      setLoading(true);
      setError(null);
      setExtractionStage('idle');
    },
    onSuccess: (puzzleData) => {
      setExtractionStage('solving');
      setPuzzle(puzzleData);
      // Auto-solve
      const sol = solvePuzzle(puzzleData);
      setSolution(sol);
      if (!sol.isValid) {
        setError(sol.error || 'Could not solve puzzle - try editing the puzzle data');
      }
      setLoading(false);
      setExtractionStage('idle');
    },
    onError: (err: Error) => {
      setError(err.message);
      setLoading(false);
      setExtractionStage('idle');
    },
  });

  const { mutate: extractDualPuzzle } = dualExtractMutation;

  // Multi-island extraction mutation
  const multiIslandExtractMutation = useMutation({
    mutationFn: (params: MultiIslandExtractionParams) =>
      extractMultiIslandPuzzle(
        params.dominoImageUri,
        params.gridImageUris,
        params.islandConfigs,
        (stage, islandIndex) => setExtractionStage(stage)
      ),
    onMutate: () => {
      setLoading(true);
      setError(null);
      setExtractionStage('idle');
    },
    onSuccess: (puzzleData) => {
      setExtractionStage('solving');
      setPuzzle(puzzleData);
      // Auto-solve
      const sol = solvePuzzle(puzzleData);
      setSolution(sol);
      if (!sol.isValid) {
        setError(sol.error || 'Could not solve puzzle - try editing the puzzle data');
      }
      setLoading(false);
      setExtractionStage('idle');
      setIsMultiIslandMode(false);
      setIslandConfigs([]);
    },
    onError: (err: Error) => {
      setError(err.message);
      setLoading(false);
      setExtractionStage('idle');
    },
  });

  const { mutate: extractMultiIsland } = multiIslandExtractMutation;

  // Pick image from library - now uses unified wizard
  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPendingImageUri(result.assets[0].uri);
      setImageUri(result.assets[0].uri);
      // Show new unified wizard instead of multiple modals
      setShowSetupWizard(true);
    }
  }, [setImageUri]);

  // Handle wizard completion (single grid)
  const handleWizardComplete = useCallback(
    (dominoUri: string, gridUri: string, sizeHint?: GridSizeHint) => {
      setShowSetupWizard(false);
      extractDualPuzzle({
        dominoImageUri: dominoUri,
        gridImageUri: gridUri,
        sizeHint: sizeHint,
      });
      setPendingImageUri(null);
    },
    [extractDualPuzzle]
  );

  // Handle wizard completion (multi-island)
  const handleWizardCompleteMulti = useCallback(
    (dominoUri: string, gridUris: string[], configs: IslandConfig[]) => {
      setShowSetupWizard(false);
      extractMultiIsland({
        dominoImageUri: dominoUri,
        gridImageUris: gridUris,
        islandConfigs: configs,
      });
      setPendingImageUri(null);
    },
    [extractMultiIsland]
  );

  // Handle wizard close
  const handleWizardClose = useCallback(() => {
    setShowSetupWizard(false);
    setPendingImageUri(null);
  }, []);

  // Handle island mode choice
  const handleSingleIsland = useCallback(() => {
    setShowIslandModeChoice(false);
    setIsMultiIslandMode(false);
    setShowSizeHintModal(true);
  }, []);

  const handleMultipleIslands = useCallback(() => {
    setShowIslandModeChoice(false);
    setIsMultiIslandMode(true);
    setShowIslandConfigModal(true);
  }, []);

  // Handle island config confirm
  const handleIslandConfigConfirm = useCallback((configs: IslandConfig[]) => {
    setShowIslandConfigModal(false);
    setIslandConfigs(configs);
    setShowDualCropper(true);
  }, []);

  // Handle size hint confirm - now opens dual cropper
  const handleSizeHintConfirm = useCallback(
    (cols: number, rows: number, dominoCount: number) => {
      if (pendingImageUri) {
        setShowSizeHintModal(false);
        setPendingSizeHint({ cols, rows, dominoCount });
        setShowDualCropper(true);
      }
    },
    [pendingImageUri]
  );

  // Handle size hint skip - now opens dual cropper without hints
  const handleSizeHintSkip = useCallback(() => {
    if (pendingImageUri) {
      setShowSizeHintModal(false);
      setPendingSizeHint(null);
      setShowDualCropper(true);
    }
  }, [pendingImageUri]);

  // Handle size hint close
  const handleSizeHintClose = useCallback(() => {
    setShowSizeHintModal(false);
    setPendingImageUri(null);
    setPendingSizeHint(null);
  }, []);

  // Handle dual cropper complete (single island)
  const handleDualCropperComplete = useCallback(
    (dominoUri: string, gridUri: string) => {
      setShowDualCropper(false);
      extractDualPuzzle({
        dominoImageUri: dominoUri,
        gridImageUri: gridUri,
        sizeHint: pendingSizeHint ?? undefined,
      });
      setPendingImageUri(null);
      setPendingSizeHint(null);
    },
    [extractDualPuzzle, pendingSizeHint]
  );

  // Handle multi-island cropper complete
  const handleMultiIslandCropperComplete = useCallback(
    (dominoUri: string, gridUris: string[]) => {
      setShowDualCropper(false);
      extractMultiIsland({
        dominoImageUri: dominoUri,
        gridImageUris: gridUris,
        islandConfigs: islandConfigs,
      });
      setPendingImageUri(null);
      setPendingSizeHint(null);
    },
    [extractMultiIsland, islandConfigs]
  );

  // Handle dual cropper close
  const handleDualCropperClose = useCallback(() => {
    setShowDualCropper(false);
    setPendingImageUri(null);
    setPendingSizeHint(null);
    setIsMultiIslandMode(false);
    setIslandConfigs([]);
  }, []);

  // Use L-shaped puzzle for testing
  const handleUseLShapedPuzzle = useCallback(() => {
    setLoading(false); // Clear any loading state
    setError(null);
    const lPuzzle = createLShapedPuzzle();
    setPuzzle(lPuzzle);
    setCurrentSavedPuzzle(null, null);
    const sol = solvePuzzle(lPuzzle);
    setSolution(sol);
    if (!sol.isValid) {
      setError(sol.error || 'Could not solve puzzle');
    }
  }, [setPuzzle, setSolution, setError, setCurrentSavedPuzzle, setLoading]);

  // Use sample puzzle for demo
  const handleUseSample = useCallback(() => {
    const samplePuzzle = createSamplePuzzle();
    setPuzzle(samplePuzzle);
    setCurrentSavedPuzzle(null, null);
    const sol = solvePuzzle(samplePuzzle);
    setSolution(sol);
    if (!sol.isValid) {
      setError(sol.error || 'Could not solve puzzle');
    }
  }, [setPuzzle, setSolution, setError, setCurrentSavedPuzzle]);

  // Load saved puzzles on mount
  React.useEffect(() => {
    loadSavedPuzzles();
  }, [loadSavedPuzzles]);

  // Handle save puzzle
  const handleSavePuzzle = useCallback(
    async (name: string) => {
      if (!puzzle) return;

      if (currentSavedPuzzleId) {
        // Update existing puzzle
        await updateSavedPuzzle(currentSavedPuzzleId, puzzle, name);
        setCurrentSavedPuzzle(currentSavedPuzzleId, name);
      } else {
        // Save new puzzle
        const saved = await savePuzzle(name, puzzle);
        setCurrentSavedPuzzle(saved.id, saved.name);
      }
    },
    [puzzle, currentSavedPuzzleId, savePuzzle, updateSavedPuzzle, setCurrentSavedPuzzle]
  );

  // Navigate to saved puzzles
  const handleOpenSavedPuzzles = useCallback(() => {
    router.push('/saved');
  }, [router]);

  // Toggle edit mode
  const handleToggleEditMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isEditMode && puzzle?.regions?.[0]) {
      // When entering edit mode, select first region by default
      setSelectedRegionForAssign(puzzle.regions[0].id);
    }
    setIsRemoveCellMode(false);
    setEditMode(!isEditMode);
  }, [isEditMode, puzzle, setEditMode, setSelectedRegionForAssign]);

  // Re-solve puzzle after edits
  const handleReSolve = useCallback(() => {
    if (!puzzle) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditMode(false);
    const sol = solvePuzzle(puzzle);
    setSolution(sol);
    if (!sol.isValid) {
      setError(sol.error || 'Could not solve puzzle - check the puzzle data');
    } else {
      setError(null);
    }
  }, [puzzle, setEditMode, setSolution, setError]);

  // Handle clear all with confirmation in edit mode
  const handleClearAllPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isEditMode) {
      setShowClearConfirm(true);
    } else {
      reset();
    }
  }, [isEditMode, reset]);

  const handleConfirmClear = useCallback(() => {
    setShowClearConfirm(false);
    reset();
  }, [reset]);

  // Handle domino press in edit mode
  const handleDominoPress = useCallback(
    (index: number) => {
      setEditingDominoIndex(index);
      setIsAddingDomino(false);
      setShowDominoEditor(true);
    },
    [setEditingDominoIndex]
  );

  // Handle add domino
  const handleAddDomino = useCallback(() => {
    setIsAddingDomino(true);
    setEditingDominoIndex(null);
    setShowDominoEditor(true);
  }, [setEditingDominoIndex]);

  // Handle domino save
  const handleDominoSave = useCallback(
    (pips: [number, number]) => {
      pushToHistory(); // Save state before edit
      if (isAddingDomino) {
        addDomino(pips);
      } else if (editingDominoIndex !== null) {
        updateDomino(editingDominoIndex, pips);
      }
      setShowDominoEditor(false);
      clearSolution();
    },
    [isAddingDomino, editingDominoIndex, addDomino, updateDomino, clearSolution, pushToHistory]
  );

  // Handle domino delete
  const handleDominoDelete = useCallback(() => {
    pushToHistory(); // Save state before edit
    if (editingDominoIndex !== null) {
      removeDomino(editingDominoIndex);
    }
    setShowDominoEditor(false);
    clearSolution();
  }, [editingDominoIndex, removeDomino, clearSolution, pushToHistory]);

  // Handle region selection for assign mode
  const handleSelectRegion = useCallback(
    (regionId: string) => {
      setSelectedRegionForAssign(regionId);
    },
    [setSelectedRegionForAssign]
  );

  // Handle edit region (long press)
  const handleEditRegion = useCallback(
    (regionId: string) => {
      setEditingRegionId(regionId);
      setIsAddingRegion(false);
      setShowRegionEditor(true);
    },
    [setEditingRegionId]
  );

  // Handle add region
  const handleAddRegion = useCallback(() => {
    setIsAddingRegion(true);
    setEditingRegionId(null);
    setShowRegionEditor(true);
  }, [setEditingRegionId]);

  // Handle region save
  const handleRegionSave = useCallback(
    (constraint: RegionConstraint) => {
      pushToHistory(); // Save state before edit
      if (isAddingRegion) {
        addRegion(constraint);
      } else if (editingRegionId) {
        updateRegionConstraint(editingRegionId, constraint);
      }
      setShowRegionEditor(false);
      clearSolution();
    },
    [isAddingRegion, editingRegionId, addRegion, updateRegionConstraint, clearSolution, pushToHistory]
  );

  // Handle region delete
  const handleRegionDelete = useCallback(() => {
    pushToHistory(); // Save state before edit
    if (editingRegionId) {
      removeRegion(editingRegionId);
    }
    setShowRegionEditor(false);
    clearSolution();
  }, [editingRegionId, removeRegion, clearSolution, pushToHistory]);

  // Handle grid size
  const handleOpenGridSize = useCallback(() => {
    setShowGridSizeEditor(true);
  }, []);

  // Handle grid size save
  const handleGridSizeSave = useCallback(
    (width: number, height: number) => {
      pushToHistory(); // Save state before edit
      updateGridSize(width, height);
      clearSolution();
    },
    [updateGridSize, clearSolution, pushToHistory]
  );

  // Handle toggle grid edit mode - simplified, not used anymore
  const handleToggleGridEditMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Handle toggle remove cell mode
  const handleToggleRemoveCellMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRemoveCellMode((prev) => !prev);
    setIsPaintBucketMode(false); // Turn off paint bucket mode when enabling remove mode
  }, []);

  // Handle toggle paint bucket mode
  const handleTogglePaintBucketMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsPaintBucketMode((prev) => !prev);
    setIsRemoveCellMode(false); // Turn off remove mode when enabling paint bucket
  }, []);

  // Handle cell press in edit mode - assign to selected region OR remove if in remove mode
  const handleEditCellPress = useCallback(
    (cell: Cell) => {
      pushToHistory(); // Save state before edit
      if (isRemoveCellMode) {
        // Remove cell from grid
        removeCell(cell);
        clearSolution();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (isPaintBucketMode && selectedRegionForAssign) {
        // Flood fill connected cells with selected region
        floodFillRegion(cell, selectedRegionForAssign);
        clearSolution();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else if (selectedRegionForAssign) {
        moveCellToRegion(cell, selectedRegionForAssign);
        clearSolution();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [isRemoveCellMode, isPaintBucketMode, selectedRegionForAssign, removeCell, floodFillRegion, moveCellToRegion, clearSolution, pushToHistory]
  );

  // Handle empty cell press (for adding cells to selected region)
  const handleEmptyCellPress = useCallback(
    (cell: Cell) => {
      if (selectedRegionForAssign) {
        pushToHistory(); // Save state before edit
        // Add cell and assign to region
        toggleCellInGrid(cell);
        // Small delay to ensure cell exists before assigning region
        setTimeout(() => {
          moveCellToRegion(cell, selectedRegionForAssign);
        }, 10);
        clearSolution();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [selectedRegionForAssign, toggleCellInGrid, moveCellToRegion, clearSolution, pushToHistory]
  );

  // Handle region press on grid cell
  const handleRegionPressOnCell = useCallback(
    (regionId: string) => {
      handleEditRegion(regionId);
    },
    [handleEditRegion]
  );

  // Handle solve mode actions
  const handleSolve = useCallback(() => {
    if (!solution?.isValid) return;

    switch (solveMode) {
      case 'full':
        setCurrentPlacements(solution.placements);
        break;
      case 'step':
        incrementStep();
        break;
      case 'verify':
        if (puzzle) {
          const result = verifyPartialSolution(puzzle, currentPlacements);
          if (result.valid) {
            Alert.alert('Valid', 'Your current placements are correct!');
          } else {
            Alert.alert('Invalid', result.errors.join('\n'));
          }
        }
        break;
      case 'hint':
        // Hint mode works via cell selection
        break;
    }
  }, [solveMode, solution, puzzle, currentPlacements, setCurrentPlacements, incrementStep]);

  // Handle cell press
  const handleCellPress = useCallback(
    (cell: Cell) => {
      if (isEditMode) {
        handleEditCellPress(cell);
        return;
      }
      if (solveMode === 'hint' && solution?.isValid && puzzle) {
        const hint = getHintForCell(puzzle, solution, cell);
        if (hint) {
          // Add this domino to placements if not already there
          const existingIndex = currentPlacements.findIndex(
            (p) => p.domino.id === hint.domino.id
          );
          if (existingIndex === -1) {
            setCurrentPlacements([...currentPlacements, hint]);
          }
        }
      }
      setSelectedCell(cell);
    },
    [isEditMode, handleEditCellPress, solveMode, solution, puzzle, currentPlacements, setCurrentPlacements, setSelectedCell]
  );

  // Mode change
  const handleModeChange = useCallback(
    (mode: SolveMode) => {
      setSolveMode(mode);
      setCurrentPlacements([]);
    },
    [setSolveMode, setCurrentPlacements]
  );

  // Get action button label based on mode
  const actionLabel = useMemo(() => {
    switch (solveMode) {
      case 'full':
        return 'Show Solution';
      case 'step':
        return solution
          ? `Next (${stepIndex}/${solution.placements.length})`
          : 'Next';
      case 'hint':
        return 'Tap a cell';
      case 'verify':
        return 'Check';
    }
  }, [solveMode, stepIndex, solution]);

  const canTakeAction =
    solution?.isValid && (solveMode !== 'step' || stepIndex < (solution?.placements.length ?? 0));

  // Get editing domino pips
  const editingDominoPips: [number, number] | undefined = useMemo(() => {
    if (editingDominoIndex !== null && puzzle) {
      return puzzle.availableDominoes[editingDominoIndex]?.pips;
    }
    return undefined;
  }, [editingDominoIndex, puzzle]);

  // Get editing region
  const editingRegion = useMemo(() => {
    if (editingRegionId && puzzle) {
      return puzzle.regions.find((r) => r.id === editingRegionId) ?? null;
    }
    return null;
  }, [editingRegionId, puzzle]);

  return (
    <View style={[indexStyles.container, { backgroundColor: isDark ? colors.dark.background : colors.light.background }]}>
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View
            entering={FadeInDown.delay(100)}
            className="px-5 pt-4 pb-6"
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                {/* Back/Home Button - shown when puzzle is loaded */}
                {puzzle && (
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      reset();
                    }}
                    style={{
                      minWidth: sizing.touchTarget,
                      minHeight: sizing.touchTarget,
                      padding: spacing.md,
                      borderRadius: sizing.radiusMd,
                      backgroundColor: isDark ? colors.dark.surfaceElevated : colors.light.border,
                      marginRight: spacing.md,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    accessibilityLabel="Return to home screen"
                    accessibilityHint="Double tap to clear puzzle and go back"
                    accessibilityRole="button"
                  >
                    <Home size={sizing.iconMd} color={isDark ? colors.dark.text : colors.light.textSecondary} />
                  </Pressable>
                )}
                <View className="flex-1">
                  <Text
                    className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
                    accessibilityRole="header"
                  >
                    Pips Solver
                  </Text>
                  <Text
                    className={`text-base mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                    numberOfLines={1}
                  >
                    {isEditMode
                      ? 'Editing puzzle data'
                      : currentSavedPuzzleName
                        ? currentSavedPuzzleName
                        : 'Solve NYT domino puzzles'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {/* Saved Puzzles Button */}
                <Pressable
                  onPress={handleOpenSavedPuzzles}
                  style={{
                    minWidth: sizing.touchTarget,
                    minHeight: sizing.touchTarget,
                    padding: spacing.md,
                    borderRadius: sizing.radiusLg,
                    backgroundColor: isDark ? colors.dark.surfaceElevated : colors.light.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  accessibilityLabel="Open saved puzzles"
                  accessibilityHint="Double tap to browse your saved puzzles"
                  accessibilityRole="button"
                >
                  <FolderOpen size={sizing.iconLg} color={isDark ? colors.dark.text : colors.light.textSecondary} />
                </Pressable>
                {/* Save Button */}
                {puzzle && !isEditMode && (
                  <Pressable
                    onPress={() => setShowSaveModal(true)}
                    style={{
                      minWidth: sizing.touchTarget,
                      minHeight: sizing.touchTarget,
                      padding: spacing.md,
                      borderRadius: sizing.radiusLg,
                      backgroundColor: currentSavedPuzzleId ? colors.success.default : colors.primary.default,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    accessibilityLabel={currentSavedPuzzleId ? "Update saved puzzle" : "Save puzzle"}
                    accessibilityHint="Double tap to save this puzzle"
                    accessibilityRole="button"
                  >
                    <Save size={sizing.iconLg} color="#FFFFFF" />
                  </Pressable>
                )}
                {/* Edit Button */}
                {puzzle && (
                  <Pressable
                    onPress={handleToggleEditMode}
                    style={{
                      minWidth: sizing.touchTarget,
                      minHeight: sizing.touchTarget,
                      padding: spacing.md,
                      borderRadius: sizing.radiusLg,
                      backgroundColor: isEditMode ? colors.warning.default : isDark ? colors.dark.surfaceElevated : colors.light.border,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    accessibilityLabel={isEditMode ? "Finish editing" : "Edit puzzle"}
                    accessibilityHint={isEditMode ? "Double tap to exit edit mode" : "Double tap to edit puzzle data"}
                    accessibilityRole="button"
                  >
                    {isEditMode ? (
                      <Check size={sizing.iconLg} color="#FFFFFF" />
                    ) : (
                      <Pencil size={sizing.iconLg} color={isDark ? colors.dark.text : colors.light.textSecondary} />
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          </Animated.View>

          {/* Loading State with Progress */}
          {isLoading && (
            <ExtractionProgress stage={extractionStage} isDark={isDark} />
          )}

          {/* Error State */}
          {error && !isLoading && (
            <Animated.View
              entering={FadeIn}
              className="mx-5 p-4 rounded-xl bg-red-500/20 mb-4"
            >
              <Text className="text-red-500 text-center">{error}</Text>
              {puzzle && (
                <Pressable
                  onPress={handleToggleEditMode}
                  className="mt-3 py-2"
                >
                  <Text className="text-red-400 text-center font-medium underline">
                    Edit puzzle to fix
                  </Text>
                </Pressable>
              )}
            </Animated.View>
          )}

          {/* No Puzzle State */}
          {!puzzle && !isLoading && (
            <EmptyPuzzleState
              isDark={isDark}
              onUpload={handlePickImage}
              onSample={handleUseSample}
              onLShapedPuzzle={handleUseLShapedPuzzle}
            />
          )}

          {/* Puzzle Loaded State */}
          {puzzle && !isLoading && (
            <Animated.View entering={FadeIn} className="flex-1">
              {/* Edit Mode Banner with Reference Image Button */}
              {isEditMode && (
                <Animated.View
                  entering={FadeIn}
                  className="mx-5 mb-4 p-3 rounded-xl bg-amber-500/20"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-amber-500 text-sm font-medium flex-1">
                      Edit grid, regions, and dominoes. Tap Re-Solve when done.
                    </Text>
                    {imageUri && (
                      <Pressable
                        onPress={() => setShowReferenceImage(true)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: 'rgba(245, 158, 11, 0.3)',
                          paddingHorizontal: 10,
                          paddingVertical: 6,
                          borderRadius: 8,
                          marginLeft: 8,
                          gap: 4,
                        }}
                      >
                        <ZoomIn size={16} color="#F59E0B" />
                        <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '600' }}>
                          Reference
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </Animated.View>
              )}

              {/* Edit Toolbar - shown in edit mode */}
              {isEditMode && (
                <EditToolbar
                  regions={puzzle.regions}
                  selectedRegionId={selectedRegionForAssign}
                  onSelectRegion={handleSelectRegion}
                  onAddRegion={handleAddRegion}
                  onEditRegion={handleEditRegion}
                  onGridSize={handleOpenGridSize}
                  gridEditMode={gridEditMode}
                  onToggleGridEditMode={handleToggleGridEditMode}
                  isDark={isDark}
                  isRemoveCellMode={isRemoveCellMode}
                  onToggleRemoveCellMode={handleToggleRemoveCellMode}
                  isPaintBucketMode={isPaintBucketMode}
                  onTogglePaintBucketMode={handleTogglePaintBucketMode}
                  canUndo={canUndo}
                  canRedo={canRedo}
                  onUndo={undo}
                  onRedo={redo}
                />
              )}

              {/* Solve Mode Selector - hidden in edit mode */}
              {!isEditMode && (
                <View className="px-5 mb-4">
                  <SolveModeSelector
                    currentMode={solveMode}
                    onModeChange={handleModeChange}
                    isDark={isDark}
                  />
                </View>
              )}

              {/* Puzzle Grid */}
              <View className="items-center py-4">
                <PuzzleGrid
                  puzzle={puzzle}
                  placements={isEditMode ? [] : currentPlacements}
                  selectedCell={selectedCell}
                  onCellPress={handleCellPress}
                  onRegionPress={handleRegionPressOnCell}
                  isDark={isDark}
                  isEditMode={isEditMode}
                  gridEditMode={gridEditMode}
                  selectedRegionForAssign={selectedRegionForAssign}
                  onEmptyCellPress={handleEmptyCellPress}
                />
              </View>

              {/* Domino Tray */}
              <View className="mt-4">
                <DominoTray
                  dominoes={puzzle.availableDominoes}
                  placements={isEditMode ? [] : currentPlacements}
                  isDark={isDark}
                  isEditMode={isEditMode}
                  onDominoPress={handleDominoPress}
                  onAddDomino={handleAddDomino}
                />
              </View>

              {/* Action Buttons */}
              <View className="px-5 mt-6 flex-row gap-3">
                {isEditMode ? (
                  <>
                    <ActionButton
                      onPress={handleClearAllPress}
                      icon={<RotateCcw size={20} color={isDark ? '#fff' : '#333'} />}
                      label="Clear All"
                      variant="secondary"
                      isDark={isDark}
                    />
                    <ActionButton
                      onPress={handleReSolve}
                      icon={<RefreshCw size={20} color="#fff" />}
                      label="Re-Solve"
                      variant="warning"
                      isDark={isDark}
                    />
                  </>
                ) : (
                  <>
                    <ActionButton
                      onPress={reset}
                      icon={<RotateCcw size={20} color={isDark ? '#fff' : '#333'} />}
                      label="Reset"
                      variant="secondary"
                      isDark={isDark}
                    />
                    <ActionButton
                      onPress={handleSolve}
                      icon={
                        solveMode === 'step' ? (
                          <ChevronRight size={20} color="#fff" />
                        ) : (
                          <Play size={20} color="#fff" />
                        )
                      }
                      label={actionLabel}
                      variant="primary"
                      isDark={isDark}
                      disabled={!canTakeAction || solveMode === 'hint'}
                    />
                  </>
                )}
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Domino Editor Modal */}
      <DominoEditor
        visible={showDominoEditor}
        initialPips={editingDominoPips ?? [0, 0]}
        onSave={handleDominoSave}
        onDelete={isAddingDomino ? undefined : handleDominoDelete}
        onClose={() => setShowDominoEditor(false)}
        isDark={isDark}
        isNew={isAddingDomino}
      />

      {/* Region Editor Modal */}
      <RegionEditor
        visible={showRegionEditor}
        region={editingRegion}
        onSave={handleRegionSave}
        onDelete={handleRegionDelete}
        onClose={() => setShowRegionEditor(false)}
        isDark={isDark}
        isNew={isAddingRegion}
      />

      {/* Grid Size Editor Modal */}
      <GridSizeEditor
        visible={showGridSizeEditor}
        currentWidth={puzzle?.width ?? 5}
        currentHeight={puzzle?.height ?? 5}
        onSave={handleGridSizeSave}
        onClose={() => setShowGridSizeEditor(false)}
        isDark={isDark}
      />

      {/* Save Puzzle Modal */}
      <SavePuzzleModal
        visible={showSaveModal}
        onSave={handleSavePuzzle}
        onClose={() => setShowSaveModal(false)}
        isDark={isDark}
        isEditing={!!currentSavedPuzzleId}
        currentName={currentSavedPuzzleName ?? ''}
      />

      {/* Reference Image Modal */}
      <Modal
        visible={showReferenceImage}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReferenceImage(false)}
      >
        <Pressable
          style={[indexStyles.modalOverlay, { backgroundColor: colors.dark.overlay }]}
          onPress={() => setShowReferenceImage(false)}
          accessibilityLabel="Close reference image"
          accessibilityHint="Tap anywhere to dismiss"
          accessibilityRole="button"
        >
          <SafeAreaView style={indexStyles.modalSafeArea}>
            <View style={indexStyles.modalHeader}>
              <Text style={indexStyles.modalTitle}>
                Reference Screenshot
              </Text>
              <Pressable
                onPress={() => setShowReferenceImage(false)}
                style={indexStyles.modalCloseButton}
                accessibilityLabel="Close"
                accessibilityRole="button"
              >
                <X size={sizing.iconLg} color={colors.dark.text} />
              </Pressable>
            </View>
            <View style={indexStyles.modalContent}>
              {imageUri && (
                <Image
                  source={{ uri: imageUri }}
                  style={indexStyles.referenceImage}
                  resizeMode="contain"
                  accessibilityLabel="Original puzzle screenshot"
                />
              )}
            </View>
            <Text style={indexStyles.modalHint}>
              Tap anywhere to close
            </Text>
          </SafeAreaView>
        </Pressable>
      </Modal>

      {/* Island Mode Choice Modal */}
      <Modal
        visible={showIslandModeChoice}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowIslandModeChoice(false);
          setPendingImageUri(null);
        }}
      >
        <Pressable
          onPress={() => {
            setShowIslandModeChoice(false);
            setPendingImageUri(null);
          }}
          style={[indexStyles.dialogOverlay, { backgroundColor: isDark ? colors.dark.overlay : colors.light.overlay }]}
          accessibilityLabel="Cancel puzzle type selection"
          accessibilityRole="button"
        >
          <Pressable
            onPress={() => {}}
            style={[
              indexStyles.dialogBox,
              { backgroundColor: isDark ? colors.dark.surface : colors.light.surface },
            ]}
          >
            <Text
              style={[indexStyles.dialogTitle, { color: isDark ? colors.dark.text : colors.light.text }]}
              accessibilityRole="header"
            >
              Puzzle Type
            </Text>
            <Text
              style={[indexStyles.dialogMessage, { color: isDark ? colors.dark.textSecondary : colors.light.textSecondary }]}
            >
              Does this puzzle have multiple separate islands?
            </Text>

            <Pressable
              onPress={handleSingleIsland}
              style={[indexStyles.choiceButton, { backgroundColor: colors.primary.default }]}
              accessibilityLabel="Single grid puzzle"
              accessibilityHint="Standard puzzle with one connected area"
              accessibilityRole="button"
            >
              <Text style={indexStyles.choiceButtonTitle}>
                Single Grid
              </Text>
              <Text style={indexStyles.choiceButtonSubtitle}>
                Standard puzzle with one connected area
              </Text>
            </Pressable>

            <Pressable
              onPress={handleMultipleIslands}
              style={[
                indexStyles.choiceButton,
                {
                  backgroundColor: isDark ? colors.dark.surfaceElevated : colors.light.border,
                  borderWidth: 2,
                  borderColor: colors.success.default,
                },
              ]}
              accessibilityLabel="Multiple islands puzzle"
              accessibilityHint="Separate grids sharing one domino pool"
              accessibilityRole="button"
            >
              <Text style={[indexStyles.choiceButtonTitle, { color: isDark ? colors.dark.text : colors.light.text }]}>
                Multiple Islands
              </Text>
              <Text style={[indexStyles.choiceButtonSubtitle, { color: isDark ? colors.dark.textSecondary : colors.light.textSecondary }]}>
                Separate grids sharing one domino pool
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Island Config Modal */}
      <IslandConfigModal
        visible={showIslandConfigModal}
        onConfirm={handleIslandConfigConfirm}
        onClose={() => {
          setShowIslandConfigModal(false);
          setIsMultiIslandMode(false);
          setPendingImageUri(null);
        }}
        isDark={isDark}
      />

      {/* Grid Size Hint Modal */}
      <GridSizeHintModal
        visible={showSizeHintModal}
        onConfirm={handleSizeHintConfirm}
        onSkip={handleSizeHintSkip}
        onClose={handleSizeHintClose}
        isDark={isDark}
        imageUri={pendingImageUri ?? undefined}
      />

      {/* Dual Image Cropper Modal (legacy - kept for backwards compatibility) */}
      <DualImageCropper
        visible={showDualCropper}
        sourceImageUri={pendingImageUri ?? ''}
        onComplete={handleDualCropperComplete}
        onClose={handleDualCropperClose}
        isDark={isDark}
        islandConfigs={isMultiIslandMode ? islandConfigs : undefined}
        onCompleteMulti={isMultiIslandMode ? handleMultiIslandCropperComplete : undefined}
      />

      {/* New Unified Setup Wizard */}
      <PuzzleSetupWizard
        visible={showSetupWizard}
        sourceImageUri={pendingImageUri ?? ''}
        onComplete={handleWizardComplete}
        onCompleteMulti={handleWizardCompleteMulti}
        onClose={handleWizardClose}
        isDark={isDark}
      />

      {/* Clear All Confirmation Modal */}
      <Modal
        visible={showClearConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClearConfirm(false)}
      >
        <Pressable
          onPress={() => setShowClearConfirm(false)}
          style={[indexStyles.dialogOverlay, { backgroundColor: isDark ? colors.dark.overlay : colors.light.overlay }]}
          accessibilityLabel="Cancel clear"
          accessibilityRole="button"
        >
          <Pressable
            onPress={() => {}}
            style={[
              indexStyles.dialogBox,
              { backgroundColor: isDark ? colors.dark.surface : colors.light.surface },
            ]}
          >
            <Text
              style={[indexStyles.dialogTitle, { color: isDark ? colors.dark.text : colors.light.text }]}
              accessibilityRole="header"
            >
              Clear All?
            </Text>
            <Text
              style={[indexStyles.dialogMessage, { color: isDark ? colors.dark.textSecondary : colors.light.textSecondary }]}
            >
              This will remove the current puzzle and all edits. This cannot be undone.
            </Text>

            <View style={indexStyles.dialogButtons}>
              <Pressable
                onPress={() => setShowClearConfirm(false)}
                style={[
                  indexStyles.dialogButton,
                  { backgroundColor: isDark ? colors.dark.surfaceElevated : colors.light.border },
                ]}
                accessibilityLabel="Cancel"
                accessibilityRole="button"
              >
                <Text
                  style={[indexStyles.dialogButtonText, { color: isDark ? colors.dark.text : colors.light.text }]}
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={handleConfirmClear}
                style={[indexStyles.dialogButton, { backgroundColor: colors.danger.default }]}
                accessibilityLabel="Confirm clear all"
                accessibilityHint="Double tap to permanently delete puzzle"
                accessibilityRole="button"
              >
                <Text style={[indexStyles.dialogButtonText, { color: '#FFFFFF' }]}>
                  Clear All
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const indexStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Reference Image Modal
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSafeArea: {
    flex: 1,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  modalTitle: {
    color: colors.dark.text,
    fontSize: typography.lg,
    fontWeight: '700',
  },
  modalCloseButton: {
    minWidth: sizing.touchTarget,
    minHeight: sizing.touchTarget,
    padding: spacing.sm,
    borderRadius: sizing.radiusMd,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  referenceImage: {
    width: '100%',
    height: '80%',
    borderRadius: sizing.radiusLg,
  },
  modalHint: {
    color: colors.dark.textTertiary,
    textAlign: 'center',
    paddingBottom: spacing.xl,
    fontSize: typography.sm,
  },
  // Dialog styles (used by Clear Confirm and Island Choice modals)
  dialogOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  dialogBox: {
    borderRadius: sizing.radiusXl,
    padding: spacing['2xl'],
    width: '100%',
    maxWidth: 340,
  },
  dialogTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  dialogMessage: {
    fontSize: typography.sm,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  dialogButton: {
    flex: 1,
    minHeight: sizing.touchTarget,
    paddingVertical: spacing.md,
    borderRadius: sizing.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogButtonText: {
    fontWeight: '600',
    fontSize: typography.base,
  },
  // Choice button styles (for Island Mode Choice)
  choiceButton: {
    minHeight: sizing.touchTargetPrimary,
    paddingVertical: spacing.md,
    borderRadius: sizing.radiusMd,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceButtonTitle: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: typography.base,
    textAlign: 'center',
  },
  choiceButtonSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: typography.xs,
    textAlign: 'center',
    marginTop: 2,
  },
});
