import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Camera, Image as ImageIcon } from 'lucide-react-native';
import { ActionButton } from './ActionButton';

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
  return (
    <Animated.View
      entering={FadeInDown.delay(200)}
      className="flex-1 px-5"
    >
      <View
        className={`rounded-2xl p-8 items-center ${isDark ? 'bg-white/5' : 'bg-black/5'}`}
      >
        <View
          className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${isDark ? 'bg-white/10' : 'bg-black/10'}`}
        >
          <Camera size={36} color={isDark ? '#888' : '#666'} />
        </View>
        <Text
          className={`text-lg font-semibold text-center mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}
        >
          No puzzle loaded
        </Text>
        <Text
          className={`text-sm text-center ${isDark ? 'text-gray-500' : 'text-gray-600'}`}
        >
          Take a photo or upload a screenshot of a NYT Pips puzzle to get
          started
        </Text>
      </View>

      {/* Action Buttons */}
      <View className="flex-row gap-3 mt-6">
        <ActionButton
          onPress={onCamera}
          icon={<Camera size={20} color="#fff" />}
          label="Camera"
          variant="primary"
          isDark={isDark}
        />
        <ActionButton
          onPress={onUpload}
          icon={<ImageIcon size={20} color={isDark ? '#fff' : '#333'} />}
          label="Upload"
          variant="secondary"
          isDark={isDark}
        />
      </View>

      {/* Demo Button */}
      <Pressable
        onPress={onSample}
        className="mt-6 py-3 items-center"
        accessibilityLabel="Try with sample puzzle"
        accessibilityRole="link"
      >
        <Text className="text-blue-500 font-medium">
          Try with sample puzzle
        </Text>
      </Pressable>

      {/* L-Shaped Puzzle Button */}
      <Pressable
        onPress={onLShapedPuzzle}
        className="mt-2 py-3 items-center"
        accessibilityLabel="Try L-shaped puzzle from screenshot"
        accessibilityRole="link"
      >
        <Text className="text-green-500 font-medium">
          Try L-shaped puzzle (from screenshot)
        </Text>
      </Pressable>
    </Animated.View>
  );
}
