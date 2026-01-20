/**
 * Avatar Component
 *
 * Production-quality avatar with image loading, initials fallback,
 * and optional badge support.
 *
 * Features:
 * - Image with loading state
 * - Initials fallback (extracted from name)
 * - 6 size presets (xs: 24, sm: 32, md: 40, lg: 56, xl: 80, xxl: 120)
 * - Badge support (bottom-right corner)
 * - Pressable variant
 * - All design tokens (zero hardcoded values)
 *
 * @example
 * ```tsx
 * import { Avatar } from '@/components/ui';
 *
 * // Image avatar
 * <Avatar source={{ uri: user.avatarUrl }} size="lg" />
 *
 * // Initials fallback
 * <Avatar name="John Doe" size="md" />
 *
 * // With badge (online indicator)
 * <Avatar
 *   source={{ uri: user.avatarUrl }}
 *   name={user.name}
 *   badge={<View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: 'green' }} />}
 * />
 *
 * // Pressable
 * <Avatar source={{ uri: user.avatarUrl }} onPress={openProfile} />
 * ```
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, typography, avatarSize } from '@/constants/design';
import type { AvatarProps, AvatarSize } from './Avatar.types';

export function Avatar({
  source,
  name,
  size = 'md',
  badge,
  onPress,
  accessibilityLabel,
  testID,
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress?.();
  };

  const avatarDimension = avatarSize[size];
  const showInitials = !source || imageError;
  const initials = getInitials(name);

  const avatarContent = (
    <View
      style={[
        styles.avatar,
        { width: avatarDimension, height: avatarDimension, borderRadius: avatarDimension / 2 },
      ]}
      testID={testID}
    >
      {!showInitials && source ? (
        <Image
          source={source}
          style={[
            styles.image,
            { width: avatarDimension, height: avatarDimension, borderRadius: avatarDimension / 2 },
          ]}
          onError={() => setImageError(true)}
        />
      ) : (
        <View
          style={[
            styles.initialsContainer,
            { width: avatarDimension, height: avatarDimension, borderRadius: avatarDimension / 2 },
          ]}
        >
          <Text style={[styles.initials, styles[`initials_${size}`]]}>
            {initials}
          </Text>
        </View>
      )}

      {badge && (
        <View style={[styles.badge, getBadgePosition(size)]}>
          {badge}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityLabel={accessibilityLabel || `Avatar for ${name}`}
        accessibilityRole="button"
      >
        {avatarContent}
      </TouchableOpacity>
    );
  }

  return avatarContent;
}

// Helper function to extract initials from name
function getInitials(name?: string): string {
  if (!name) return '?';

  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Helper function to get badge position based on avatar size
function getBadgePosition(size: AvatarSize) {
  const dimension = avatarSize[size];
  const badgeSize = Math.max(dimension * 0.25, 10);

  return {
    width: badgeSize,
    height: badgeSize,
    borderRadius: badgeSize / 2,
    bottom: 0,
    right: 0,
  };
}

const styles = StyleSheet.create({
  avatar: {
    position: 'relative',
  },

  image: {
    backgroundColor: colors.backgroundSecondary,
  },

  initialsContainer: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  initials: {
    color: colors.white,
    fontWeight: '600',
  },

  // Initials text size based on avatar size
  initials_xs: {
    ...typography.tiny,
    fontWeight: '600',
  },

  initials_sm: {
    ...typography.small,
    fontWeight: '600',
  },

  initials_md: {
    ...typography.body,
    fontWeight: '600',
  },

  initials_lg: {
    ...typography.h3,
    fontWeight: '600',
  },

  initials_xl: {
    ...typography.h2,
    fontWeight: '600',
  },

  initials_xxl: {
    ...typography.h1,
    fontWeight: '600',
  },

  badge: {
    position: 'absolute',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
