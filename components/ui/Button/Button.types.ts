/**
 * Button Component Type Definitions
 */

import { ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  /**
   * Button content (text or elements)
   */
  children: ReactNode;

  /**
   * Visual style variant
   * @default 'primary'
   */
  variant?: ButtonVariant;

  /**
   * Button size
   * @default 'md'
   */
  size?: ButtonSize;

  /**
   * Disabled state
   * @default false
   */
  disabled?: boolean;

  /**
   * Loading state - shows spinner and disables interaction
   * @default false
   */
  loading?: boolean;

  /**
   * Press handler
   */
  onPress?: () => void;

  /**
   * Stretch button to full width of container
   * @default false
   */
  fullWidth?: boolean;

  /**
   * Icon to display on the left side
   */
  leftIcon?: ReactNode;

  /**
   * Icon to display on the right side
   */
  rightIcon?: ReactNode;

  /**
   * Accessibility label for screen readers
   */
  accessibilityLabel?: string;

  /**
   * Test ID for automated testing
   */
  testID?: string;
}
