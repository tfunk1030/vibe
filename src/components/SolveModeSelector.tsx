import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { SolveMode } from '@/lib/types/puzzle';
import { Eye, Lightbulb, ChevronRight, CheckCircle, LucideIcon } from 'lucide-react-native';

interface SolveModeSelectorProps {
  currentMode: SolveMode;
  onModeChange: (mode: SolveMode) => void;
  isDark: boolean;
}

const MODES: { mode: SolveMode; label: string; Icon: LucideIcon }[] = [
  { mode: 'full', label: 'Full', Icon: Eye },
  { mode: 'hint', label: 'Hint', Icon: Lightbulb },
  { mode: 'step', label: 'Step', Icon: ChevronRight },
  { mode: 'verify', label: 'Verify', Icon: CheckCircle },
];

function ModeButton({
  label,
  Icon,
  isActive,
  onPress,
  isDark,
}: {
  label: string;
  Icon: LucideIcon;
  isActive: boolean;
  onPress: () => void;
  isDark: boolean;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const activeColor = '#3B82F6';
  const inactiveColor = isDark ? '#3a3a3a' : '#e5e5e5';
  const textColor = isActive ? '#fff' : isDark ? '#aaa' : '#666';
  const iconColor = isActive ? '#fff' : isDark ? '#888' : '#888';

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: isActive ? activeColor : inactiveColor,
          gap: 4,
        }}
        accessibilityLabel={`${label} mode`}
        accessibilityRole="radio"
        accessibilityState={{ checked: isActive }}
      >
        <Icon size={16} color={iconColor} />
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: textColor,
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function SolveModeSelector({
  currentMode,
  onModeChange,
  isDark,
}: SolveModeSelectorProps) {
  return (
    <View className="flex-row justify-center gap-2">
      {MODES.map(({ mode, label, Icon }) => (
        <ModeButton
          key={mode}
          label={label}
          Icon={Icon}
          isActive={currentMode === mode}
          onPress={() => onModeChange(mode)}
          isDark={isDark}
        />
      ))}
    </View>
  );
}
