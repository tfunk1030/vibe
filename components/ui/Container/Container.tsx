/**
 * Container Component
 *
 * Layout wrapper with SafeAreaView integration and configurable padding.
 * Handles safe area insets for devices with notches/home indicators.
 *
 * Features:
 * - SafeAreaView integration
 * - Configurable safe area edges
 * - Padding from design tokens
 * - Center content option
 * - Background color support
 * - All design tokens (zero hardcoded values)
 *
 * @example
 * ```tsx
 * import { Container } from '@/components/ui';
 *
 * // Basic container with safe area
 * <Container safeArea>
 *   <Text>Content</Text>
 * </Container>
 *
 * // Container with padding and specific edges
 * <Container safeArea edges={['top', 'bottom']} padding="lg">
 *   <ScrollView>
 *     <Text>Scrollable content</Text>
 *   </ScrollView>
 * </Container>
 *
 * // Centered content
 * <Container safeArea center>
 *   <Text>Centered text</Text>
 * </Container>
 * ```
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/design';
import type { ContainerProps } from './Container.types';

export function Container({
  children,
  safeArea = false,
  edges = ['top', 'bottom', 'left', 'right'],
  padding,
  center = false,
  backgroundColor = colors.background,
  style,
  testID,
}: ContainerProps) {
  const containerStyle = [
    styles.container,
    padding && { padding: spacing[padding] },
    center && styles.center,
    { backgroundColor },
    style,
  ];

  if (safeArea) {
    return (
      <SafeAreaView
        edges={edges}
        style={containerStyle}
        testID={testID}
      >
        {children}
      </SafeAreaView>
    );
  }

  return (
    <View style={containerStyle} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
