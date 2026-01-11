/**
 * ExtractionProgress - Obsidian Arcade
 *
 * Premium loading experience with animated gradients and glow effects.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Scan, Puzzle, Grid3X3, Sparkles } from 'lucide-react-native';
import type { ExtractionStage } from '@/lib/services/gemini';
import { obsidianDark, gradients, radius, springs } from '@/lib/theme';
import { hapticPatterns } from '@/lib/haptics';

interface ExtractionProgressProps {
  stage: ExtractionStage;
  isDark?: boolean;
}

const stageConfig: Record<ExtractionStage, {
  text: string;
  subtext: string;
  progress: number;
  icon: typeof Scan;
  color: string;
}> = {
  idle: {
    text: 'Preparing...',
    subtext: '',
    progress: 0,
    icon: Scan,
    color: obsidianDark.accent.cyan,
  },
  cropping: {
    text: 'Processing Images',
    subtext: 'Optimizing for analysis',
    progress: 10,
    icon: Scan,
    color: obsidianDark.accent.cyan,
  },
  dominoes: {
    text: 'Reading Domino Pips',
    subtext: 'Analyzing tile patterns',
    progress: 25,
    icon: Puzzle,
    color: obsidianDark.accent.secondary,
  },
  grid: {
    text: 'Analyzing Puzzle Grid',
    subtext: 'This takes about 60 seconds',
    progress: 50,
    icon: Grid3X3,
    color: obsidianDark.accent.primary,
  },
  solving: {
    text: 'Finding Solution',
    subtext: 'Almost done!',
    progress: 95,
    icon: Sparkles,
    color: obsidianDark.accent.success,
  },
};

export function ExtractionProgress({ stage, isDark = true }: ExtractionProgressProps) {
  const config = stageConfig[stage] || stageConfig.idle;
  const stages: ExtractionStage[] = ['cropping', 'dominoes', 'grid', 'solving'];
  const allStages: ExtractionStage[] = ['idle', 'cropping', 'dominoes', 'grid', 'solving'];
  const currentIndex = allStages.indexOf(stage);

  // Pulsing animation for icon
  const iconPulse = useSharedValue(1);
  const iconRotate = useSharedValue(0);

  // Progress bar glow
  const progressGlow = useSharedValue(0);

  useEffect(() => {
    // Icon pulse animation
    iconPulse.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800, easing: Easing.ease }),
        withTiming(1, { duration: 800, easing: Easing.ease })
      ),
      -1,
      true
    );

    // Gentle rotation for visual interest
    iconRotate.value = withRepeat(
      withSequence(
        withTiming(5, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(-5, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Progress bar glow pulse
    progressGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 500 }),
        withTiming(0.4, { duration: 500 })
      ),
      -1,
      true
    );

    // Haptic tick on stage change
    hapticPatterns.progressTick();

    return () => {
      cancelAnimation(iconPulse);
      cancelAnimation(iconRotate);
      cancelAnimation(progressGlow);
    };
  }, [stage]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    opacity: iconPulse.value,
    transform: [{ rotate: `${iconRotate.value}deg` }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(progressGlow.value, [0, 1], [0.3, 0.8]),
  }));

  const Icon = config.icon;

  return (
    <Animated.View
      entering={FadeIn.springify()}
      style={styles.container}
    >
      {/* Animated Icon */}
      <Animated.View style={[styles.iconWrapper, iconAnimatedStyle]}>
        <LinearGradient
          colors={[config.color, obsidianDark.accent.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconGradient}
        >
          <Icon size={32} color="#fff" strokeWidth={1.5} />
        </LinearGradient>

        {/* Icon glow */}
        <View
          style={[
            styles.iconGlow,
            { backgroundColor: config.color + '40' },
          ]}
        />
      </Animated.View>

      {/* Stage Text */}
      <Text style={styles.stageText}>{config.text}</Text>

      {/* Subtext */}
      {config.subtext ? (
        <Text style={styles.subtext}>{config.subtext}</Text>
      ) : (
        <View style={styles.subtextSpacer} />
      )}

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressBar,
              glowAnimatedStyle,
              {
                width: `${config.progress}%`,
                shadowColor: config.color,
              },
            ]}
          >
            <LinearGradient
              colors={gradients.indigoPurple as unknown as readonly [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        <Text style={styles.progressText}>{config.progress}% complete</Text>
      </View>

      {/* Stage Indicators */}
      <View style={styles.stageIndicators}>
        {stages.map((s, index) => {
          const stageIndex = allStages.indexOf(s);
          const isActive = stageIndex <= currentIndex && stage !== 'idle';
          const isCurrent = s === stage;
          const isCompleted = stageIndex < currentIndex;

          return (
            <View key={s} style={styles.stageIndicatorRow}>
              <View
                style={[
                  styles.stageDot,
                  isCurrent && styles.stageDotCurrent,
                  isCompleted && styles.stageDotCompleted,
                  !isActive && styles.stageDotInactive,
                ]}
              />
              {index < stages.length - 1 && (
                <View
                  style={[
                    styles.stageLine,
                    isCompleted && styles.stageLineCompleted,
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>

      {/* Stage Labels */}
      <View style={styles.stageLabels}>
        {stages.map((s) => {
          const stageIndex = allStages.indexOf(s);
          const isCurrent = s === stage;
          const isCompleted = stageIndex < currentIndex;

          return (
            <Text
              key={s}
              style={[
                styles.stageLabel,
                isCurrent && styles.stageLabelActive,
                isCompleted && styles.stageLabelCompleted,
              ]}
            >
              {s === 'cropping' ? 'Prep' :
               s === 'dominoes' ? 'Pips' :
               s === 'grid' ? 'Grid' : 'Solve'}
            </Text>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  iconWrapper: {
    marginBottom: 24,
    position: 'relative',
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlow: {
    position: 'absolute',
    top: -12,
    left: -12,
    right: -12,
    bottom: -12,
    borderRadius: radius['2xl'],
    zIndex: -1,
  },
  stageText: {
    fontSize: 20,
    fontWeight: '700',
    color: obsidianDark.text.primary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  subtext: {
    fontSize: 14,
    color: obsidianDark.text.muted,
    marginBottom: 24,
  },
  subtextSpacer: {
    height: 24,
  },
  progressContainer: {
    width: '100%',
    maxWidth: 280,
    marginTop: 8,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: obsidianDark.bg.elevated,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: radius.full,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    overflow: 'hidden',
  },
  progressText: {
    fontSize: 12,
    color: obsidianDark.text.subtle,
    textAlign: 'center',
    marginTop: 8,
  },
  stageIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    paddingHorizontal: 16,
  },
  stageIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stageDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: obsidianDark.bg.highlight,
  },
  stageDotCurrent: {
    backgroundColor: obsidianDark.accent.primary,
    shadowColor: obsidianDark.accent.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  stageDotCompleted: {
    backgroundColor: obsidianDark.accent.success,
  },
  stageDotInactive: {
    backgroundColor: obsidianDark.border.subtle,
  },
  stageLine: {
    width: 32,
    height: 2,
    backgroundColor: obsidianDark.border.subtle,
    marginHorizontal: 4,
  },
  stageLineCompleted: {
    backgroundColor: obsidianDark.accent.success,
  },
  stageLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 220,
    marginTop: 8,
  },
  stageLabel: {
    fontSize: 11,
    color: obsidianDark.text.subtle,
    textAlign: 'center',
    width: 40,
  },
  stageLabelActive: {
    color: obsidianDark.accent.primary,
    fontWeight: '600',
  },
  stageLabelCompleted: {
    color: obsidianDark.accent.success,
  },
});
