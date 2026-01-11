/**
 * GradientButton - Premium Action Button
 *
 * Gradient-filled button with glow effects for the Obsidian Arcade theme.
 */

import React from 'react';
import { Pressable, View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ButtonText } from './Typography';
import { obsidianDark, gradients, radius, shadows, springs } from '@/lib/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'glass';
type ButtonSize = 'sm' | 'md' | 'lg';

interface GradientButtonProps {
  children: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  style?: ViewStyle;
}

const variantGradients: Record<ButtonVariant, readonly [string, string, ...string[]]> = {
  primary: gradients.indigoPurple,
  secondary: ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)'],
  success: gradients.emerald,
  danger: gradients.danger,
  glass: ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.04)'],
};

const variantGlowColors: Record<ButtonVariant, string> = {
  primary: obsidianDark.glow.indigo,
  secondary: 'transparent',
  success: obsidianDark.glow.emerald,
  danger: 'rgba(239, 68, 68, 0.4)',
  glass: 'transparent',
};

const sizeStyles: Record<ButtonSize, { height: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { height: 40, paddingHorizontal: 16, fontSize: 14 },
  md: { height: 52, paddingHorizontal: 24, fontSize: 16 },
  lg: { height: 60, paddingHorizontal: 32, fontSize: 18 },
};

export function GradientButton({
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  style,
}: GradientButtonProps) {
  const pressed = useSharedValue(0);
  const sizeConfig = sizeStyles[size];

  const handlePressIn = () => {
    pressed.value = withSpring(1, springs.snappy);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handlePressOut = () => {
    pressed.value = withSpring(0, springs.smooth);
  };

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressed.value, [0, 1], [1, 0.96]);
    const shadowOpacity = interpolate(pressed.value, [0, 1], [0.4, 0.8]);

    return {
      transform: [{ scale }],
      shadowOpacity,
    };
  });

  const glowColor = variantGlowColors[variant];
  const isGlass = variant === 'glass' || variant === 'secondary';

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        styles.container,
        { height: sizeConfig.height },
        fullWidth && styles.fullWidth,
        !isGlass && {
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 12,
        },
        disabled && styles.disabled,
        animatedStyle,
        style,
      ]}
    >
      <LinearGradient
        colors={disabled ? ['#333', '#222'] : variantGradients[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradient,
          { paddingHorizontal: sizeConfig.paddingHorizontal },
          isGlass && styles.glassBorder,
        ]}
      >
        {icon && <View style={styles.icon}>{icon}</View>}
        <ButtonText
          style={[
            { fontSize: sizeConfig.fontSize },
            disabled && styles.disabledText,
          ]}
        >
          {loading ? 'LOADING...' : children.toUpperCase()}
        </ButtonText>
      </LinearGradient>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  gradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  glassBorder: {
    borderWidth: 1,
    borderColor: obsidianDark.border.default,
  },
  icon: {
    marginRight: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    color: obsidianDark.text.subtle,
  },
});
