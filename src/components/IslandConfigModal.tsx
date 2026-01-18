import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from 'react-native';
import Animated, { SlideInDown, SlideOutDown, FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Layers, Minus, Plus, ArrowRight, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { IslandConfig } from '@/lib/types/puzzle';
import { colors, sizing, spacing, typography } from '@/theme/tokens';

interface IslandConfigModalProps {
  visible: boolean;
  onConfirm: (configs: IslandConfig[]) => void;
  onClose: () => void;
  isDark: boolean;
}

function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
  isDark,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  isDark: boolean;
}) {
  const handleDecrease = useCallback(() => {
    if (value > min) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(value - 1);
    }
  }, [value, min, onChange]);

  const handleIncrease = useCallback(() => {
    if (value < max) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(value + 1);
    }
  }, [value, max, onChange]);

  const bgColor = isDark ? colors.dark.surfaceElevated : colors.light.border;
  const bgDisabled = isDark ? colors.dark.surface : colors.light.background;
  const iconColor = isDark ? colors.dark.text : colors.light.text;
  const labelColor = isDark ? colors.dark.textSecondary : colors.light.textSecondary;

  return (
    <View style={stepperStyles.container}>
      <Text style={[stepperStyles.label, { color: labelColor }]}>
        {label}
      </Text>
      <Pressable
        onPress={handleDecrease}
        disabled={value <= min}
        accessibilityLabel={`Decrease ${label} from ${value}`}
        accessibilityHint="Double tap to decrease value by 1"
        accessibilityRole="button"
        accessibilityState={{ disabled: value <= min }}
        style={[
          stepperStyles.button,
          {
            backgroundColor: value <= min ? bgDisabled : bgColor,
            opacity: value <= min ? 0.5 : 1,
          },
        ]}
      >
        <Minus size={sizing.iconMd} color={iconColor} />
      </Pressable>
      <Text
        style={[stepperStyles.value, { color: isDark ? colors.dark.text : colors.light.text }]}
        accessibilityLabel={`${label}: ${value}`}
      >
        {value}
      </Text>
      <Pressable
        onPress={handleIncrease}
        disabled={value >= max}
        accessibilityLabel={`Increase ${label} from ${value}`}
        accessibilityHint="Double tap to increase value by 1"
        accessibilityRole="button"
        accessibilityState={{ disabled: value >= max }}
        style={[
          stepperStyles.button,
          {
            backgroundColor: value >= max ? bgDisabled : bgColor,
            opacity: value >= max ? 0.5 : 1,
          },
        ]}
      >
        <Plus size={sizing.iconMd} color={iconColor} />
      </Pressable>
    </View>
  );
}

const stepperStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: '600',
    width: 24,
  },
  button: {
    minWidth: sizing.touchTarget,
    minHeight: sizing.touchTarget,
    width: sizing.touchTarget,
    height: sizing.touchTarget,
    borderRadius: sizing.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: typography['2xl'],
    fontWeight: '700',
    width: 40,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});

function IslandCard({
  index,
  config,
  onUpdate,
  onRemove,
  canRemove,
  isDark,
}: {
  index: number;
  config: IslandConfig;
  onUpdate: (cols: number, rows: number) => void;
  onRemove: () => void;
  canRemove: boolean;
  isDark: boolean;
}) {
  const handleRemove = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRemove();
  }, [onRemove]);

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      layout={Layout.springify().damping(20)}
      style={[
        cardStyles.container,
        {
          backgroundColor: isDark ? colors.dark.surfaceElevated : colors.light.background,
          borderColor: isDark ? colors.dark.borderStrong : colors.light.border,
        },
      ]}
    >
      {/* Header */}
      <View style={cardStyles.header}>
        <View style={cardStyles.headerLeft}>
          <View style={[cardStyles.badge, { backgroundColor: colors.primary.default }]}>
            <Text style={cardStyles.badgeText}>{index + 1}</Text>
          </View>
          <Text
            style={[cardStyles.title, { color: isDark ? colors.dark.text : colors.light.text }]}
            accessibilityRole="header"
          >
            Island {index + 1}
          </Text>
        </View>
        {canRemove && (
          <Pressable
            onPress={handleRemove}
            accessibilityLabel={`Remove Island ${index + 1}`}
            accessibilityHint="Double tap to delete this island"
            accessibilityRole="button"
            hitSlop={spacing.sm}
            style={[
              cardStyles.removeButton,
              { backgroundColor: isDark ? colors.dark.surface : colors.light.border },
            ]}
          >
            <Trash2 size={sizing.iconMd} color={colors.danger.default} />
          </Pressable>
        )}
      </View>

      {/* Dimensions */}
      <View style={cardStyles.dimensions}>
        <NumberStepper
          label="W"
          value={config.cols}
          onChange={(cols) => onUpdate(cols, config.rows)}
          min={1}
          max={12}
          isDark={isDark}
        />
        <Text style={[cardStyles.separator, { color: isDark ? colors.dark.textTertiary : colors.light.textTertiary }]}>
          ×
        </Text>
        <NumberStepper
          label="H"
          value={config.rows}
          onChange={(rows) => onUpdate(config.cols, rows)}
          min={1}
          max={12}
          isDark={isDark}
        />
      </View>
    </Animated.View>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    borderRadius: sizing.radiusXl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: typography.lg,
  },
  title: {
    fontSize: typography.lg,
    fontWeight: '600',
  },
  removeButton: {
    minWidth: sizing.touchTarget,
    minHeight: sizing.touchTarget,
    padding: spacing.md,
    borderRadius: sizing.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimensions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  separator: {
    fontSize: 28,
    fontWeight: '300',
  },
});

