import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import {
  Grid3X3,
  Plus,
  Pencil,
  Trash2,
  PaintBucket,
  Undo2,
  Redo2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Region, constraintLabel } from '@/lib/types/puzzle';
import { GridEditMode } from '@/lib/state/puzzle-store';
import { colors, sizing, spacing, typography } from '@/theme/tokens';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';

interface EditToolbarProps {
  regions: Region[];
  selectedRegionId: string | null;
  onSelectRegion: (regionId: string) => void;
  onAddRegion: () => void;
  onEditRegion: (regionId: string) => void;
  onGridSize: () => void;
  gridEditMode: GridEditMode;
  onToggleGridEditMode: () => void;
  isDark: boolean;
  isRemoveCellMode?: boolean;
  onToggleRemoveCellMode?: () => void;
  isPaintBucketMode?: boolean;
  onTogglePaintBucketMode?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

function ToolButton({
  icon,
  label,
  isActive,
  onPress,
  isDark,
  small = false,
  activeColor,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onPress: () => void;
  isDark: boolean;
  small?: boolean;
  activeColor?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (!disabled) {
      scale.value = reduceMotion ? 0.95 : withSpring(0.95, { damping: 15, stiffness: 400 });
    }
  }, [disabled, reduceMotion, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = reduceMotion ? 1 : withSpring(1, { damping: 15, stiffness: 400 });
  }, [reduceMotion, scale]);

  const handlePress = useCallback(() => {
    if (!disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  }, [disabled, onPress]);

  const bgColor = isActive
    ? (activeColor ?? colors.primary.default)
    : isDark
      ? colors.dark.surfaceElevated
      : colors.light.background;

  const textColor = isActive
    ? '#FFFFFF'
    : isDark
      ? colors.dark.textSecondary
      : colors.light.textSecondary;

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityLabel={accessibilityLabel || label}
        accessibilityHint={accessibilityHint}
        accessibilityRole="button"
        accessibilityState={{ disabled, selected: isActive }}
        style={[
          toolButtonStyles.button,
          {
            minHeight: sizing.touchTarget,
            paddingVertical: small ? spacing.sm : spacing.md,
            paddingHorizontal: small ? spacing.md : spacing.lg,
            backgroundColor: bgColor,
            opacity: disabled ? 0.4 : 1,
          },
        ]}
      >
        {icon}
        <Text style={[toolButtonStyles.label, { fontSize: small ? typography.xs : typography.sm, color: textColor }]}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const toolButtonStyles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: sizing.radiusLg,
    gap: spacing.sm,
  },
  label: {
    fontWeight: '600',
  },
});

function RegionChip({
  region,
  isSelected,
  onPress,
  onEditPress,
  isDark,
}: {
  region: Region;
  isSelected: boolean;
  onPress: () => void;
  onEditPress: () => void;
  isDark: boolean;
}) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = reduceMotion ? 0.95 : withSpring(0.95, { damping: 15, stiffness: 400 });
  }, [reduceMotion, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = reduceMotion ? 1 : withSpring(1, { damping: 15, stiffness: 400 });
  }, [reduceMotion, scale]);

  const label = constraintLabel(region.constraint);

  return (
    <Animated.View style={[animatedStyle, regionChipStyles.wrapper]}>
      <View style={regionChipStyles.container}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityLabel={`Select region ${label}`}
          accessibilityHint="Double tap to select this region for painting cells"
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          style={[
            regionChipStyles.selectButton,
            {
              backgroundColor: isSelected
                ? region.color
                : isDark
                  ? colors.dark.surfaceElevated
                  : colors.light.background,
              borderWidth: isSelected ? 2 : 1,
              borderColor: isSelected ? region.color : isDark ? colors.dark.borderStrong : colors.light.border,
            },
          ]}
        >
          <View
            style={[
              regionChipStyles.colorDot,
              { backgroundColor: isSelected ? '#FFFFFF' : region.color },
            ]}
          />
          <Text
            style={[
              regionChipStyles.label,
              { color: isSelected ? '#FFFFFF' : isDark ? colors.dark.text : colors.light.text },
            ]}
          >
            {label}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onEditPress();
          }}
          accessibilityLabel={`Edit region ${label}`}
          accessibilityHint="Double tap to edit region constraints"
          accessibilityRole="button"
          style={[
            regionChipStyles.editButton,
            {
              backgroundColor: isSelected
                ? region.color
                : isDark
                  ? colors.dark.surfaceElevated
                  : colors.light.background,
              borderWidth: isSelected ? 2 : 1,
              borderColor: isSelected ? region.color : isDark ? colors.dark.borderStrong : colors.light.border,
            },
          ]}
        >
          <Pencil size={sizing.iconSm} color={isSelected ? '#FFFFFF' : isDark ? colors.dark.textSecondary : colors.light.textSecondary} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const regionChipStyles = StyleSheet.create({
  wrapper: {
    marginRight: spacing.sm,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizing.touchTarget,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderTopLeftRadius: sizing.radiusLg,
    borderBottomLeftRadius: sizing.radiusLg,
    borderRightWidth: 0,
    gap: spacing.sm,
  },
  colorDot: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  editButton: {
    minHeight: sizing.touchTarget,
    minWidth: sizing.touchTarget,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopRightRadius: sizing.radiusLg,
    borderBottomRightRadius: sizing.radiusLg,
    borderLeftWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

function AddRegionButton({
  onPress,
  isDark,
}: {
  onPress: () => void;
  isDark: boolean;
}) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = reduceMotion ? 0.95 : withSpring(0.95, { damping: 15, stiffness: 400 });
  }, [reduceMotion, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = reduceMotion ? 1 : withSpring(1, { damping: 15, stiffness: 400 });
  }, [reduceMotion, scale]);

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityLabel="Add new region"
        accessibilityHint="Double tap to create a new region with constraints"
        accessibilityRole="button"
        style={[
          addButtonStyles.button,
          {
            backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.08)',
          },
        ]}
      >
        <Plus size={sizing.iconSm} color={colors.success.default} />
        <Text style={addButtonStyles.label}>Add</Text>
      </Pressable>
    </Animated.View>
  );
}

