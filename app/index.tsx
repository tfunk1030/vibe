import React, { useCallback, useState } from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useMutation } from '@tanstack/react-query';
import { useColorScheme } from 'react-native';

import { colors, spacing } from '@/theme/tokens';
import { usePuzzleStore } from '@/lib/state/puzzle-store';
import { extractPuzzleFromDualImages, extractMultiIslandPuzzle, createSamplePuzzle, GridSizeHint, ExtractionStage } from '@/lib/services/gemini';
import { solvePuzzle } from '@/lib/services/solver';
import { PuzzleGrid } from '@/components/PuzzleGrid';
import { DominoTray } from '@/components/DominoTray';
import { SolveModeSelector } from '@/components/SolveModeSelector';
import { EditToolbar } from '@/components/EditToolbar';
import { PuzzleSetupWizard } from '@/components/PuzzleSetupWizard';
import { ExtractionProgress } from '@/components/ExtractionProgress';
import { EmptyPuzzleState } from '@/components/EmptyPuzzleState';
import { IslandConfig, Cell, RegionConstraint } from '@/lib/types/puzzle';
import { DominoEditor } from '@/components/DominoEditor';
import { RegionEditor } from '@/components/RegionEditor';
import { GridSizeEditor } from '@/components/GridSizeEditor';
import { SavePuzzleModal } from '@/components/SavePuzzleModal';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const [extractionStage, setExtractionStage] = useState<ExtractionStage>('idle');
  const [showDominoEditor, setShowDominoEditor] = useState(false);
  const [showRegionEditor, setShowRegionEditor] = useState(false);
  const [showGridSizeEditor, setShowGridSizeEditor] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const puzzle = usePuzzleStore((s) => s.puzzle);
  const solution = usePuzzleStore((s) => s.solution);
  const solveMode = usePuzzleStore((s) => s.solveMode);
  const isLoading = usePuzzleStore((s) => s.isLoading);
  const isEditMode = usePuzzleStore((s) => s.isEditMode);
  const selectedCell = usePuzzleStore((s) => s.selectedCell);
  const currentPlacements = usePuzzleStore((s) => s.currentPlacements);
  const selectedRegionForAssign = usePuzzleStore((s) => s.selectedRegionForAssign);
  const gridEditMode = usePuzzleStore((s) => s.gridEditMode);
  const editingDominoIndex = usePuzzleStore((s) => s.editingDominoIndex);
  const editingRegionId = usePuzzleStore((s) => s.editingRegionId);

  const setPuzzle = usePuzzleStore((s) => s.setPuzzle);
  const setSolution = usePuzzleStore((s) => s.setSolution);
  const setLoading = usePuzzleStore((s) => s.setLoading);
  const setError = usePuzzleStore((s) => s.setError);
  const reset = usePuzzleStore((s) => s.reset);
  const setEditMode = usePuzzleStore((s) => s.setEditMode);
  const setSelectedCell = usePuzzleStore((s) => s.setSelectedCell);
  const setSelectedRegionForAssign = usePuzzleStore((s) => s.setSelectedRegionForAssign);
  const addRegion = usePuzzleStore((s) => s.addRegion);
  const setEditingRegionId = usePuzzleStore((s) => s.setEditingRegionId);
  const setEditingDominoIndex = usePuzzleStore((s) => s.setEditingDominoIndex);
  const toggleCellInGrid = usePuzzleStore((s) => s.toggleCellInGrid);
  const moveCellToRegion = usePuzzleStore((s) => s.moveCellToRegion);
  const updateDomino = usePuzzleStore((s) => s.updateDomino);
  const addDomino = usePuzzleStore((s) => s.addDomino);
  const removeDomino = usePuzzleStore((s) => s.removeDomino);
  const updateRegionConstraint = usePuzzleStore((s) => s.updateRegionConstraint);
  const removeRegion = usePuzzleStore((s) => s.removeRegion);
  const updateGridSize = usePuzzleStore((s) => s.updateGridSize);

  const extractDualMutation = useMutation({
    mutationFn: (params: { dominoUri: string; gridUri: string; sizeHint?: GridSizeHint }) =>
      extractPuzzleFromDualImages(params.dominoUri, params.gridUri, params.sizeHint, setExtractionStage),
    onSuccess: (data) => {
      setPuzzle(data);
      const sol = solvePuzzle(data);
      setSolution(sol);
      setLoading(false);
      setExtractionStage('idle');
    },
    onError: (err: Error) => {
      setError(err.message);
      setLoading(false);
      setExtractionStage('idle');
      Alert.alert('Extraction Failed', err.message);
    },
  });

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPendingImageUri(result.assets[0].uri);
      setShowSetupWizard(true);
    }
  };

  const handleWizardComplete = (dominoUri: string, gridUri: string, sizeHint?: GridSizeHint) => {
    setShowSetupWizard(false);
    setLoading(true);
    extractDualMutation.mutate({ dominoUri, gridUri, sizeHint });
  };

  const handleUseSample = () => {
    const sample = createSamplePuzzle();
    setPuzzle(sample);
    setSolution(solvePuzzle(sample));
  };

  const handleCellPress = (cell: Cell) => {
    if (isEditMode) {
      if (selectedRegionForAssign) {
        moveCellToRegion(cell, selectedRegionForAssign);
      }
    } else {
      setSelectedCell(cell);
    }
  };

  const handleEmptyCellPress = (cell: Cell) => {
    if (isEditMode) {
      toggleCellInGrid(cell);
    }
  };

  const handleDominoPress = (index: number) => {
    if (isEditMode) {
      setEditingDominoIndex(index);
      setShowDominoEditor(true);
    }
  };

  const handleEditRegion = (regionId: string) => {
    setEditingRegionId(regionId);
    setShowRegionEditor(true);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.dark.background : colors.light.background }]}>
        <ExtractionProgress stage={extractionStage} isDark={isDark} />
      </SafeAreaView>
    );
  }

  if (!puzzle) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.dark.background : colors.light.background }]}>
        <EmptyPuzzleState
          isDark={isDark}
          onUpload={handlePickImage}
          onSample={handleUseSample}
          onLShapedPuzzle={handleUseSample}
        />
        {pendingImageUri && (
          <PuzzleSetupWizard
            visible={showSetupWizard}
            sourceImageUri={pendingImageUri}
            onComplete={handleWizardComplete}
            onClose={() => setShowSetupWizard(false)}
            isDark={isDark}
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? colors.dark.background : colors.light.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <SolveModeSelector />
        </View>
        
        <View style={styles.gridContainer}>
          <PuzzleGrid
            puzzle={puzzle}
            placements={currentPlacements}
            selectedCell={selectedCell}
            onCellPress={handleCellPress}
            onEmptyCellPress={handleEmptyCellPress}
            onRegionPress={handleEditRegion}
            isDark={isDark}
            isEditMode={isEditMode}
            gridEditMode={gridEditMode}
            selectedRegionForAssign={selectedRegionForAssign}
          />
        </View>

        <View style={styles.trayContainer}>
          <DominoTray
            dominoes={puzzle.availableDominoes}
            placements={currentPlacements}
            isDark={isDark}
            isEditMode={isEditMode}
            onDominoPress={handleDominoPress}
            onAddDomino={() => {
              setEditingDominoIndex(null);
              setShowDominoEditor(true);
            }}
          />
        </View>
      </ScrollView>

      <EditToolbar
        regions={puzzle.regions}
        selectedRegionId={selectedRegionForAssign}
        onSelectRegion={setSelectedRegionForAssign}
        onAddRegion={() => addRegion({ type: 'any' })}
        onEditRegion={handleEditRegion}
        onGridSize={() => setShowGridSizeEditor(true)}
        gridEditMode={gridEditMode}
        onToggleGridEditMode={() => setEditMode(!isEditMode)}
        isDark={isDark}
      />

      {/* Modals */}
      {showDominoEditor && (
        <DominoEditor
          visible={showDominoEditor}
          domino={editingDominoIndex !== null ? puzzle.availableDominoes[editingDominoIndex] : null}
          onSave={(pips) => {
            if (editingDominoIndex !== null) {
              updateDomino(editingDominoIndex, pips);
            } else {
              addDomino(pips);
            }
            setShowDominoEditor(false);
          }}
          onDelete={() => {
            if (editingDominoIndex !== null) {
              removeDomino(editingDominoIndex);
            }
            setShowDominoEditor(false);
          }}
          onClose={() => setShowDominoEditor(false)}
          isDark={isDark}
        />
      )}

      {showRegionEditor && editingRegionId && (
        <RegionEditor
          visible={showRegionEditor}
          region={puzzle.regions.find(r => r.id === editingRegionId) || null}
          onSave={(constraint) => {
            updateRegionConstraint(editingRegionId, constraint);
            setShowRegionEditor(false);
          }}
          onDelete={() => {
            removeRegion(editingRegionId);
            setShowRegionEditor(false);
          }}
          onClose={() => setShowRegionEditor(false)}
          isDark={isDark}
        />
      )}

      {showGridSizeEditor && (
        <GridSizeEditor
          visible={showGridSizeEditor}
          width={puzzle.width}
          height={puzzle.height}
          onSave={(w, h) => {
            updateGridSize(w, h);
            setShowGridSizeEditor(false);
          }}
          onClose={() => setShowGridSizeEditor(false)}
          isDark={isDark}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  header: {
    padding: spacing.md,
  },
  gridContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  trayContainer: {
    padding: spacing.md,
  },
});
<ctrl63>