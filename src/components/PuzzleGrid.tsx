import React, { useMemo } from 'react';
import { View, Text, Pressable, Dimensions } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { Plus, AlertTriangle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  PuzzleData,
  PlacedDomino,
  Cell,
  cellKey,
  constraintLabel,
  ExtractionConfidence,
  IslandMetadata,
} from '@/lib/types/puzzle';
import { GridEditMode } from '@/lib/state/puzzle-store';

interface PuzzleGridProps {
  puzzle: PuzzleData;
  placements: PlacedDomino[];
  selectedCell: Cell | null;
  onCellPress: (cell: Cell) => void;
  onRegionPress?: (regionId: string) => void;
  isDark: boolean;
  isEditMode?: boolean;
  gridEditMode?: GridEditMode;
  selectedRegionForAssign?: string | null;
  onEmptyCellPress?: (cell: Cell) => void;
  showIslandSeparators?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 16;

// Pip positions for domino display (3x3 grid pattern)
const PIP_POSITIONS: Record<number, { x: number; y: number }[]> = {
  0: [],
  1: [{ x: 0.5, y: 0.5 }],
  2: [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.75 },
  ],
  3: [
    { x: 0.25, y: 0.25 },
    { x: 0.5, y: 0.5 },
    { x: 0.75, y: 0.75 },
  ],
  4: [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.25 },
    { x: 0.25, y: 0.75 },
    { x: 0.75, y: 0.75 },
  ],
  5: [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.25 },
    { x: 0.5, y: 0.5 },
    { x: 0.25, y: 0.75 },
    { x: 0.75, y: 0.75 },
  ],
  6: [
    { x: 0.25, y: 0.2 },
    { x: 0.75, y: 0.2 },
    { x: 0.25, y: 0.5 },
    { x: 0.75, y: 0.5 },
    { x: 0.25, y: 0.8 },
    { x: 0.75, y: 0.8 },
  ],
};

function PipDots({
  count,
  size,
  color,
}: {
  count: number;
  size: number;
  color: string;
}) {
  const positions = PIP_POSITIONS[count] || [];
  const dotSize = size * 0.18;

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {positions.map((pos, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: pos.x * size - dotSize / 2,
            top: pos.y * size - dotSize / 2,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

function GridCell({
  cell,
  cellSize,
  regionColor,
  regionId,
  constraintText,
  isSelected,
  placedPip,
  onPress,
  onRegionPress,
  isDark,
  isEditMode,
  isSelectedRegion,
  isUncertain,
  isUncertainRegion,
}: {
  cell: Cell;
  cellSize: number;
  regionColor: string;
  regionId: string | null;
  constraintText: string | null;
  isSelected: boolean;
  placedPip: number | null;
  onPress: () => void;
  onRegionPress?: () => void;
  isDark: boolean;
  isEditMode: boolean;
  isSelectedRegion: boolean;
  isUncertain?: boolean;
  isUncertainRegion?: boolean;
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

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const handleLongPress = () => {
    if (isEditMode && onRegionPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onRegionPress();
    }
  };

  return (
    <Animated.View
      entering={FadeIn.delay(cell.row * 30 + cell.col * 20)}
      style={[
        {
          position: 'absolute',
          left: cell.col * cellSize,
          top: cell.row * cellSize,
          width: cellSize,
          height: cellSize,
          padding: 2,
        },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          flex: 1,
          backgroundColor: regionColor + (isDark ? 'CC' : '99'),
          borderRadius: 6,
          borderWidth: isSelected ? 3 : (isUncertain || isUncertainRegion) ? 2 : isEditMode ? 2 : 1,
          borderColor: isSelected
            ? isDark
              ? '#fff'
              : '#000'
            : (isUncertain || isUncertainRegion)
              ? '#F59E0B' // Amber warning color
              : isEditMode
                ? '#3B82F6'
                : isDark
                  ? 'rgba(255,255,255,0.3)'
                  : 'rgba(0,0,0,0.2)',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden',
        }}
        accessibilityLabel={`Cell at row ${cell.row + 1}, column ${cell.col + 1}${placedPip !== null ? `, value ${placedPip}` : ''}${constraintText ? `, constraint ${constraintText}` : ''}`}
        accessibilityHint={isEditMode ? "Tap to assign to selected region. Long press to edit region." : undefined}
        accessibilityRole="button"
      >
        {placedPip !== null ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <PipDots
              count={placedPip}
              size={cellSize * 0.7}
              color={isDark ? '#fff' : '#1a1a1a'}
            />
          </Animated.View>
        ) : (
          /* Show constraint text on every cell without a placed pip */
          constraintText && (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: cellSize * 0.35,
                  fontWeight: '800',
                  color: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.7)',
                  textShadowColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }}
              >
                {constraintText}
              </Text>
            </View>
          )
        )}
        {/* Warning indicator for uncertain cells/regions */}
        {(isUncertain || isUncertainRegion) && (
          <View
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              backgroundColor: '#F59E0B',
              borderRadius: 3,
              padding: 1,
            }}
          >
            <AlertTriangle size={cellSize * 0.18} color="#fff" />
          </View>
        )}
        {isEditMode && isSelectedRegion && (
          <View
            style={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#3B82F6',
            }}
          />
        )}
      </Pressable>
    </Animated.View>
  );
}

