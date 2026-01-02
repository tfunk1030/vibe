import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { useMutation } from '@tanstack/react-query';
import {
  Camera,
  Image as ImageIcon,
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
import { extractPuzzleFromImage, extractPuzzleFromDualImages, createSamplePuzzle, createLShapedPuzzle, GridSizeHint } from '@/lib/services/gemini';
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
import { useSavedPuzzlesStore } from '@/lib/state/saved-puzzles-store';
import { Cell, SolveMode, RegionConstraint } from '@/lib/types/puzzle';

interface ExtractionParams {
  imageUri: string;
  sizeHint?: GridSizeHint;
}

interface DualExtractionParams {
  dominoImageUri: string;
  gridImageUri: string;
  sizeHint?: GridSizeHint;
}

function ActionButton({
  onPress,
  icon,
  label,
  variant = 'primary',
  isDark,
  disabled = false,
}: {
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: 'primary' | 'secondary' | 'warning';
  isDark: boolean;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const getBackgroundColor = () => {
    if (disabled) return isDark ? '#2a2a2a' : '#e0e0e0';
    if (variant === 'primary') return '#3B82F6';
    if (variant === 'warning') return '#F59E0B';
    return isDark ? '#2a2a2a' : '#f0f0f0';
  };

  return (
    <Animated.View style={[animatedStyle, { flex: 1 }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: 12,
          backgroundColor: getBackgroundColor(),
          gap: 8,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {icon}
        <Text
          style={{
            fontSize: 15,
            fontWeight: '600',
            color: disabled
              ? '#888'
              : variant === 'primary' || variant === 'warning'
                ? '#fff'
                : isDark
                  ? '#fff'
                  : '#333',
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
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
  const [showReferenceImage, setShowReferenceImage] = useState(false);
  const [showSizeHintModal, setShowSizeHintModal] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [showDualCropper, setShowDualCropper] = useState(false);
  const [pendingSizeHint, setPendingSizeHint] = useState<GridSizeHint | null>(null);

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
  const setCurrentSavedPuzzle = usePuzzleStore((s) => s.setCurrentSavedPuzzle);
  const setImageUri = usePuzzleStore((s) => s.setImageUri);

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
      extractPuzzleFromDualImages(params.dominoImageUri, params.gridImageUri, params.sizeHint),
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

  const { mutate: extractDualPuzzle } = dualExtractMutation;

  // Pick image from library
  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPendingImageUri(result.assets[0].uri);
      setImageUri(result.assets[0].uri);
      setShowSizeHintModal(true);
    }
  }, [setImageUri]);

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

  // Handle dual cropper complete
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

  // Handle dual cropper close
  const handleDualCropperClose = useCallback(() => {
    setShowDualCropper(false);
    setPendingImageUri(null);
    setPendingSizeHint(null);
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
      if (isAddingDomino) {
        addDomino(pips);
      } else if (editingDominoIndex !== null) {
        updateDomino(editingDominoIndex, pips);
      }
      setShowDominoEditor(false);
      clearSolution();
    },
    [isAddingDomino, editingDominoIndex, addDomino, updateDomino, clearSolution]
  );

  // Handle domino delete
  const handleDominoDelete = useCallback(() => {
    if (editingDominoIndex !== null) {
      removeDomino(editingDominoIndex);
    }
    setShowDominoEditor(false);
    clearSolution();
  }, [editingDominoIndex, removeDomino, clearSolution]);

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
      if (isAddingRegion) {
        addRegion(constraint);
      } else if (editingRegionId) {
        updateRegionConstraint(editingRegionId, constraint);
      }
      setShowRegionEditor(false);
      clearSolution();
    },
    [isAddingRegion, editingRegionId, addRegion, updateRegionConstraint, clearSolution]
  );

  // Handle region delete
  const handleRegionDelete = useCallback(() => {
    if (editingRegionId) {
      removeRegion(editingRegionId);
    }
    setShowRegionEditor(false);
    clearSolution();
  }, [editingRegionId, removeRegion, clearSolution]);

  // Handle grid size
  const handleOpenGridSize = useCallback(() => {
    setShowGridSizeEditor(true);
  }, []);

  // Handle grid size save
  const handleGridSizeSave = useCallback(
    (width: number, height: number) => {
      updateGridSize(width, height);
      clearSolution();
    },
    [updateGridSize, clearSolution]
  );

  // Handle toggle grid edit mode - simplified, not used anymore
  const handleToggleGridEditMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Handle toggle remove cell mode
  const handleToggleRemoveCellMode = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsRemoveCellMode((prev) => !prev);
  }, []);

  // Handle cell press in edit mode - assign to selected region OR remove if in remove mode
  const handleEditCellPress = useCallback(
    (cell: Cell) => {
      if (isRemoveCellMode) {
        // Remove cell from grid
        removeCell(cell);
        clearSolution();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (selectedRegionForAssign) {
        moveCellToRegion(cell, selectedRegionForAssign);
        clearSolution();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    [isRemoveCellMode, selectedRegionForAssign, removeCell, moveCellToRegion, clearSolution]
  );

  // Handle empty cell press (for adding cells to selected region)
  const handleEmptyCellPress = useCallback(
    (cell: Cell) => {
      if (selectedRegionForAssign) {
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
    [selectedRegionForAssign, toggleCellInGrid, moveCellToRegion, clearSolution]
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
    <View className="flex-1">
      <LinearGradient
        colors={isDark ? ['#0f0f0f', '#1a1a2e', '#0f0f0f'] : ['#f8fafc', '#e2e8f0', '#f8fafc']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
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
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: isDark ? '#2a2a2a' : '#e5e5e5',
                      marginRight: 12,
                    }}
                  >
                    <Home size={22} color={isDark ? '#fff' : '#666'} />
                  </Pressable>
                )}
                <View className="flex-1">
                  <Text
                    className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
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
              <View className="flex-row gap-2">
                {/* Saved Puzzles Button */}
                <Pressable
                  onPress={handleOpenSavedPuzzles}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: isDark ? '#2a2a2a' : '#e5e5e5',
                  }}
                >
                  <FolderOpen size={24} color={isDark ? '#fff' : '#666'} />
                </Pressable>
                {/* Save Button */}
                {puzzle && !isEditMode && (
                  <Pressable
                    onPress={() => setShowSaveModal(true)}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: currentSavedPuzzleId ? '#22C55E' : '#3B82F6',
                    }}
                  >
                    <Save size={24} color="#fff" />
                  </Pressable>
                )}
                {/* Edit Button */}
                {puzzle && (
                  <Pressable
                    onPress={handleToggleEditMode}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: isEditMode ? '#F59E0B' : isDark ? '#2a2a2a' : '#e5e5e5',
                    }}
                  >
                    {isEditMode ? (
                      <Check size={24} color="#fff" />
                    ) : (
                      <Pencil size={24} color={isDark ? '#fff' : '#666'} />
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          </Animated.View>

          {/* Loading State */}
          {isLoading && (
            <View className="flex-1 items-center justify-center py-20">
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text
                className={`mt-4 text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
              >
                Analyzing puzzle...
              </Text>
            </View>
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
            <Animated.View
              entering={FadeInDown.delay(200)}
              className="flex-1 px-5"
            >
              <View
                className={`rounded-2xl p-8 items-center ${isDark ? 'bg-white/5' : 'bg-black/5'}`}
              >
                <View
                  className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${isDark ? 'bg-white/10' : 'bg-black/10'}`}
                >
                  <Camera size={36} color={isDark ? '#888' : '#666'} />
                </View>
                <Text
                  className={`text-lg font-semibold text-center mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}
                >
                  No puzzle loaded
                </Text>
                <Text
                  className={`text-sm text-center ${isDark ? 'text-gray-500' : 'text-gray-600'}`}
                >
                  Take a photo or upload a screenshot of a NYT Pips puzzle to get
                  started
                </Text>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3 mt-6">
                <ActionButton
                  onPress={() => router.push('/camera')}
                  icon={<Camera size={20} color="#fff" />}
                  label="Camera"
                  variant="primary"
                  isDark={isDark}
                />
                <ActionButton
                  onPress={handlePickImage}
                  icon={
                    <ImageIcon size={20} color={isDark ? '#fff' : '#333'} />
                  }
                  label="Upload"
                  variant="secondary"
                  isDark={isDark}
                />
              </View>

              {/* Demo Button */}
              <Pressable
                onPress={handleUseSample}
                className="mt-6 py-3 items-center"
              >
                <Text className="text-blue-500 font-medium">
                  Try with sample puzzle
                </Text>
              </Pressable>

              {/* L-Shaped Puzzle Button */}
              <Pressable
                onPress={handleUseLShapedPuzzle}
                className="mt-2 py-3 items-center"
              >
                <Text className="text-green-500 font-medium">
                  Try L-shaped puzzle (from screenshot)
                </Text>
              </Pressable>
            </Animated.View>
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
                      onPress={reset}
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
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
          onPress={() => setShowReferenceImage(false)}
        >
          <SafeAreaView className="flex-1 w-full">
            <View className="flex-row justify-between items-center px-5 py-4">
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>
                Reference Screenshot
              </Text>
              <Pressable
                onPress={() => setShowReferenceImage(false)}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                }}
              >
                <X size={24} color="#fff" />
              </Pressable>
            </View>
            <View className="flex-1 items-center justify-center px-4">
              {imageUri && (
                <Image
                  source={{ uri: imageUri }}
                  style={{
                    width: '100%',
                    height: '80%',
                    borderRadius: 12,
                  }}
                  resizeMode="contain"
                />
              )}
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', paddingBottom: 20, fontSize: 13 }}>
              Tap anywhere to close
            </Text>
          </SafeAreaView>
        </Pressable>
      </Modal>

      {/* Grid Size Hint Modal */}
      <GridSizeHintModal
        visible={showSizeHintModal}
        onConfirm={handleSizeHintConfirm}
        onSkip={handleSizeHintSkip}
        onClose={handleSizeHintClose}
        isDark={isDark}
      />

      {/* Dual Image Cropper Modal */}
      <DualImageCropper
        visible={showDualCropper}
        sourceImageUri={pendingImageUri ?? ''}
        onComplete={handleDualCropperComplete}
        onClose={handleDualCropperClose}
        isDark={isDark}
      />
    </View>
  );
}
