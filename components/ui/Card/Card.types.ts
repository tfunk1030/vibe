/**
 * Card Component Type Definitions
 */

import { ReactNode } from 'react';
import { ImageSourcePropType, ViewStyle } from 'react-native';

export type CardVariant = 'flat' | 'elevated' | 'outlined';

export interface CardProps {
  /**
   * Card content
   */
  children: ReactNode;

  /**
   * Visual style variant
   * @default 'elevated'
   */
  variant?: CardVariant;

  /**
   * Press handler (makes card pressable)
   */
  onPress?: () => void;

  /**
   * Additional style overrides
   */
  style?: ViewStyle;

  /**
   * Test ID for automated testing
   */
  testID?: string;
}

export interface CardHeaderProps {
  /**
   * Header content
   */
  children: ReactNode;
}

export interface CardImageProps {
  /**
   * Image source
   */
  source: ImageSourcePropType;

  /**
   * Image aspect ratio (width / height)
   * @default 16/9
   */
  aspectRatio?: number;

  /**
   * Border radius for image
   * @default false (uses card's border radius)
   */
  rounded?: boolean;
}

export interface CardContentProps {
  /**
   * Content area content
   */
  children: ReactNode;
}

export interface CardFooterProps {
  /**
   * Footer content
   */
  children: ReactNode;
}
