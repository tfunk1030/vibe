import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { X, Plus, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface DominoEditorProps {
  visible: boolean;
  initialPips?: [number, number];
  onSave: (pips: [number, number]) => void;
  onDelete?: () => void;
  onClose: () => void;
  isDark: boolean;
  isNew?: boolean;
}

// Pip positions for domino display
const PIP_POSITIONS: Record<number, { x: number; y: number }[]> = {
  0: [],
  1: [{ x: 0.5, y: 0.5 }],
  2: [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.75 },
  ],
  3: [
    { x: 0.25, y: 0.25 },
    { x: 0.5, y: 0.5 },
    { x: 0.75, y: 0.75 },
  ],
  4: [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.25 },
    { x: 0.25, y: 0.75 },
    { x: 0.75, y: 0.75 },
  ],
  5: [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.25 },
    { x: 0.5, y: 0.5 },
    { x: 0.25, y: 0.75 },
    { x: 0.75, y: 0.75 },
  ],
  6: [
    { x: 0.25, y: 0.2 },
    { x: 0.75, y: 0.2 },
    { x: 0.25, y: 0.5 },
    { x: 0.75, y: 0.5 },
    { x: 0.25, y: 0.8 },
    { x: 0.75, y: 0.8 },
  ],
};

function PipDots({
  count,
  size,
  color,
}: {
  count: number;
  size: number;
  color: string;
}) {
  const positions = PIP_POSITIONS[count] || [];
  const dotSize = size * 0.2;

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {positions.map((pos, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: pos.x * size - dotSize / 2,
            top: pos.y * size - dotSize / 2,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

function PipSelector({
  value,
  onChange,
  isDark,
}: {
  value: number;
  onChange: (v: number) => void;
  isDark: boolean;
}) {
  return (
    <View className="flex-row flex-wrap justify-center gap-2">
      {[0, 1, 2, 3, 4, 5, 6].map((pip) => {
        const isSelected = value === pip;
        return (
          <Pressable
            key={pip}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(pip);
            }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              backgroundColor: isSelected
                ? '#3B82F6'
                : isDark
                  ? '#2a2a2a'
                  : '#f0f0f0',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: isSelected ? 0 : 1,
              borderColor: isDark ? '#444' : '#ddd',
            }}
            accessibilityLabel={`${pip} pips`}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
          >
            <PipDots
              count={pip}
              size={40}
              color={isSelected ? '#fff' : isDark ? '#888' : '#666'}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export function DominoEditor({
  visible,
  initialPips = [0, 0],
  onSave,
  onDelete,
  onClose,
  isDark,
  isNew = false,
}: DominoEditorProps) {
  const [pip1, setPip1] = useState(initialPips[0]);
  const [pip2, setPip2] = useState(initialPips[1]);

  const handleSave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSave([pip1, pip2]);
  }, [pip1, pip2, onSave]);

  const handleDelete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDelete?.();
  }, [onDelete]);

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible) {
      setPip1(initialPips[0]);
      setPip2(initialPips[1]);
    }
  }, [visible, initialPips]);

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
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: isDark ? '#fff' : '#000',
                  }}
                >
                  {isNew ? 'Add Domino' : 'Edit Domino'}
                </Text>
                <Pressable
                  onPress={onClose}
                  className="p-2"
                  accessibilityLabel="Close domino editor"
                  accessibilityRole="button"
                >
                  <X size={24} color={isDark ? '#888' : '#666'} />
                </Pressable>
              </View>

              {/* Preview */}
              <View className="items-center py-4">
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                    borderRadius: 12,
                    padding: 8,
                    borderWidth: 1,
                    borderColor: isDark ? '#444' : '#ddd',
                  }}
                >
                  <View
                    style={{
                      padding: 8,
                      borderRightWidth: 1,
                      borderRightColor: isDark ? '#444' : '#ccc',
                    }}
                  >
                    <PipDots count={pip1} size={50} color={isDark ? '#fff' : '#1a1a1a'} />
                  </View>
                  <View style={{ padding: 8 }}>
                    <PipDots count={pip2} size={50} color={isDark ? '#fff' : '#1a1a1a'} />
                  </View>
                </View>
              </View>

              {/* Pip 1 Selector */}
              <View className="px-5 mb-4">
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: isDark ? '#888' : '#666',
                    marginBottom: 8,
                  }}
                >
                  Left Side
                </Text>
                <PipSelector value={pip1} onChange={setPip1} isDark={isDark} />
              </View>

              {/* Pip 2 Selector */}
              <View className="px-5 mb-6">
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: isDark ? '#888' : '#666',
                    marginBottom: 8,
                  }}
                >
                  Right Side
                </Text>
                <PipSelector value={pip2} onChange={setPip2} isDark={isDark} />
              </View>

              {/* Actions */}
              <View className="flex-row px-5 gap-3">
                {!isNew && onDelete && (
                  <Pressable
                    onPress={handleDelete}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 14,
                      borderRadius: 12,
                      backgroundColor: '#EF4444',
                      gap: 8,
                    }}
                  >
                    <Trash2 size={20} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                      Delete
                    </Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={handleSave}
                  style={{
                    flex: isNew ? 1 : 2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: '#3B82F6',
                    gap: 8,
                  }}
                >
                  {isNew && <Plus size={20} color="#fff" />}
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                    {isNew ? 'Add' : 'Save'}
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
