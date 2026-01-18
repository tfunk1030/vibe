import React, { useCallback } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, sizing } from '@/theme/tokens';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';

type IconButtonVariant = 'default' | 'primary' | 'danger' | 'ghost';
type IconButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  disabled?: boolean;
  isDark?: boolean;
  style?: ViewStyle;
}

const SIZES: Record<IconButtonSize, { minSize: number; padding: number }> = {
  sm: { minSize: sizing.touchTarget, padding: 12 },
  md: { minSize: sizing.touchTarget, padding: 12 },
  lg: { minSize: sizing.touchTargetPrimary, padding: 16 },
};

/**
 * Accessible icon button with proper touch targets and animations.
 *
 * - 48dp minimum touch target (56dp for lg)
 * - Haptic feedback on press
 * - Reduced motion support
 * - Required accessibility label
 */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  variant = 'default',
  size = 'md',
  disabled = false,
  isDark = false,
  style,
}: IconButtonProps) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const handlePressIn = useCallback(() => {
    if (reduceMotion) {
      scale.value = 0.95;
    } else {
      scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
    }
  }, [reduceMotion, scale]);

  const handlePressOut = useCallback(() => {
    if (reduceMotion) {
      scale.value = 1;
    } else {
      scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    }
  }, [reduceMotion, scale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const { minSize, padding } = SIZES[size];

  const getBackgroundColor = () => {
    if (disabled) {
      return isDark ? colors.dark.surfaceElevated : colors.light.border;
    }
    switch (variant) {
      case 'primary':
        return colors.primary.default;
      case 'danger':
        return colors.danger.default;
      case 'ghost':
        return 'transparent';
      default:
        return isDark ? colors.dark.surfaceElevated : colors.light.surface;
    }
  };

  const getBorderColor = () => {
    if (variant === 'ghost') return 'transparent';
    if (disabled) return 'transparent';
    return isDark ? colors.dark.border : colors.light.border;
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        style={[
          styles.button,
          {
            minWidth: minSize,
            minHeight: minSize,
            padding,
            backgroundColor: getBackgroundColor(),
            borderColor: getBorderColor(),
            opacity: disabled ? 0.5 : 1,
          },
          style,
        ]}
      >
        {icon}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sizing.radiusMd,
    borderWidth: 1,
  },
});
