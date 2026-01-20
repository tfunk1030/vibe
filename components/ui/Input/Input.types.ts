/**
 * Input Component Type Definitions
 */

import { ReactNode } from 'react';
import { TextInputProps as RNTextInputProps } from 'react-native';

export interface InputProps extends Omit<RNTextInputProps, 'style'> {
  /**
   * Input value
   */
  value: string;

  /**
   * Value change handler
   */
  onChangeText: (text: string) => void;

  /**
   * Input label (floats up when focused or has value)
   */
  label?: string;

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Error message to display below input
   */
  error?: string;

  /**
   * Disabled state
   * @default false
   */
  disabled?: boolean;

  /**
   * Icon to display on the left side
   */
  leftIcon?: ReactNode;

  /**
   * Icon to display on the right side
   */
  rightIcon?: ReactNode;

  /**
   * Show clear button when input has value
   * @default false
   */
  clearable?: boolean;

  /**
   * Multiline text input (textarea)
   * @default false
   */
  multiline?: boolean;

  /**
   * Number of lines for multiline input
   * @default 4
   */
  numberOfLines?: number;

  /**
   * Accessibility label for screen readers
   */
  accessibilityLabel?: string;

  /**
   * Test ID for automated testing
   */
  testID?: string;
}
