import React from 'react';
import { Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';

interface ActionButtonProps {
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: 'primary' | 'secondary' | 'warning';
  isDark: boolean;
  disabled?: boolean;
}

export function ActionButton({
  onPress,
  icon,
  label,
  variant = 'primary',
  isDark,
  disabled = false,
}: ActionButtonProps) {
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

  const getBackgroundColor = () => {
    if (disabled) return isDark ? '#2a2a2a' : '#e0e0e0';
    if (variant === 'primary') return '#3B82F6';
    if (variant === 'warning') return '#F59E0B';
    return isDark ? '#2a2a2a' : '#f0f0f0';
  };

  return (
    <Animated.View style={[animatedStyle, { flex: 1 }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: 12,
          backgroundColor: getBackgroundColor(),
          gap: 8,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {icon}
        <Text
          style={{
            fontSize: 15,
            fontWeight: '600',
            color: disabled
              ? '#888'
              : variant === 'primary' || variant === 'warning'
                ? '#fff'
                : isDark
                  ? '#fff'
                  : '#333',
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