export function IslandConfigModal({
  visible,
  onConfirm,
  onClose,
  isDark,
}: IslandConfigModalProps) {
  const insets = useSafeAreaInsets();
  const [islands, setIslands] = useState<IslandConfig[]>([
    { id: '1', cols: 4, rows: 4 },
  ]);

  const handleAddIsland = useCallback(() => {
    if (islands.length >= 5) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIslands([
      ...islands,
      { id: String(Date.now()), cols: 4, rows: 4 },
    ]);
  }, [islands]);

  const handleRemoveIsland = useCallback((index: number) => {
    if (islands.length <= 1) return;
    setIslands(islands.filter((_, i) => i !== index));
  }, [islands]);

  const handleUpdateIsland = useCallback((index: number, cols: number, rows: number) => {
    setIslands(
      islands.map((island, i) =>
        i === index ? { ...island, cols, rows } : island
      )
    );
  }, [islands]);

  const handleConfirm = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm(islands);
  }, [islands, onConfirm]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: isDark ? colors.dark.overlay : colors.light.overlay }]}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close modal"
          accessibilityHint="Tap to dismiss"
          accessibilityRole="button"
        />
        <Animated.View entering={SlideInDown.springify().damping(20)} exiting={SlideOutDown}>
          <View
            style={[
              styles.modal,
              {
                backgroundColor: isDark ? colors.dark.surface : colors.light.surface,
                paddingBottom: Math.max(insets.bottom, spacing['2xl']),
              },
            ]}
          >
            {/* Handle bar */}
            <View style={styles.handleContainer}>
              <View style={[styles.handle, { backgroundColor: isDark ? colors.dark.borderStrong : colors.light.border }]} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Layers size={sizing.iconLg} color={isDark ? colors.dark.text : colors.light.text} />
                <Text
                  style={[styles.headerTitle, { color: isDark ? colors.dark.text : colors.light.text }]}
                  accessibilityRole="header"
                >
                  Configure Islands
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityLabel="Close island configuration"
                accessibilityRole="button"
                hitSlop={spacing.sm}
                style={styles.closeButton}
              >
                <X size={sizing.iconLg} color={isDark ? colors.dark.textSecondary : colors.light.textSecondary} />
              </Pressable>
            </View>

            {/* Description */}
            <View style={styles.description}>
              <Text style={[styles.descriptionText, { color: isDark ? colors.dark.textSecondary : colors.light.textSecondary }]}>
                Set up each island's dimensions. You'll crop each island separately from your photo.
              </Text>
            </View>

            {/* Islands List */}
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              bounces={true}
              nestedScrollEnabled={true}
            >
              {islands.map((island, index) => (
                <IslandCard
                  key={island.id}
                  index={index}
                  config={island}
                  onUpdate={(cols, rows) => handleUpdateIsland(index, cols, rows)}
                  onRemove={() => handleRemoveIsland(index)}
                  canRemove={islands.length > 1}
                  isDark={isDark}
                />
              ))}

              {/* Add Island Button */}
              {islands.length < 5 && (
                <Pressable
                  onPress={handleAddIsland}
                  accessibilityLabel={`Add island. ${islands.length} of 5 islands configured`}
                  accessibilityHint="Double tap to add another island"
                  accessibilityRole="button"
                  style={[
                    styles.addButton,
                    { borderColor: isDark ? colors.dark.borderStrong : colors.light.border },
                  ]}
                >
                  <Plus size={sizing.iconMd} color={isDark ? colors.dark.textSecondary : colors.light.textSecondary} />
                  <Text style={[styles.addButtonText, { color: isDark ? colors.dark.textSecondary : colors.light.textSecondary }]}>
                    Add Island ({islands.length}/5)
                  </Text>
                </Pressable>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: isDark ? colors.dark.border : colors.light.border }]}>
              <Text style={[styles.footerNote, { color: isDark ? colors.dark.textTertiary : colors.light.textTertiary }]}>
                Dimensions are bounding boxes. Islands can have holes (irregular shapes like letters).
              </Text>

              <Pressable
                onPress={handleConfirm}
                accessibilityLabel="Continue to crop islands"
                accessibilityRole="button"
                style={[styles.confirmButton, { backgroundColor: colors.primary.default }]}
              >
                <Text style={styles.confirmButtonText}>Continue to Crop</Text>
                <ArrowRight size={sizing.iconMd} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modal: {
    borderTopLeftRadius: sizing.radiusXl,
    borderTopRightRadius: sizing.radiusXl,
    maxHeight: '80%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerTitle: {
    fontSize: typography.xl,
    fontWeight: '700',
  },
  closeButton: {
    minWidth: sizing.touchTarget,
    minHeight: sizing.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  descriptionText: {
    fontSize: typography.sm,
    lineHeight: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: sizing.touchTargetPrimary,
    paddingVertical: spacing.lg,
    borderRadius: sizing.radiusLg,
    borderWidth: 2,
    borderStyle: 'dashed',
    gap: spacing.sm,
  },
  addButtonText: {
    fontWeight: '600',
    fontSize: typography.base,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
  footerNote: {
    fontSize: typography.xs,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: sizing.touchTargetPrimary,
    paddingVertical: spacing.lg,
    borderRadius: sizing.radiusMd,
    gap: spacing.sm,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: typography.lg,
  },
});