function EmptyGridCell({
  cell,
  cellSize,
  onPress,
  isDark,
  highlightColor,
}: {
  cell: Cell;
  cellSize: number;
  onPress: () => void;
  isDark: boolean;
  highlightColor: string | null;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const isHighlighted = highlightColor !== null;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: cell.col * cellSize,
          top: cell.row * cellSize,
          width: cellSize,
          height: cellSize,
          padding: 2,
        },
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={() => {
          scale.value = withSpring(0.95);
        }}
        onPressOut={() => {
          scale.value = withSpring(1);
        }}
        style={{
          flex: 1,
          backgroundColor: isHighlighted
            ? highlightColor + '40'
            : isDark
              ? 'rgba(255,255,255,0.05)'
              : 'rgba(0,0,0,0.03)',
          borderRadius: 6,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: isHighlighted
            ? highlightColor
            : isDark
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(0,0,0,0.1)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        accessibilityLabel={`Add cell at row ${cell.row + 1}, column ${cell.col + 1}`}
        accessibilityHint="Tap to add this cell to the selected region"
        accessibilityRole="button"
      >
        <Plus size={cellSize * 0.3} color={isHighlighted ? highlightColor : isDark ? '#444' : '#ccc'} />
      </Pressable>
    </Animated.View>
  );
}

export function PuzzleGrid({
  puzzle,
  placements,
  selectedCell,
  onCellPress,
  onRegionPress,
  isDark,
  isEditMode = false,
  gridEditMode = 'none',
  selectedRegionForAssign,
  onEmptyCellPress,
  showIslandSeparators = true,
}: PuzzleGridProps) {
  // Calculate cell size based on grid dimensions
  // For larger grids (7x9+), we need smaller cells to fit
  const cellSize = useMemo(() => {
    const availableWidth = SCREEN_WIDTH - GRID_PADDING * 2;
    const maxCellWidth = availableWidth / puzzle.width;
    // Scale max cell size based on grid size - smaller grids get larger cells
    const maxCellSize = puzzle.width <= 5 ? 70 : puzzle.width <= 7 ? 55 : 45;
    return Math.min(maxCellWidth, maxCellSize);
  }, [puzzle.width]);

  // Create map of cell -> region for quick lookup
  const cellRegionMap = useMemo(() => {
    const map = new Map<string, { color: string; constraint: string; regionId: string }>();
    for (const region of puzzle.regions) {
      for (const cell of region.cells) {
        map.set(cellKey(cell), {
          color: region.color,
          constraint: constraintLabel(region.constraint),
          regionId: region.id,
        });
      }
    }
    return map;
  }, [puzzle.regions]);

  // Create map of cell -> placed pip value
  const placedPipsMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const placement of placements) {
      const [c1, c2] = placement.cells;
      map.set(cellKey(c1), placement.domino.pips[0]);
      map.set(cellKey(c2), placement.domino.pips[1]);
    }
    return map;
  }, [placements]);

  // Create set of valid cell keys for quick lookup
  const validCellKeys = useMemo(() => {
    return new Set(puzzle.validCells.map(cellKey));
  }, [puzzle.validCells]);

  // Generate all possible cells in the grid (for edit mode)
  const allGridCells = useMemo(() => {
    const cells: Cell[] = [];
    for (let row = 0; row < puzzle.height; row++) {
      for (let col = 0; col < puzzle.width; col++) {
        cells.push({ row, col });
      }
    }
    return cells;
  }, [puzzle.width, puzzle.height]);

  // Get empty cells (cells in grid bounds but not in validCells)
  const emptyCells = useMemo(() => {
    if (!isEditMode) return [];
    return allGridCells.filter((cell) => !validCellKeys.has(cellKey(cell)));
  }, [allGridCells, validCellKeys, isEditMode]);

  // Get selected region's color for highlighting
  const selectedRegionColor = useMemo(() => {
    if (!selectedRegionForAssign) return null;
    const region = puzzle.regions.find((r) => r.id === selectedRegionForAssign);
    return region?.color ?? null;
  }, [selectedRegionForAssign, puzzle.regions]);

  // Get sets of uncertain cells and regions from extraction confidence
  const uncertainCellKeys = useMemo(() => {
    return new Set(puzzle.confidence?.uncertainCells ?? []);
  }, [puzzle.confidence?.uncertainCells]);

  const uncertainRegionIds = useMemo(() => {
    return new Set(puzzle.confidence?.uncertainRegions ?? []);
  }, [puzzle.confidence?.uncertainRegions]);

  const gridWidth = puzzle.width * cellSize;
  const gridHeight = puzzle.height * cellSize;

  return (
    <View
      style={{
        width: gridWidth,
        height: gridHeight,
        position: 'relative',
      }}
    >
      {/* Empty cells (edit mode only) */}
      {isEditMode &&
        emptyCells.map((cell) => {
          const key = cellKey(cell);
          return (
            <EmptyGridCell
              key={`empty-${key}`}
              cell={cell}
              cellSize={cellSize}
              onPress={() => onEmptyCellPress?.(cell)}
              isDark={isDark}
              highlightColor={selectedRegionColor}
            />
          );
        })}

      {/* Valid cells */}
      {puzzle.validCells.map((cell) => {
        const key = cellKey(cell);
        const regionInfo = cellRegionMap.get(key);
        const isSelected = selectedCell ? cellKey(selectedCell) === key : false;
        const placedPip = placedPipsMap.get(key) ?? null;

        return (
          <GridCell
            key={key}
            cell={cell}
            cellSize={cellSize}
            regionColor={regionInfo?.color || '#888'}
            regionId={regionInfo?.regionId || null}
            constraintText={regionInfo?.constraint ?? null}
            isSelected={isSelected}
            placedPip={placedPip}
            onPress={() => onCellPress(cell)}
            onRegionPress={
              regionInfo?.regionId && onRegionPress
                ? () => onRegionPress(regionInfo.regionId)
                : undefined
            }
            isDark={isDark}
            isEditMode={isEditMode}
            isSelectedRegion={isEditMode && regionInfo?.regionId === selectedRegionForAssign}
            isUncertain={uncertainCellKeys.has(key)}
            isUncertainRegion={regionInfo?.regionId ? uncertainRegionIds.has(regionInfo.regionId) : false}
          />
        );
      })}

      {/* Island separators - render vertical lines between islands */}
      {showIslandSeparators && puzzle.islands && puzzle.islands.length > 1 && puzzle.islands.map((island, index) => {
        // Skip the first island (no separator before it)
        if (index === 0) return null;

        // Position separator at the start of this island (which is right after previous island + gap)
        const separatorX = island.startCol * cellSize - cellSize / 2;

        return (
          <View
            key={`island-separator-${index}`}
            style={{
              position: 'absolute',
              left: separatorX,
              top: 0,
              width: 2,
              height: gridHeight,
              backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
              borderRadius: 1,
            }}
          />
        );
      })}
    </View>
  );
}
