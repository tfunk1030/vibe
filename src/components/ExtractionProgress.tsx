import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, AccessibilityInfo } from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import type { ExtractionStage } from '@/lib/services/gemini';

interface ExtractionProgressProps {
  stage: ExtractionStage;
  isDark: boolean;
}

const stageMessages: Record<ExtractionStage, { text: string; subtext: string; progress: number }> = {
  idle: { text: 'Preparing...', subtext: '', progress: 0 },
  cropping: { text: 'Processing images...', subtext: '', progress: 10 },
  dominoes: { text: 'Reading domino pips...', subtext: 'Analyzing tile patterns', progress: 25 },
  grid: { text: 'Analyzing puzzle grid...', subtext: 'This takes about 60 seconds', progress: 50 },
  solving: { text: 'Finding solution...', subtext: 'Almost done!', progress: 95 },
};

export function ExtractionProgress({ stage, isDark }: ExtractionProgressProps) {
  const stageInfo = stageMessages[stage] || stageMessages.idle;
  const stages: ExtractionStage[] = ['cropping', 'dominoes', 'grid', 'solving'];
  const allStages: ExtractionStage[] = ['idle', 'cropping', 'dominoes', 'grid', 'solving'];
  const currentIndex = allStages.indexOf(stage);

  // Pulsing animation for long-running stages
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (stage === 'grid') {
      // Gentle pulse animation during long grid extraction
      pulse.value = withRepeat(
        withTiming(0.6, { duration: 1200 }),
        -1,
        true
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 1;
    }

    return () => {
      cancelAnimation(pulse);
    };
  }, [stage, pulse]);

  // Announce stage changes to screen readers
  useEffect(() => {
    if (stage !== 'idle') {
      AccessibilityInfo.announceForAccessibility(stageInfo.text);
    }
  }, [stage, stageInfo.text]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  return (
    <Animated.View
      entering={FadeIn}
      className="flex-1 items-center justify-center py-20 px-8"
    >
      {/* Stage Icon with pulse animation for grid stage */}
      <Animated.View
        style={stage === 'grid' ? pulseStyle : undefined}
        className={`w-16 h-16 rounded-full items-center justify-center mb-6 ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}
      >
        <ActivityIndicator size="large" color="#3B82F6" />
      </Animated.View>

      {/* Stage Text */}
      <Text
        className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}
      >
        {stageInfo.text}
      </Text>

      {/* Subtext for timing expectations */}
      {stageInfo.subtext ? (
        <Text
          className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
        >
          {stageInfo.subtext}
        </Text>
      ) : (
        <View className="h-6" />
      )}

      {/* Progress Bar */}
      <View
        className="w-full max-w-xs mt-2"
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: stageInfo.progress }}
        accessibilityLabel={`Extraction progress: ${stageInfo.text}`}
      >
        <View
          className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-200'}`}
        >
          <Animated.View
            style={{
              width: `${stageInfo.progress}%`,
              height: '100%',
              backgroundColor: '#3B82F6',
              borderRadius: 4,
            }}
          />
        </View>
        <Text
          className={`text-xs mt-2 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
        >
          {stageInfo.progress}% complete
        </Text>
      </View>

      {/* Stage Indicators - decorative, hidden from screen readers */}
      <View
        className="flex-row items-center justify-center mt-6 gap-2"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden={true}
      >
        {stages.map((s, index) => {
          const stageIndex = allStages.indexOf(s);
          const isActive = stageIndex <= currentIndex && stage !== 'idle';
          const isCurrent = s === stage;

          return (
            <View key={s} className="flex-row items-center">
              <View
                className={`w-2.5 h-2.5 rounded-full ${
                  isCurrent
                    ? 'bg-blue-500'
                    : isActive
                      ? 'bg-green-500'
                      : isDark
                        ? 'bg-white/20'
                        : 'bg-gray-300'
                }`}
              />
              {index < 3 && (
                <View
                  className={`w-6 h-0.5 ${
                    isActive && stageIndex < currentIndex
                      ? 'bg-green-500'
                      : isDark
                        ? 'bg-white/10'
                        : 'bg-gray-200'
                  }`}
                />
              )}
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}
