import React, { useCallback } from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, sizing, spacing, typography } from '@/theme/tokens';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';

interface ActionButtonProps {
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: 'primary' | 'secondary' | 'warning';
  isDark: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}

/**
 * Primary action button with icon and label.
 *
 * - 48dp minimum height touch target
 * - Haptic feedback on press
 * - Reduced motion support
 * - Uses theme tokens for colors
 */
export function ActionButton({
  onPress,
  icon,
  label,
  variant = 'primary',
  isDark,
  disabled = false,
  accessibilityHint,
}: ActionButtonProps) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (reduceMotion) {
      scale.value = 0.95;
    } else {
      scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
    }
    if (!disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [disabled, reduceMotion, scale]);

  const handlePressOut = useCallback(() => {
    if (reduceMotion) {
      scale.value = 1;
    } else {
      scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    }
  }, [reduceMotion, scale]);

  const getBackgroundColor = () => {
    if (disabled) {
      return isDark ? colors.dark.surfaceElevated : colors.light.border;
    }
    if (variant === 'primary') return colors.primary.default;
    if (variant === 'warning') return colors.warning.default;
    return isDark ? colors.dark.surfaceElevated : colors.light.surface;
  };

  const getTextColor = () => {
    if (disabled) {
      return isDark ? colors.dark.textTertiary : colors.light.textTertiary;
    }
    if (variant === 'primary' || variant === 'warning') {
      return '#FFFFFF';
    }
    return isDark ? colors.dark.text : colors.light.text;
  };

  return (
    <Animated.View style={[animatedStyle, styles.wrapper]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityLabel={label}
        accessibilityHint={accessibilityHint}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        style={[
          styles.button,
          {
            backgroundColor: getBackgroundColor(),
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {icon}
        <Text style={[styles.label, { color: getTextColor() }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: sizing.touchTarget,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: sizing.radiusLg,
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.sm,
    fontWeight: '600',
  },
});
