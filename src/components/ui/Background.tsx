/**
 * Background Components - Obsidian Arcade
 *
 * Atmospheric background gradients and effects.
 */

import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { gradients } from '@/lib/theme';

// ==========================================
// Obsidian Background
// ==========================================

interface ObsidianBackgroundProps {
  children?: React.ReactNode;
  style?: ViewStyle;
  /** Add subtle animated grain texture */
  withGrain?: boolean;
}

export function ObsidianBackground({
  children,
  style,
  withGrain = false,
}: ObsidianBackgroundProps) {
  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={gradients.obsidianBg}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      {withGrain && <GrainOverlay />}

      {children}
    </View>
  );
}

// ==========================================
// Grain Overlay (subtle texture)
// ==========================================

function GrainOverlay() {
  const opacity = useSharedValue(0.03);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.06, { duration: 2000, easing: Easing.ease }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.grain, animatedStyle]} pointerEvents="none" />
  );
}

// ==========================================
// Accent Glow
// ==========================================

interface AccentGlowProps {
  color?: string;
  position?: 'top' | 'bottom' | 'center';
  intensity?: number;
}

export function AccentGlow({
  color = 'rgba(99, 102, 241, 0.15)',
  position = 'top',
  intensity = 1,
}: AccentGlowProps) {
  const getPositionStyle = () => {
    switch (position) {
      case 'top': return { top: -100 };
      case 'bottom': return { bottom: -100 };
      case 'center': return { top: '40%' as const };
    }
  };

  return (
    <View
      style={[
        styles.glow,
        getPositionStyle(),
        {
          backgroundColor: color,
          opacity: 0.5 * intensity,
          transform: [{ scaleX: 2 }],
        },
      ]}
      pointerEvents="none"
    />
  );
}

// ==========================================
// Card Background
// ==========================================

interface CardBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated';
}

export function CardBackground({
  children,
  style,
  variant = 'default',
}: CardBackgroundProps) {
  const bgColors: Record<'default' | 'elevated', readonly [string, string]> = {
    default: ['#12121a', '#0f0f15'],
    elevated: ['#1a1a24', '#141420'],
  };

  return (
    <View style={[styles.card, style]}>
      <LinearGradient
        colors={bgColors[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

// ==========================================
// Styles
// ==========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  grain: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    // In a real app, you'd use a noise texture image
  },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    alignSelf: 'center',
  },
  card: {
    overflow: 'hidden',
  },
});
