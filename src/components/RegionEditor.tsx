import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, Modal, TextInput } from 'react-native';
import Animated, {
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { X, Trash2, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Region, RegionConstraint, ConstraintType, constraintLabel } from '@/lib/types/puzzle';

interface RegionEditorProps {
  visible: boolean;
  region: Region | null;
  onSave: (constraint: RegionConstraint) => void;
  onDelete: () => void;
  onClose: () => void;
  isDark: boolean;
  isNew?: boolean;
}

const CONSTRAINT_TYPES: { type: ConstraintType; label: string; description: string; needsValue: boolean }[] = [
  { type: 'any', label: 'Any (*)', description: 'No constraint - any values allowed', needsValue: false },
  { type: 'sum', label: 'Sum (Σ)', description: 'All pips sum to value', needsValue: true },
  { type: 'equal', label: 'Equal (=)', description: 'All pips are the same', needsValue: false },
  { type: 'different', label: 'Different (≠)', description: 'All pips are unique', needsValue: false },
  { type: 'greater', label: 'Greater (>)', description: 'All pips greater than value', needsValue: true },
  { type: 'less', label: 'Less (<)', description: 'All pips less than value', needsValue: true },
];

function ConstraintTypeButton({
  type,
  label,
  description,
  isSelected,
  onPress,
  isDark,
}: {
  type: ConstraintType;
  label: string;
  description: string;
  isSelected: boolean;
  onPress: () => void;
  isDark: boolean;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => {
          scale.value = withSpring(0.97);
        }}
        onPressOut={() => {
          scale.value = withSpring(1);
        }}
        style={{
          padding: 12,
          borderRadius: 12,
          backgroundColor: isSelected
            ? '#3B82F6'
            : isDark
              ? '#2a2a2a'
              : '#f0f0f0',
          borderWidth: isSelected ? 0 : 1,
          borderColor: isDark ? '#444' : '#ddd',
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: isSelected ? '#fff' : isDark ? '#fff' : '#333',
            marginBottom: 2,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: isSelected ? 'rgba(255,255,255,0.8)' : isDark ? '#888' : '#666',
          }}
        >
          {description}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function RegionEditor({
  visible,
  region,
  onSave,
  onDelete,
  onClose,
  isDark,
  isNew = false,
}: RegionEditorProps) {
  const [constraintType, setConstraintType] = useState<ConstraintType>('any');
  const [constraintValue, setConstraintValue] = useState<string>('');

  // Reset state when modal opens
  useEffect(() => {
    if (visible && region) {
      setConstraintType(region.constraint.type);
      setConstraintValue(region.constraint.value?.toString() ?? '');
    } else if (visible && isNew) {
      setConstraintType('any');
      setConstraintValue('');
    }
  }, [visible, region, isNew]);

  const selectedTypeInfo = CONSTRAINT_TYPES.find((t) => t.type === constraintType);
  const needsValue = selectedTypeInfo?.needsValue ?? false;

  const handleSave = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const constraint: RegionConstraint = {
      type: constraintType,
      value: needsValue ? parseInt(constraintValue, 10) || undefined : undefined,
    };
    onSave(constraint);
  }, [constraintType, constraintValue, needsValue, onSave]);

  const handleDelete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onDelete();
  }, [onDelete]);

  const canSave = !needsValue || (constraintValue.length > 0 && !isNaN(parseInt(constraintValue, 10)));

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
                maxHeight: '80%',
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
                  {region && (
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        backgroundColor: region.color,
                      }}
                    />
                  )}
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: '700',
                      color: isDark ? '#fff' : '#000',
                    }}
                  >
                    {isNew ? 'New Region' : 'Edit Region'}
                  </Text>
                </View>
                <Pressable onPress={onClose} className="p-2">
                  <X size={24} color={isDark ? '#888' : '#666'} />
                </Pressable>
              </View>

              {/* Region info */}
              {region && (
                <View className="px-5 mb-4">
                  <Text
                    style={{
                      fontSize: 14,
                      color: isDark ? '#888' : '#666',
                    }}
                  >
                    {region.cells.length} cells in this region
                  </Text>
                </View>
              )}

              {/* Constraint Type Selection */}
              <View className="px-5 mb-4">
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: isDark ? '#888' : '#666',
                    marginBottom: 12,
                  }}
                >
                  Constraint Type
                </Text>
                {CONSTRAINT_TYPES.map((ct) => (
                  <ConstraintTypeButton
                    key={ct.type}
                    type={ct.type}
                    label={ct.label}
                    description={ct.description}
                    isSelected={constraintType === ct.type}
                    onPress={() => setConstraintType(ct.type)}
                    isDark={isDark}
                  />
                ))}
              </View>

              {/* Constraint Value Input */}
              {needsValue && (
                <View className="px-5 mb-6">
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: isDark ? '#888' : '#666',
                      marginBottom: 8,
                    }}
                  >
                    Value
                  </Text>
                  <TextInput
                    value={constraintValue}
                    onChangeText={setConstraintValue}
                    keyboardType="number-pad"
                    placeholder={constraintType === 'sum' ? 'e.g., 12' : 'e.g., 3'}
                    placeholderTextColor={isDark ? '#666' : '#999'}
                    style={{
                      backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0',
                      borderRadius: 12,
                      padding: 14,
                      fontSize: 18,
                      color: isDark ? '#fff' : '#000',
                      borderWidth: 1,
                      borderColor: isDark ? '#444' : '#ddd',
                    }}
                  />
                </View>
              )}

              {/* Actions */}
              <View className="flex-row px-5 gap-3">
                {!isNew && (
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
                  disabled={!canSave}
                  style={{
                    flex: isNew ? 1 : 2,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: canSave ? '#3B82F6' : isDark ? '#333' : '#ccc',
                    gap: 8,
                    opacity: canSave ? 1 : 0.5,
                  }}
                >
                  <Check size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                    {isNew ? 'Create' : 'Save'}
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
