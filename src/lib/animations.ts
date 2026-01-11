/**
 * Animation Presets - Obsidian Arcade
 *
 * Reusable animation configurations for react-native-reanimated.
 */

import {
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  Easing,
  SharedValue,
  WithSpringConfig,
  WithTimingConfig,
} from 'react-native-reanimated';
import { springs, timing } from './theme';

// ==========================================
// Spring Presets
// ==========================================

export const springPresets = {
  /** Snappy, responsive feel */
  snappy: springs.snappy,
  /** Bouncy, playful feel */
  bouncy: springs.bouncy,
  /** Smooth, elegant feel */
  smooth: springs.smooth,
  /** Gentle, slow feel */
  gentle: springs.gentle,
} as const;

// ==========================================
// Entry Animations
// ==========================================

/**
 * Fade in animation
 */
export const fadeIn = (delay: number = 0) => ({
  opacity: withDelay(delay, withTiming(1, { duration: timing.normal })),
});

/**
 * Scale up from center
 */
export const scaleIn = (delay: number = 0) => ({
  opacity: withDelay(delay, withTiming(1, { duration: timing.normal })),
  transform: [
    { scale: withDelay(delay, withSpring(1, springs.snappy)) },
  ],
});

/**
 * Slide up from bottom
 */
export const slideUp = (delay: number = 0, distance: number = 50) => ({
  opacity: withDelay(delay, withTiming(1, { duration: timing.normal })),
  transform: [
    { translateY: withDelay(delay, withSpring(0, springs.smooth)) },
  ],
});

/**
 * Staggered grid cell entry - cascading reveal
 */
export const staggeredEntry = (row: number, col: number, columns: number) => {
  const index = row * columns + col;
  const delay = index * 30; // 30ms stagger between cells

  return {
    initialValues: {
      opacity: 0,
      transform: [{ scale: 0.8 }],
    },
    animations: {
      opacity: withDelay(delay, withTiming(1, { duration: 200 })),
      transform: [
        { scale: withDelay(delay, withSpring(1, springs.snappy)) },
      ],
    },
  };
};

// ==========================================
// Interactive Animations
// ==========================================

/**
 * Button press animation
 */
export const buttonPress = {
  in: {
    scale: withSpring(0.95, springs.snappy),
  },
  out: {
    scale: withSpring(1, springs.smooth),
  },
};

/**
 * Cell tap ripple effect
 */
export const cellTap = {
  scale: withSequence(
    withSpring(0.9, { damping: 8, stiffness: 400 }),
    withSpring(1, { damping: 12, stiffness: 200 })
  ),
};

/**
 * Selection pulse animation
 */
export const selectionPulse = (isSelected: boolean) => {
  if (!isSelected) return {};

  return {
    scale: withRepeat(
      withSequence(
        withTiming(1.02, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1,
      true
    ),
  };
};

// ==========================================
// Celebration Animations
// ==========================================

/**
 * Victory pulse - grid celebration
 */
export const victoryPulse = () => ({
  scale: withSequence(
    withSpring(1.03, { damping: 8, stiffness: 300 }),
    withSpring(1, { damping: 10, stiffness: 200 })
  ),
});

/**
 * Success checkmark animation
 */
export const successCheck = (delay: number = 0) => ({
  opacity: withDelay(delay, withTiming(1, { duration: 200 })),
  transform: [
    { scale: withDelay(delay, withSpring(1, springs.bouncy)) },
  ],
});

// ==========================================
// Loading Animations
// ==========================================

/**
 * Skeleton pulse animation
 */
export const skeletonPulse = () => ({
  opacity: withRepeat(
    withSequence(
      withTiming(0.4, { duration: 800, easing: Easing.ease }),
      withTiming(0.8, { duration: 800, easing: Easing.ease })
    ),
    -1,
    true
  ),
});

/**
 * Spinner rotation
 */
export const spinnerRotate = () => ({
  transform: [
    {
      rotate: withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      ),
    },
  ],
});

/**
 * Progress bar glow pulse
 */
export const progressGlow = () => ({
  shadowOpacity: withRepeat(
    withSequence(
      withTiming(0.4, { duration: 500 }),
      withTiming(0.8, { duration: 500 })
    ),
    -1,
    true
  ),
});

// ==========================================
// Domino Animations
// ==========================================

/**
 * Domino placement animation
 */
export const dominoPlace = (targetX: number, targetY: number) => ({
  translateX: withSpring(targetX, springs.snappy),
  translateY: withSpring(targetY, springs.snappy),
  scale: withSequence(
    withSpring(1.1, { damping: 8, stiffness: 300 }),
    withSpring(1, { damping: 12, stiffness: 200 })
  ),
});

/**
 * Domino remove animation
 */
export const dominoRemove = () => ({
  opacity: withTiming(0, { duration: 150 }),
  scale: withTiming(0.8, { duration: 150 }),
});

/**
 * Domino hover/selected state
 */
export const dominoSelected = () => ({
  scale: withSpring(1.05, springs.snappy),
  translateY: withSpring(-4, springs.snappy),
});

// ==========================================
// Toast Animations
// ==========================================

/**
 * Toast slide in from top
 */
export const toastSlideIn = () => ({
  translateY: withSpring(0, springs.smooth),
  opacity: withTiming(1, { duration: timing.fast }),
});

/**
 * Toast slide out to top
 */
export const toastSlideOut = () => ({
  translateY: withSpring(-100, springs.smooth),
  opacity: withTiming(0, { duration: timing.fast }),
});

// ==========================================
// Utility Functions
// ==========================================

/**
 * Create staggered delays for a list of items
 */
export const getStaggerDelay = (index: number, baseDelay: number = 50) => {
  return index * baseDelay;
};

/**
 * Animate a shared value with spring
 */
export const animateSpring = (
  value: SharedValue<number>,
  toValue: number,
  config: WithSpringConfig = springs.snappy
) => {
  'worklet';
  value.value = withSpring(toValue, config);
};

/**
 * Animate a shared value with timing
 */
export const animateTiming = (
  value: SharedValue<number>,
  toValue: number,
  config: WithTimingConfig = { duration: timing.normal }
) => {
  'worklet';
  value.value = withTiming(toValue, config);
};
