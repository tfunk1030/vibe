import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { ExtractionStage } from '@/lib/services/gemini';

interface ExtractionProgressProps {
  stage: ExtractionStage;
  isDark: boolean;
}

const stageMessages: Record<ExtractionStage, { text: string; progress: number }> = {
  idle: { text: 'Preparing...', progress: 0 },
  cropping: { text: 'Processing images...', progress: 15 },
  dominoes: { text: 'Reading domino pips...', progress: 35 },
  grid: { text: 'Extracting puzzle grid...', progress: 65 },
  solving: { text: 'Finding solution...', progress: 90 },
};

export function ExtractionProgress({ stage, isDark }: ExtractionProgressProps) {
  const stageInfo = stageMessages[stage] || stageMessages.idle;
  const stages: ExtractionStage[] = ['cropping', 'dominoes', 'grid', 'solving'];
  const allStages: ExtractionStage[] = ['idle', 'cropping', 'dominoes', 'grid', 'solving'];
  const currentIndex = allStages.indexOf(stage);

  return (
    <Animated.View
      entering={FadeIn}
      className="flex-1 items-center justify-center py-20 px-8"
    >
      {/* Stage Icon */}
      <View
        className={`w-16 h-16 rounded-full items-center justify-center mb-6 ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}
      >
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>

      {/* Stage Text */}
      <Text
        className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}
      >
        {stageInfo.text}
      </Text>

      {/* Progress Bar */}
      <View className="w-full max-w-xs mt-4">
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

      {/* Stage Indicators */}
      <View className="flex-row items-center justify-center mt-6 gap-2">
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
