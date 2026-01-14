import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView } from 'react-native';
import Animated, {
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { X, Plus, Minus, Grid3X3, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface GridSizeEditorProps {
  visible: boolean;
  currentWidth: number;
  currentHeight: number;
  onSave: (width: number, height: number) => void;
  onClose: () => void;
  isDark: boolean;
}

function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
  isDark,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  isDark: boolean;
}) {
  const handleDecrease = () => {
    if (value > min) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(value - 1);
    }
  };

  const handleIncrease = () => {
    if (value < max) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onChange(value + 1);
    }
  };

  return (
    <View className="flex-row items-center justify-between mb-4">
      <Text
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: isDark ? '#fff' : '#333',
        }}
      >
        {label}
      </Text>
      <View className="flex-row items-center gap-3">
        <Pressable
          onPress={handleDecrease}
          disabled={value <= min}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: value <= min
              ? isDark ? '#1a1a1a' : '#e0e0e0'
              : isDark ? '#2a2a2a' : '#f0f0f0',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: value <= min ? 0.5 : 1,
          }}
          accessibilityLabel={`Decrease ${label} from ${value}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: value <= min }}
        >
          <Minus size={20} color={isDark ? '#fff' : '#333'} />
        </Pressable>
        <Text
          style={{
            fontSize: 20,
            fontWeight: '700',
            color: isDark ? '#fff' : '#333',
            minWidth: 40,
            textAlign: 'center',
          }}
          accessibilityLabel={`${label}: ${value}`}
        >
          {value}
        </Text>
        <Pressable
          onPress={handleIncrease}
          disabled={value >= max}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: value >= max
              ? isDark ? '#1a1a1a' : '#e0e0e0'
              : isDark ? '#2a2a2a' : '#f0f0f0',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: value >= max ? 0.5 : 1,
          }}
          accessibilityLabel={`Increase ${label} from ${value}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: value >= max }}
        >
          <Plus size={20} color={isDark ? '#fff' : '#333'} />
        </Pressable>
      </View>
    </View>
  );
}

export function GridSizeEditor({
  visible,
  currentWidth,
  currentHeight,
  onSave,
  onClose,
  isDark,
}: GridSizeEditorProps) {
  const [width, setWidth] = useState(currentWidth);
  const [height, setHeight] = useState(currentHeight);

  // Reset when modal opens
  React.useEffect(() => {
    if (visible) {
      setWidth(currentWidth);
      setHeight(currentHeight);
    }
  }, [visible, currentWidth, currentHeight]);

  const handleSave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave(width, height);
    onClose();
  }, [width, height, onSave, onClose]);

  const hasChanges = width !== currentWidth || height !== currentHeight;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}
        accessibilityLabel="Close dialog"
        accessibilityHint="Tap outside the dialog to close"
      >
        <Animated.View
          entering={SlideInDown.springify().damping(20)}
          exiting={SlideOutDown}
        >
          <Pressable onPress={() => {}}>
            <View
              style={{
                backgroundColor: isDark ? '#1a1a1a' : '#fff',
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingBottom: 40,
              }}
            >
              {/* Handle bar */}
              <View className="items-center pt-3 pb-2">
                <View
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: isDark ? '#444' : '#ddd',
                  }}
                />
              </View>

              {/* Header */}
              <View className="flex-row items-center justify-between px-5 py-3">
                <View className="flex-row items-center gap-3">
                  <Grid3X3 size={24} color={isDark ? '#fff' : '#333'} />
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: '700',
                      color: isDark ? '#fff' : '#000',
                    }}
                  >
                    Grid Size
                  </Text>
                </View>
                <Pressable
                  onPress={onClose}
                  className="p-2"
                  hitSlop={8}
                  accessibilityLabel="Close grid size editor"
                  accessibilityRole="button"
                >
                  <X size={24} color={isDark ? '#888' : '#666'} />
                </Pressable>
              </View>

              {/* Size Controls */}
              <View className="px-5 py-4">
                <NumberStepper
                  label="Columns"
                  value={width}
                  onChange={setWidth}
                  min={2}
                  max={12}
                  isDark={isDark}
                />
                <NumberStepper
                  label="Rows"
                  value={height}
                  onChange={setHeight}
                  min={2}
                  max={12}
                  isDark={isDark}
                />
              </View>

              {/* Preview */}
              <View className="items-center py-4">
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    width: Math.min(width * 30, 240),
                  }}
                >
                  {Array.from({ length: height }).map((_, row) =>
                    Array.from({ length: width }).map((_, col) => (
                      <View
                        key={`${row}-${col}`}
                        style={{
                          width: Math.min(30, 240 / width) - 2,
                          height: Math.min(30, 240 / width) - 2,
                          margin: 1,
                          borderRadius: 4,
                          backgroundColor: isDark ? '#3a3a3a' : '#e0e0e0',
                        }}
                      />
                    ))
                  )}
                </View>
                <Text
                  style={{
                    marginTop: 12,
                    fontSize: 14,
                    color: isDark ? '#888' : '#666',
                  }}
                >
                  {width} × {height} = {width * height} cells
                </Text>
              </View>

              {/* Warning if shrinking */}
              {(width < currentWidth || height < currentHeight) && (
                <View className="mx-5 mb-4 p-3 rounded-xl bg-amber-500/20">
                  <Text className="text-amber-500 text-center text-sm">
                    Shrinking the grid will remove cells outside the new bounds
                  </Text>
                </View>
              )}

              {/* Save Button */}
              <View className="px-5">
                <Pressable
                  onPress={handleSave}
                  disabled={!hasChanges}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: hasChanges ? '#3B82F6' : isDark ? '#333' : '#ccc',
                    gap: 8,
                    opacity: hasChanges ? 1 : 0.5,
                  }}
                >
                  <Check size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                    Apply Size
                  </Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
