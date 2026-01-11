/**
 * Haptic Feedback Patterns - Obsidian Arcade
 *
 * Tactile feedback patterns for iOS.
 * Makes every interaction feel satisfying and premium.
 */

import * as Haptics from 'expo-haptics';

// ==========================================
// Basic Haptic Functions
// ==========================================

/**
 * Light tap - for subtle selections
 */
export const lightTap = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

/**
 * Medium tap - for button presses
 */
export const mediumTap = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

/**
 * Heavy tap - for important actions
 */
export const heavyTap = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
};

/**
 * Selection change feedback
 */
export const selectionTap = () => {
  Haptics.selectionAsync();
};

// ==========================================
// Notification Haptics
// ==========================================

/**
 * Success notification
 */
export const success = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

/**
 * Warning notification
 */
export const warning = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
};

/**
 * Error notification
 */
export const error = () => {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
};

// ==========================================
// Complex Patterns
// ==========================================

/**
 * Helper to delay between haptic events
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Solve celebration - triple pulse pattern
 * Used when puzzle is successfully solved
 */
export const solveCelebration = async () => {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  await delay(100);
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  await delay(50);
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

/**
 * Domino placement confirmation
 */
export const dominoPlace = async () => {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  await delay(50);
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

/**
 * Domino removal
 */
export const dominoRemove = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

/**
 * Invalid action - soft warning
 */
export const invalidAction = async () => {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  await delay(100);
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

/**
 * Button press feedback
 */
export const buttonPress = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

/**
 * Scroll tick - for picker-style scrolling
 */
export const scrollTick = () => {
  Haptics.selectionAsync();
};

/**
 * Long press activation
 */
export const longPress = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
};

/**
 * Extraction progress tick - subtle feedback during loading
 */
export const progressTick = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

/**
 * Camera capture
 */
export const cameraCapture = async () => {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  await delay(50);
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

// ==========================================
// Exported Pattern Object
// ==========================================

export const hapticPatterns = {
  // Basic
  lightTap,
  mediumTap,
  heavyTap,
  selectionTap,

  // Notifications
  success,
  warning,
  error,

  // Complex patterns
  solveCelebration,
  dominoPlace,
  dominoRemove,
  invalidAction,
  buttonPress,
  scrollTick,
  longPress,
  progressTick,
  cameraCapture,
} as const;

export default hapticPatterns;