const addButtonStyles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: sizing.touchTarget,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: sizing.radiusMd,
    borderWidth: 2,
    borderColor: colors.success.default,
    borderStyle: 'dashed',
    gap: spacing.xs,
  },
  label: {
    fontSize: typography.xs,
    fontWeight: '600',
    color: colors.success.default,
  },
});

export function EditToolbar({
  regions,
  selectedRegionId,
  onSelectRegion,
  onAddRegion,
  onEditRegion,
  onGridSize,
  isDark,
  isRemoveCellMode = false,
  onToggleRemoveCellMode,
  isPaintBucketMode = false,
  onTogglePaintBucketMode,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: EditToolbarProps) {
  const [showTools, setShowTools] = useState(true);

  // Get selected region color for paint bucket icon
  const selectedRegion = regions.find(r => r.id === selectedRegionId);
  const paintBucketColor = isPaintBucketMode
    ? '#FFFFFF'
    : selectedRegion?.color ?? (isDark ? colors.dark.textSecondary : colors.light.textSecondary);

  const handleToggleTools = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowTools(!showTools);
  }, [showTools]);

  // Instruction text based on mode
  const getInstructionText = () => {
    if (isRemoveCellMode) return 'Tap cells to remove them from the grid';
    if (isPaintBucketMode) return 'Tap to fill all connected cells with selected region';
    return 'Select a region below, then tap cells to assign';
  };

  const getBannerColors = () => {
    if (isRemoveCellMode) {
      return {
        bg: `${colors.danger.default}20`,
        border: `${colors.danger.default}40`,
        text: colors.danger.default,
      };
    }
    if (isPaintBucketMode) {
      const regionColor = selectedRegion?.color ?? colors.primary.default;
      return {
        bg: `${regionColor}20`,
        border: `${regionColor}40`,
        text: regionColor,
      };
    }
    return {
      bg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
      border: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
      text: isDark ? colors.dark.textSecondary : colors.light.textSecondary,
    };
  };

  const bannerColors = getBannerColors();

  return (
    <Animated.View entering={FadeIn} style={styles.container}>
      {/* Instructions banner */}
      <View
        style={[
          styles.banner,
          {
            backgroundColor: bannerColors.bg,
            borderColor: bannerColors.border,
          },
        ]}
      >
        <Text style={[styles.bannerText, { color: bannerColors.text }]}>
          {getInstructionText()}
        </Text>
      </View>

      {/* Region selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.regionScroll}
        style={styles.regionScrollContainer}
      >
        {regions.map((region) => (
          <RegionChip
            key={region.id}
            region={region}
            isSelected={selectedRegionId === region.id && !isRemoveCellMode}
            onPress={() => onSelectRegion(region.id)}
            onEditPress={() => onEditRegion(region.id)}
            isDark={isDark}
          />
        ))}
        <AddRegionButton onPress={onAddRegion} isDark={isDark} />
      </ScrollView>

      {/* Collapsible tools header */}
      <Pressable
        onPress={handleToggleTools}
        accessibilityLabel={showTools ? 'Hide tools' : 'Show tools'}
        accessibilityHint="Double tap to toggle tool visibility"
        accessibilityRole="button"
        accessibilityState={{ expanded: showTools }}
        style={styles.toolsToggle}
      >
        <Text style={[styles.toolsToggleText, { color: isDark ? colors.dark.textTertiary : colors.light.textTertiary }]}>
          {showTools ? 'Tools' : 'Show Tools'}
        </Text>
        {showTools ? (
          <ChevronUp size={14} color={isDark ? colors.dark.textTertiary : colors.light.textTertiary} />
        ) : (
          <ChevronDown size={14} color={isDark ? colors.dark.textTertiary : colors.light.textTertiary} />
        )}
      </Pressable>

      {/* Grid tools - collapsible */}
      {showTools && (
        <Animated.View entering={FadeIn} style={styles.toolsContainer}>
          {/* Undo/Redo row */}
          <View style={styles.toolRow}>
            <ToolButton
              icon={<Undo2 size={sizing.iconSm} color={canUndo ? (isDark ? colors.dark.textSecondary : colors.light.textSecondary) : (isDark ? colors.dark.textTertiary : colors.light.textTertiary)} />}
              label="Undo"
              onPress={onUndo ?? (() => {})}
              isDark={isDark}
              small
              isActive={false}
              disabled={!canUndo}
              accessibilityLabel={canUndo ? 'Undo last action' : 'Nothing to undo'}
            />
            <ToolButton
              icon={<Redo2 size={sizing.iconSm} color={canRedo ? (isDark ? colors.dark.textSecondary : colors.light.textSecondary) : (isDark ? colors.dark.textTertiary : colors.light.textTertiary)} />}
              label="Redo"
              onPress={onRedo ?? (() => {})}
              isDark={isDark}
              small
              isActive={false}
              disabled={!canRedo}
              accessibilityLabel={canRedo ? 'Redo last action' : 'Nothing to redo'}
            />
          </View>

          {/* Grid tools row */}
          <View style={styles.toolRow}>
            <ToolButton
              icon={<Grid3X3 size={sizing.iconSm} color={isDark ? colors.dark.textSecondary : colors.light.textSecondary} />}
              label="Grid Size"
              onPress={onGridSize}
              isDark={isDark}
              small
              accessibilityLabel="Change grid size"
              accessibilityHint="Double tap to resize the puzzle grid"
            />
            <ToolButton
              icon={<PaintBucket size={sizing.iconSm} color={paintBucketColor} />}
              label="Fill"
              onPress={onTogglePaintBucketMode ?? (() => {})}
              isDark={isDark}
              small
              isActive={isPaintBucketMode}
              activeColor={selectedRegion?.color ?? colors.primary.default}
              accessibilityLabel={isPaintBucketMode ? 'Disable paint bucket mode' : 'Enable paint bucket mode'}
              accessibilityHint="Fills connected cells with the selected region"
            />
            <ToolButton
              icon={<Trash2 size={sizing.iconSm} color={isRemoveCellMode ? '#FFFFFF' : colors.danger.default} />}
              label="Remove"
              onPress={onToggleRemoveCellMode ?? (() => {})}
              isDark={isDark}
              small
              isActive={isRemoveCellMode}
              activeColor={colors.danger.default}
              accessibilityLabel={isRemoveCellMode ? 'Disable remove mode' : 'Enable remove mode'}
              accessibilityHint="Removes cells from the grid when tapped"
            />
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  banner: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: sizing.radiusLg,
    borderWidth: 1,
  },
  bannerText: {
    fontSize: typography.sm,
    textAlign: 'center',
    fontWeight: '500',
  },
  regionScrollContainer: {
    flexGrow: 0,
  },
  regionScroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  toolsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: sizing.touchTarget,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.xl,
  },
  toolsToggleText: {
    fontSize: typography.xs,
    marginRight: spacing.xs,
  },
  toolsContainer: {
    paddingHorizontal: spacing.xl,
  },
  toolRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
});
