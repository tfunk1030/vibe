/**
 * Container Component Type Definitions
 */

import { ReactNode } from 'react';
import { ViewStyle } from 'react-native';

export type ContainerPadding = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
export type SafeAreaEdges = 'top' | 'bottom' | 'left' | 'right';

export interface ContainerProps {
  /**
   * Container content
   */
  children: ReactNode;

  /**
   * Apply safe area insets
   * @default false
   */
  safeArea?: boolean;

  /**
   * Which edges to apply safe area insets to
   * @default ['top', 'bottom', 'left', 'right']
   */
  edges?: SafeAreaEdges[];

  /**
   * Padding size from spacing scale
   * @default undefined (no padding)
   */
  padding?: ContainerPadding;

  /**
   * Center content horizontally and vertically
   * @default false
   */
  center?: boolean;

  /**
   * Background color
   * @default colors.background
   */
  backgroundColor?: string;

  /**
   * Additional style overrides
   */
  style?: ViewStyle;

  /**
   * Test ID for automated testing
   */
  testID?: string;
}
