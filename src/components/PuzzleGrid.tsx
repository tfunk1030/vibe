/**
 * PuzzleGrid - Obsidian Arcade
 *
 * Premium puzzle grid with glassmorphism cells and glow effects.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, Dimensions, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Plus, AlertTriangle } from 'lucide-react-native';
import {
  PuzzleData,
  PlacedDomino,
  Cell,
  cellKey,
  constraintLabel,
} from '@/lib/types/puzzle';
import { GridEditMode } from '@/lib/state/puzzle-store';
import { obsidianDark, radius, springs } from '@/lib/theme';
import { hapticPatterns } from '@/lib/haptics';

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
}: {
  count: number;
  size: number;
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
            backgroundColor: obsidianDark.text.primary,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.3,
            shadowRadius: 2,
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
  const glow = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => {
    if (!isSelected) return {};
    return {
      shadowColor: obsidianDark.accent.primary,
      shadowOpacity: 0.6 + glow.value * 0.4,
      shadowRadius: 8 + glow.value * 4,
      shadowOffset: { width: 0, height: 0 },
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.92, springs.snappy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springs.smooth);
  };

  const handlePress = () => {
    hapticPatterns.lightTap();
    onPress();
  };

  const handleLongPress = () => {
    if (isEditMode && onRegionPress) {
      hapticPatterns.longPress();
      onRegionPress();
    }
  };

  // Determine border styling
  const getBorderStyle = () => {
    if (isSelected) {
      return {
        borderWidth: 3,
        borderColor: obsidianDark.accent.primary,
      };
    }
    if (isUncertain || isUncertainRegion) {
      return {
        borderWidth: 2,
        borderColor: obsidianDark.accent.warning,
      };
    }
    if (isEditMode) {
      return {
        borderWidth: 2,
        borderColor: obsidianDark.accent.cyan,
      };
    }
    return {
      borderWidth: 1,
      borderColor: obsidianDark.border.default,
    };
  };

  const borderStyle = getBorderStyle();

  return (
    <Animated.View
      entering={FadeIn.delay(cell.row * 30 + cell.col * 20).springify()}
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
        isSelected && glowStyle,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.cell,
          {
            backgroundColor: regionColor + 'B3', // 70% opacity
            ...borderStyle,
          },
        ]}
      >
        {/* Glass overlay for depth */}
        <View style={styles.cellGlassOverlay} />

        {placedPip !== null ? (
          <Animated.View entering={FadeIn.duration(200).springify()}>
            <PipDots count={placedPip} size={cellSize * 0.7} />
          </Animated.View>
        ) : (
          constraintText && (
            <View style={styles.constraintContainer}>
              <Text
                style={[
                  styles.constraintText,
                  { fontSize: cellSize * 0.35 },
                ]}
              >
                {constraintText}
              </Text>
            </View>
          )
        )}

        {/* Warning indicator for uncertain cells/regions */}
        {(isUncertain || isUncertainRegion) && (
          <View style={styles.warningBadge}>
            <AlertTriangle size={cellSize * 0.18} color="#fff" />
          </View>
        )}

        {/* Edit mode selection indicator */}
        {isEditMode && isSelectedRegion && (
          <View style={styles.editIndicator} />
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
    hapticPatterns.lightTap();
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
          scale.value = withSpring(0.95, springs.snappy);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, springs.smooth);
        }}
        style={[
          styles.emptyCell,
          {
            backgroundColor: isHighlighted
              ? highlightColor + '26' // 15% opacity
              : obsidianDark.bg.slate,
            borderColor: isHighlighted
              ? highlightColor
              : obsidianDark.border.subtle,
          },
        ]}
      >
        <Plus
          size={cellSize * 0.3}
          color={isHighlighted ? highlightColor : obsidianDark.text.subtle}
        />
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
  const cellSize = useMemo(() => {
    const availableWidth = SCREEN_WIDTH - GRID_PADDING * 2;
    const maxCellWidth = availableWidth / puzzle.width;
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
    <View style={[styles.gridContainer, { width: gridWidth, height: gridHeight }]}>
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

      {/* Island separators */}
      {showIslandSeparators && puzzle.islands && puzzle.islands.length > 1 && puzzle.islands.map((island, index) => {
        if (index === 0) return null;
        const separatorX = island.startCol * cellSize - cellSize / 2;

        return (
          <View
            key={`island-separator-${index}`}
            style={[
              styles.islandSeparator,
              {
                left: separatorX,
                height: gridHeight,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  gridContainer: {
    position: 'relative',
  },
  cell: {
    flex: 1,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cellGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  constraintContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  constraintText: {
    fontWeight: '800',
    color: obsidianDark.text.primary,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  warningBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: obsidianDark.accent.warning,
    borderRadius: 3,
    padding: 1,
  },
  editIndicator: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: obsidianDark.accent.cyan,
  },
  emptyCell: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  islandSeparator: {
    position: 'absolute',
    top: 0,
    width: 2,
    backgroundColor: obsidianDark.border.strong,
    borderRadius: 1,
  },
});
