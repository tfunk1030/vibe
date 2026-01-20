/**
 * Avatar Component Type Definitions
 */

import { ImageSourcePropType } from 'react-native';
import { ReactNode } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

export interface AvatarProps {
  /**
   * Image source for avatar
   */
  source?: ImageSourcePropType;

  /**
   * User's name for initials fallback
   * (shown when source fails or not provided)
   */
  name?: string;

  /**
   * Avatar size
   * @default 'md'
   */
  size?: AvatarSize;

  /**
   * Badge element to display (e.g., online indicator)
   */
  badge?: ReactNode;

  /**
   * Press handler (makes avatar pressable)
   */
  onPress?: () => void;

  /**
   * Accessibility label for screen readers
   */
  accessibilityLabel?: string;

  /**
   * Test ID for automated testing
   */
  testID?: string;
}
