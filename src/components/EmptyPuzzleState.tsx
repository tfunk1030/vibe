import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Image as ImageIcon, Puzzle, Sparkles, Grid3X3 } from 'lucide-react-native';
import { colors, sizing, spacing, typography } from '@/theme/tokens';

interface EmptyPuzzleStateProps {
  isDark: boolean;
  onUpload: () => void;
  onSample: () => void;
  onLShapedPuzzle: () => void;
}

/**
 * Empty state - Screenshot-only flow.
 * One primary action (Upload Screenshot) with demo options.
 */
export function EmptyPuzzleState({
  isDark,
  onUpload,
  onSample,
  onLShapedPuzzle,
}: EmptyPuzzleStateProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(100).springify()}
      style={styles.container}
    >
      {/* Hero */}
      <View
        style={[
          styles.hero,
          { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
        ]}
      >
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)' },
          ]}
        >
          <Puzzle size={40} color={colors.primary.default} strokeWidth={1.5} />
        </View>

        <Text
          style={[styles.title, { color: isDark ? colors.dark.text : colors.light.text }]}
          accessibilityRole="header"
        >
          Pips Solver
        </Text>

        <Text
          style={[styles.subtitle, { color: isDark ? colors.dark.textSecondary : colors.light.textSecondary }]}
        >
          Take a screenshot of your NYT puzzle, upload it here, and get the solution
        </Text>
      </View>

      {/* Primary CTA */}
      <Pressable
        onPress={onUpload}
        accessibilityLabel="Upload screenshot"
        accessibilityHint="Choose a puzzle screenshot from your photo library"
        accessibilityRole="button"
        style={[styles.primaryButton, { backgroundColor: colors.primary.default }]}
      >
        <ImageIcon size={sizing.iconLg} color="#FFFFFF" />
        <Text style={styles.primaryButtonText}>Upload Screenshot</Text>
      </Pressable>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={[styles.divider, { backgroundColor: isDark ? colors.dark.border : colors.light.border }]} />
        <Text style={[styles.dividerText, { color: isDark ? colors.dark.textTertiary : colors.light.textTertiary }]}>
          or try a demo
        </Text>
        <View style={[styles.divider, { backgroundColor: isDark ? colors.dark.border : colors.light.border }]} />
      </View>

      {/* Demo Options */}
      <View style={styles.demoRow}>
        <Pressable
          onPress={onSample}
          accessibilityLabel="Try sample puzzle"
          accessibilityHint="Load a simple demo puzzle to see how it works"
          accessibilityRole="button"
          style={[
            styles.demoButton,
            {
              backgroundColor: isDark ? colors.dark.surfaceElevated : colors.light.surface,
              borderColor: isDark ? colors.dark.border : colors.light.border,
            },
          ]}
        >
          <Sparkles size={sizing.iconMd} color={colors.primary.default} />
          <Text style={[styles.demoButtonText, { color: colors.primary.default }]}>
            Simple Demo
          </Text>
        </Pressable>

        <Pressable
          onPress={onLShapedPuzzle}
          accessibilityLabel="Try multi-island puzzle"
          accessibilityHint="Load a complex demo with separate island grids"
          accessibilityRole="button"
          style={[
            styles.demoButton,
            {
              backgroundColor: isDark ? colors.dark.surfaceElevated : colors.light.surface,
              borderColor: isDark ? colors.dark.border : colors.light.border,
            },
          ]}
        >
          <Grid3X3 size={sizing.iconMd} color={colors.success.default} />
          <Text style={[styles.demoButtonText, { color: colors.success.default }]}>
            Multi-Island
          </Text>
        </Pressable>
      </View>

      {/* Footer hint */}
      <Text
        style={[styles.footerHint, { color: isDark ? colors.dark.textTertiary : colors.light.textTertiary }]}
      >
        Works with NYT Tiles and similar domino puzzles
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  hero: {
    borderRadius: sizing.radiusXl,
    padding: spacing['3xl'],
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: typography.sm,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: sizing.touchTargetPrimary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['2xl'],
    borderRadius: sizing.radiusLg,
    gap: spacing.md,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: typography.lg,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing['3xl'],
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: typography.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  demoRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  demoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: sizing.touchTarget,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: sizing.radiusMd,
    borderWidth: 1,
    gap: spacing.sm,
  },
  demoButtonText: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
  footerHint: {
    fontSize: typography.xs,
    textAlign: 'center',
    marginTop: spacing['3xl'],
  },
});
