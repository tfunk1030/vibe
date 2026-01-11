/**
 * ActionButton - Obsidian Arcade
 *
 * Premium action buttons with gradient fills and glow effects.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  interpolateColor,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { obsidianDark, gradients, radius, shadows, springs } from '@/lib/theme';
import { hapticPatterns } from '@/lib/haptics';

interface ActionButtonProps {
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: 'primary' | 'secondary' | 'warning' | 'danger';
  isDark?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ActionButton({
  onPress,
  icon,
  label,
  variant = 'primary',
  isDark = true,
  disabled = false,
  fullWidth = false,
}: ActionButtonProps) {
  const scale = useSharedValue(1);
  const glowIntensity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => {
    if (variant === 'secondary' || disabled) return {};

    const glowColor = variant === 'warning'
      ? obsidianDark.glow.amber
      : variant === 'danger'
        ? 'rgba(239, 68, 68, 0.4)'
        : obsidianDark.glow.indigo;

    return {
      shadowColor: glowColor.replace(/[\d.]+\)$/, '1)'),
      shadowOpacity: 0.6 * glowIntensity.value,
      shadowRadius: 12 * glowIntensity.value,
      shadowOffset: { width: 0, height: 4 },
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.95, springs.snappy);
    glowIntensity.value = withSpring(1.3, springs.snappy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springs.smooth);
    glowIntensity.value = withSpring(1, springs.smooth);
  };

  const handlePress = () => {
    hapticPatterns.buttonPress();
    onPress();
  };

  const getGradientColors = (): readonly [string, string] => {
    if (disabled) return ['#2a2a2a', '#1f1f1f'];
    switch (variant) {
      case 'primary':
        return gradients.indigoPurple as unknown as readonly [string, string];
      case 'warning':
        return ['#F59E0B', '#D97706'];
      case 'danger':
        return ['#EF4444', '#DC2626'];
      default:
        return ['transparent', 'transparent'];
    }
  };

  // Secondary button uses glass effect
  if (variant === 'secondary') {
    return (
      <Animated.View style={[animatedStyle, fullWidth && styles.fullWidth]}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          style={[
            styles.secondaryButton,
            disabled && styles.disabled,
          ]}
        >
          <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.buttonContent}>
            {icon}
            <Text style={[styles.label, styles.secondaryLabel]}>
              {label}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    );
  }

  // Primary, warning, danger use gradients
  return (
    <Animated.View style={[animatedStyle, glowStyle, fullWidth && styles.fullWidth]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          styles.buttonContainer,
          disabled && styles.disabled,
        ]}
      >
        <LinearGradient
          colors={getGradientColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.buttonContent}>
            {icon}
            <Text style={[styles.label, styles.gradientLabel]}>
              {label}
            </Text>
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullWidth: {
    flex: 1,
  },
  buttonContainer: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  gradient: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: radius.lg,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  gradientLabel: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  secondaryButton: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: obsidianDark.border.default,
    backgroundColor: obsidianDark.bg.slate,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  secondaryLabel: {
    color: obsidianDark.text.primary,
  },
  disabled: {
    opacity: 0.5,
  },
});
