import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, Dimensions } from 'react-native';
import Animated, { SlideInDown, SlideOutDown, FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { X, Layers, Minus, Plus, ArrowRight, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { IslandConfig } from '@/lib/types/puzzle';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.75;

interface IslandConfigModalProps {
  visible: boolean;
  onConfirm: (configs: IslandConfig[]) => void;
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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text
        style={{
          fontSize: 15,
          fontWeight: '600',
          color: isDark ? '#aaa' : '#555',
          width: 24,
        }}
      >
        {label}
      </Text>
      <Pressable
        onPress={handleDecrease}
        disabled={value <= min}
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: value <= min
            ? isDark ? '#1a1a1a' : '#e0e0e0'
            : isDark ? '#333' : '#e8e8e8',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: value <= min ? 0.5 : 1,
        }}
      >
        <Minus size={22} color={isDark ? '#fff' : '#333'} />
      </Pressable>
      <Text
        style={{
          fontSize: 24,
          fontWeight: '700',
          color: isDark ? '#fff' : '#333',
          width: 40,
          textAlign: 'center',
        }}
      >
        {value}
      </Text>
      <Pressable
        onPress={handleIncrease}
        disabled={value >= max}
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: value >= max
            ? isDark ? '#1a1a1a' : '#e0e0e0'
            : isDark ? '#333' : '#e8e8e8',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: value >= max ? 0.5 : 1,
        }}
      >
        <Plus size={22} color={isDark ? '#fff' : '#333'} />
      </Pressable>
    </View>
  );
}

function IslandCard({
  index,
  config,
  onUpdate,
  onRemove,
  canRemove,
  isDark,
}: {
  index: number;
  config: IslandConfig;
  onUpdate: (cols: number, rows: number) => void;
  onRemove: () => void;
  canRemove: boolean;
  isDark: boolean;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      layout={Layout.springify().damping(20)}
      style={{
        backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: isDark ? '#3a3a3a' : '#e0e0e0',
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#3B82F6',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>
              {index + 1}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 18,
              fontWeight: '600',
              color: isDark ? '#fff' : '#333',
            }}
          >
            Island {index + 1}
          </Text>
        </View>
        {canRemove && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onRemove();
            }}
            style={{
              padding: 10,
              borderRadius: 10,
              backgroundColor: isDark ? '#3a3a3a' : '#e8e8e8',
            }}
          >
            <Trash2 size={20} color="#EF4444" />
          </Pressable>
        )}
      </View>

      {/* Dimensions */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <NumberStepper
          label="W"
          value={config.cols}
          onChange={(cols) => onUpdate(cols, config.rows)}
          min={2}
          max={12}
          isDark={isDark}
        />
        <Text style={{ color: isDark ? '#555' : '#aaa', fontSize: 28, fontWeight: '300' }}>×</Text>
        <NumberStepper
          label="H"
          value={config.rows}
          onChange={(rows) => onUpdate(config.cols, rows)}
          min={2}
          max={12}
          isDark={isDark}
        />
      </View>
    </Animated.View>
  );
}

export function IslandConfigModal({
  visible,
  onConfirm,
  onClose,
  isDark,
}: IslandConfigModalProps) {
  const [islands, setIslands] = useState<IslandConfig[]>([
    { id: '1', cols: 4, rows: 4 },
  ]);

  const handleAddIsland = () => {
    if (islands.length >= 5) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIslands([
      ...islands,
      { id: String(Date.now()), cols: 4, rows: 4 },
    ]);
  };

  const handleRemoveIsland = (index: number) => {
    if (islands.length <= 1) return;
    setIslands(islands.filter((_, i) => i !== index));
  };

  const handleUpdateIsland = (index: number, cols: number, rows: number) => {
    setIslands(
      islands.map((island, i) =>
        i === index ? { ...island, cols, rows } : island
      )
    );
  };

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm(islands);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <Pressable
          style={{ flex: 1 }}
          onPress={onClose}
        />
        <Animated.View entering={SlideInDown.springify().damping(20)} exiting={SlideOutDown}>
          <View
            style={{
              backgroundColor: isDark ? '#1a1a1a' : '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              height: MODAL_HEIGHT,
            }}
          >
            {/* Handle bar */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Layers size={24} color={isDark ? '#fff' : '#333'} />
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '700',
                    color: isDark ? '#fff' : '#000',
                  }}
                >
                  Configure Islands
                </Text>
              </View>
              <Pressable onPress={onClose} style={{ padding: 8 }}>
                <X size={24} color={isDark ? '#888' : '#666'} />
              </Pressable>
            </View>

            {/* Description */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
              <Text
                style={{
                  fontSize: 14,
                  color: isDark ? '#888' : '#666',
                  lineHeight: 20,
                }}
              >
                Set up each island's dimensions. You'll crop each island separately from your photo.
              </Text>
            </View>

            {/* Islands List - This is the key fix: flex: 1 with explicit parent height */}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
              showsVerticalScrollIndicator={true}
              bounces={true}
              nestedScrollEnabled={true}
            >
              {islands.map((island, index) => (
                <IslandCard
                  key={island.id}
                  index={index}
                  config={island}
                  onUpdate={(cols, rows) => handleUpdateIsland(index, cols, rows)}
                  onRemove={() => handleRemoveIsland(index)}
                  canRemove={islands.length > 1}
                  isDark={isDark}
                />
              ))}

              {/* Add Island Button */}
              {islands.length < 5 && (
                <Pressable
                  onPress={handleAddIsland}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 18,
                    borderRadius: 16,
                    borderWidth: 2,
                    borderStyle: 'dashed',
                    borderColor: isDark ? '#444' : '#ddd',
                    gap: 10,
                  }}
                >
                  <Plus size={22} color={isDark ? '#888' : '#666'} />
                  <Text style={{ color: isDark ? '#888' : '#666', fontWeight: '600', fontSize: 16 }}>
                    Add Island ({islands.length}/5)
                  </Text>
                </Pressable>
              )}
            </ScrollView>

            {/* Footer - Fixed at bottom */}
            <View style={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12, borderTopWidth: 1, borderTopColor: isDark ? '#333' : '#eee' }}>
              {/* Info note */}
              <Text
                style={{
                  fontSize: 13,
                  color: isDark ? '#666' : '#999',
                  textAlign: 'center',
                  lineHeight: 18,
                  marginBottom: 16,
                }}
              >
                Dimensions are bounding boxes. Islands can have holes (irregular shapes like letters).
              </Text>

              {/* Continue Button */}
              <Pressable
                onPress={handleConfirm}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 16,
                  borderRadius: 14,
                  backgroundColor: '#3B82F6',
                  gap: 10,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 17 }}>
                  Continue to Crop
                </Text>
                <ArrowRight size={22} color="#fff" />
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
