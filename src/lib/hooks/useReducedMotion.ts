import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Hook to check if the user prefers reduced motion.
 * Use this to disable or simplify animations for accessibility.
 *
 * @example
 * const reduceMotion = useReducedMotion();
 * scale.value = reduceMotion ? 0.95 : withSpring(0.95);
 */
export function useReducedMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // Check initial value
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);

    // Listen for changes
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion
    );

    return () => subscription.remove();
  }, []);

  return reduceMotion;
}
