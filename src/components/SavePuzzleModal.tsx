import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, TextInput, Modal } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Save, X } from 'lucide-react-native';

interface SavePuzzleModalProps {
  visible: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
  isDark: boolean;
  isEditing?: boolean;
  currentName?: string;
}

export function SavePuzzleModal({
  visible,
  onSave,
  onClose,
  isDark,
  isEditing = false,
  currentName = '',
}: SavePuzzleModalProps) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (visible) {
      // Generate default name based on date/time
      if (isEditing && currentName) {
        setName(currentName);
      } else {
        const now = new Date();
        const defaultName = `Puzzle ${now.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })} ${now.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })}`;
        setName(defaultName);
      }
    }
  }, [visible, isEditing, currentName]);

  const handleSave = () => {
    if (name.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSave(name.trim());
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPress={onClose}
        accessibilityLabel="Close dialog"
        accessibilityHint="Tap outside the dialog to close"
      >
        <Animated.View entering={FadeIn.duration(200)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: 320,
              backgroundColor: isDark ? '#1a1a2e' : '#fff',
              borderRadius: 20,
              padding: 24,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.3,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center gap-3">
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: '#3B82F6',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Save size={20} color="#fff" />
                </View>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: isDark ? '#fff' : '#1a1a1a',
                  }}
                >
                  {isEditing ? 'Update Puzzle' : 'Save Puzzle'}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                }}
                accessibilityLabel="Close save dialog"
                accessibilityRole="button"
              >
                <X size={20} color={isDark ? '#888' : '#666'} />
              </Pressable>
            </View>

            {/* Name input */}
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: isDark ? '#888' : '#666',
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Puzzle Name
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter a name..."
              placeholderTextColor={isDark ? '#555' : '#aaa'}
              style={{
                backgroundColor: isDark ? '#2a2a3e' : '#f5f5f5',
                borderRadius: 12,
                padding: 14,
                fontSize: 16,
                color: isDark ? '#fff' : '#1a1a1a',
                marginBottom: 20,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
              }}
              autoFocus
              selectTextOnFocus
            />

            {/* Buttons */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={onClose}
                className="flex-1"
                style={{
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: isDark ? '#2a2a3e' : '#e5e5e5',
                }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: isDark ? '#888' : '#666',
                    textAlign: 'center',
                  }}
                >
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                className="flex-1"
                style={{
                  padding: 14,
                  borderRadius: 12,
                  backgroundColor: name.trim() ? '#3B82F6' : isDark ? '#333' : '#ddd',
                }}
                disabled={!name.trim()}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: name.trim() ? '#fff' : isDark ? '#666' : '#999',
                    textAlign: 'center',
                  }}
                >
                  {isEditing ? 'Update' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
