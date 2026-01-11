/**
 * EmptyPuzzleState - Obsidian Arcade
 *
 * Premium onboarding experience for new users.
 */

import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Image as ImageIcon, Sparkles, Puzzle } from 'lucide-react-native';
import { GlassCard } from './ui/GlassCard';
import { GradientButton } from './ui/GradientButton';
import { TitleText, BodyText, Caption, AccentText } from './ui/Typography';
import { obsidianDark, gradients, radius, shadows } from '@/lib/theme';
import { hapticPatterns } from '@/lib/haptics';

interface EmptyPuzzleStateProps {
  isDark: boolean;
  onCamera: () => void;
  onUpload: () => void;
  onSample: () => void;
  onLShapedPuzzle: () => void;
}

export function EmptyPuzzleState({
  isDark,
  onCamera,
  onUpload,
  onSample,
  onLShapedPuzzle,
}: EmptyPuzzleStateProps) {
  // Floating animation for the icon
  const floatY = useSharedValue(0);

  React.useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1500 }),
        withTiming(0, { duration: 1500 })
      ),
      -1,
      true
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Hero Section */}
      <Animated.View
        entering={FadeInDown.delay(100).springify()}
        style={styles.heroSection}
      >
        {/* Animated Icon */}
        <Animated.View style={[styles.iconWrapper, floatStyle]}>
          <LinearGradient
            colors={gradients.indigoPurple}
            style={styles.iconGradient}
          >
            <Puzzle size={40} color="#fff" strokeWidth={1.5} />
          </LinearGradient>

          {/* Glow effect */}
          <View style={styles.iconGlow} />
        </Animated.View>

        {/* Title */}
        <TitleText style={styles.title}>PIPS SOLVER</TitleText>

        {/* Subtitle */}
        <BodyText center style={styles.subtitle}>
          Capture a NYT Pips puzzle to get an instant solution
        </BodyText>
      </Animated.View>

      {/* Action Cards */}
      <Animated.View
        entering={FadeInUp.delay(200).springify()}
        style={styles.actionsSection}
      >
        {/* Primary Action - Camera */}
        <GlassCard brassAccent padding="lg" style={styles.primaryCard}>
          <View style={styles.cardContent}>
            <View style={styles.cardIcon}>
              <Camera size={24} color={obsidianDark.accent.brass} />
            </View>
            <View style={styles.cardText}>
              <AccentText variant="brass" style={styles.cardTitle}>
                CAPTURE PUZZLE
              </AccentText>
              <Caption>Take a photo of your puzzle</Caption>
            </View>
          </View>
          <GradientButton
            onPress={() => {
              hapticPatterns.buttonPress();
              onCamera();
            }}
            variant="primary"
            fullWidth
            style={styles.cardButton}
          >
            Open Camera
          </GradientButton>
        </GlassCard>

        {/* Secondary Actions Row */}
        <View style={styles.secondaryRow}>
          {/* Upload */}
          <Pressable
            onPress={() => {
              hapticPatterns.lightTap();
              onUpload();
            }}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
          >
            <View style={styles.secondaryIcon}>
              <ImageIcon size={20} color={obsidianDark.accent.cyan} />
            </View>
            <BodyText style={styles.secondaryLabel}>Upload</BodyText>
            <Caption style={styles.secondaryCaption}>From gallery</Caption>
          </Pressable>

          {/* Sample */}
          <Pressable
            onPress={() => {
              hapticPatterns.lightTap();
              onSample();
            }}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
          >
            <View style={[styles.secondaryIcon, { backgroundColor: obsidianDark.glow.purple }]}>
              <Sparkles size={20} color={obsidianDark.accent.secondary} />
            </View>
            <BodyText style={styles.secondaryLabel}>Demo</BodyText>
            <Caption style={styles.secondaryCaption}>Try sample</Caption>
          </Pressable>
        </View>

        {/* L-Shaped Puzzle Link */}
        <Pressable
          onPress={() => {
            hapticPatterns.selectionTap();
            onLShapedPuzzle();
          }}
          style={styles.linkButton}
        >
          <Caption style={styles.linkText}>
            Try L-shaped puzzle demo
          </Caption>
        </Pressable>
      </Animated.View>

      {/* Bottom Hint */}
      <Animated.View
        entering={FadeInUp.delay(400)}
        style={styles.bottomHint}
      >
        <Caption center style={styles.hintText}>
          Works with any NYT Pips puzzle screenshot
        </Caption>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconWrapper: {
    marginBottom: 20,
    position: 'relative',
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
  iconGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: radius['2xl'],
    backgroundColor: obsidianDark.glow.indigo,
    zIndex: -1,
  },
  title: {
    marginBottom: 8,
    letterSpacing: 6,
  },
  subtitle: {
    maxWidth: 280,
    color: obsidianDark.text.secondary,
  },
  actionsSection: {
    gap: 16,
  },
  primaryCard: {
    marginBottom: 8,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(212, 168, 83, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    letterSpacing: 1,
    marginBottom: 2,
  },
  cardButton: {
    marginTop: 4,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: obsidianDark.bg.slate,
    borderRadius: radius.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: obsidianDark.border.subtle,
  },
  secondaryButtonPressed: {
    backgroundColor: obsidianDark.bg.elevated,
    transform: [{ scale: 0.98 }],
  },
  secondaryIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: obsidianDark.glow.cyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  secondaryLabel: {
    color: obsidianDark.text.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  secondaryCaption: {
    color: obsidianDark.text.muted,
  },
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkText: {
    color: obsidianDark.accent.success,
  },
  bottomHint: {
    marginTop: 32,
  },
  hintText: {
    color: obsidianDark.text.subtle,
  },
});
