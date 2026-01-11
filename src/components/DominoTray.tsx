/**
 * DominoTray - Obsidian Arcade
 *
 * Premium domino tray with brass border and 3D-styled tiles.
 */

import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { Domino, PlacedDomino, dominoId } from '@/lib/types/puzzle';
import { obsidianDark, radius, springs, gradients } from '@/lib/theme';
import { hapticPatterns } from '@/lib/haptics';

// Pip positions for domino display
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
  isUsed,
}: {
  count: number;
  size: number;
  isUsed: boolean;
}) {
  const positions = PIP_POSITIONS[count] || [];
  const dotSize = size * 0.2;

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
            backgroundColor: isUsed ? obsidianDark.text.muted : obsidianDark.text.primary,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isUsed ? 0 : 0.3,
            shadowRadius: 1,
          }}
        />
      ))}
    </View>
  );
}

interface DominoTileProps {
  domino: Domino;
  isUsed: boolean;
  isDark: boolean;
  isEditMode: boolean;
  onPress?: () => void;
  size?: number;
}

function DominoTile({
  domino,
  isUsed,
  isDark,
  isEditMode,
  onPress,
  size = 36,
}: DominoTileProps) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  const handlePressIn = () => {
    if (!isUsed) {
      scale.value = withSpring(0.95, springs.snappy);
      translateY.value = withSpring(-2, springs.snappy);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springs.smooth);
    translateY.value = withSpring(0, springs.smooth);
  };

  const handlePress = () => {
    if (isEditMode && onPress) {
      hapticPatterns.selectionTap();
      onPress();
    }
  };

  const content = (
    <View style={[styles.dominoTile, isUsed && styles.dominoUsed]}>
      {/* 3D effect - top highlight */}
      <View style={styles.domino3DTop} />

      {/* Left pip section */}
      <View style={styles.dominoHalf}>
        <PipDots count={domino.pips[0]} size={size} isUsed={isUsed} />
      </View>

      {/* Divider */}
      <View style={styles.dominoDivider} />

      {/* Right pip section */}
      <View style={styles.dominoHalf}>
        <PipDots count={domino.pips[1]} size={size} isUsed={isUsed} />
      </View>

      {/* Used overlay with strikethrough */}
      {isUsed && (
        <View style={styles.usedOverlay}>
          <View style={styles.strikethrough} />
        </View>
      )}
    </View>
  );

  if (isEditMode) {
    return (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={animatedStyle}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[
            styles.dominoWrapper,
            isEditMode && !isUsed && styles.dominoEditMode,
          ]}
        >
          {content}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      style={[animatedStyle, styles.dominoWrapper]}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isUsed}
      >
        {content}
      </Pressable>
    </Animated.View>
  );
}

function AddDominoButton({
  onPress,
  size = 36,
}: {
  onPress: () => void;
  size?: number;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, springs.snappy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springs.smooth);
  };

  return (
    <Animated.View style={[animatedStyle, styles.dominoWrapper]}>
      <Pressable
        onPress={() => {
          hapticPatterns.lightTap();
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.addButton,
          { width: size * 2 + 18, height: size + 8 },
        ]}
      >
        <Plus size={24} color={obsidianDark.accent.success} />
      </Pressable>
    </Animated.View>
  );
}

interface DominoTrayProps {
  dominoes: Domino[];
  placements: PlacedDomino[];
  isDark: boolean;
  isEditMode?: boolean;
  onDominoPress?: (index: number) => void;
  onAddDomino?: () => void;
}

export function DominoTray({
  dominoes,
  placements,
  isDark,
  isEditMode = false,
  onDominoPress,
  onAddDomino,
}: DominoTrayProps) {
  // Track which dominoes are used by index
  const usedDominoIndices = useMemo(() => {
    const used = new Set<number>();
    for (const placement of placements) {
      for (let i = 0; i < dominoes.length; i++) {
        if (!used.has(i) && dominoId(dominoes[i].pips) === dominoId(placement.domino.pips)) {
          used.add(i);
          break;
        }
      }
    }
    return used;
  }, [dominoes, placements]);

  const usedCount = usedDominoIndices.size;
  const totalCount = dominoes.length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>
          {isEditMode ? 'TAP TO EDIT' : 'AVAILABLE DOMINOES'}
        </Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {usedCount}/{totalCount}
          </Text>
        </View>
      </View>

      {/* Brass-bordered tray container */}
      <View style={styles.trayContainer}>
        <LinearGradient
          colors={gradients.brass as unknown as readonly [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.brassBorder}
        >
          <View style={styles.trayInner}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              style={styles.scrollView}
            >
              {dominoes.map((domino, index) => (
                <DominoTile
                  key={`${domino.id}-${index}`}
                  domino={domino}
                  isUsed={usedDominoIndices.has(index)}
                  isDark={isDark}
                  isEditMode={isEditMode}
                  onPress={() => onDominoPress?.(index)}
                />
              ))}
              {isEditMode && onAddDomino && (
                <AddDominoButton onPress={onAddDomino} />
              )}
            </ScrollView>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: obsidianDark.text.muted,
    letterSpacing: 1,
  },
  countBadge: {
    backgroundColor: obsidianDark.bg.elevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: obsidianDark.border.default,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: obsidianDark.text.secondary,
  },
  trayContainer: {
    marginHorizontal: 8,
  },
  brassBorder: {
    borderRadius: radius.lg + 2,
    padding: 2,
  },
  trayInner: {
    backgroundColor: obsidianDark.bg.slate,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dominoWrapper: {
    marginHorizontal: 4,
  },
  dominoTile: {
    flexDirection: 'row',
    backgroundColor: obsidianDark.bg.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: obsidianDark.border.default,
    overflow: 'hidden',
    // 3D shadow effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  dominoUsed: {
    opacity: 0.4,
    shadowOpacity: 0,
  },
  domino3DTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  dominoHalf: {
    padding: 4,
  },
  dominoDivider: {
    width: 1,
    backgroundColor: obsidianDark.border.strong,
  },
  usedOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  strikethrough: {
    width: '140%',
    height: 2,
    backgroundColor: obsidianDark.accent.danger,
    transform: [{ rotate: '-45deg' }],
    opacity: 0.6,
  },
  dominoEditMode: {
    borderWidth: 2,
    borderColor: obsidianDark.accent.cyan,
    borderRadius: radius.md + 2,
  },
  addButton: {
    backgroundColor: obsidianDark.bg.slate,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: obsidianDark.accent.success,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
