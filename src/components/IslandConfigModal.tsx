import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import Animated, { SlideInDown, SlideOutDown, FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { X, Layers, Minus, Plus, ArrowRight, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { IslandConfig } from '@/lib/types/puzzle';

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
  compact = false,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  isDark: boolean;
  compact?: boolean;
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
    <View className={compact ? "flex-row items-center gap-2" : "flex-row items-center justify-between mb-4"}>
      <Text
        style={{
          fontSize: compact ? 14 : 16,
          fontWeight: '600',
          color: isDark ? '#fff' : '#333',
          flex: compact ? 0 : 1,
        }}
      >
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={handleDecrease}
          disabled={value <= min}
          style={{
            width: compact ? 32 : 40,
            height: compact ? 32 : 40,
            borderRadius: 8,
            backgroundColor:
              value <= min
                ? isDark
                  ? '#1a1a1a'
                  : '#e0e0e0'
                : isDark
                  ? '#2a2a2a'
                  : '#f0f0f0',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: value <= min ? 0.5 : 1,
          }}
        >
          <Minus size={compact ? 14 : 18} color={isDark ? '#fff' : '#333'} />
        </Pressable>
        <Text
          style={{
            fontSize: compact ? 16 : 20,
            fontWeight: '700',
            color: isDark ? '#fff' : '#333',
            minWidth: compact ? 28 : 36,
            textAlign: 'center',
          }}
        >
          {value}
        </Text>
        <Pressable
          onPress={handleIncrease}
          disabled={value >= max}
          style={{
            width: compact ? 32 : 40,
            height: compact ? 32 : 40,
            borderRadius: 8,
            backgroundColor:
              value >= max
                ? isDark
                  ? '#1a1a1a'
                  : '#e0e0e0'
                : isDark
                  ? '#2a2a2a'
                  : '#f0f0f0',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: value >= max ? 0.5 : 1,
          }}
        >
          <Plus size={compact ? 14 : 18} color={isDark ? '#fff' : '#333'} />
        </Pressable>
      </View>
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
  const cellCount = config.cols * config.rows;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
      layout={Layout.springify().damping(20)}
      style={{
        backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: isDark ? '#3a3a3a' : '#e0e0e0',
      }}
    >
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: '#3B82F6',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
              {index + 1}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 16,
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
              padding: 8,
              borderRadius: 8,
              backgroundColor: isDark ? '#3a3a3a' : '#e8e8e8',
            }}
          >
            <Trash2 size={18} color="#EF4444" />
          </Pressable>
        )}
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-4">
          <NumberStepper
            label="W"
            value={config.cols}
            onChange={(cols) => onUpdate(cols, config.rows)}
            min={2}
            max={8}
            isDark={isDark}
            compact
          />
          <Text style={{ color: isDark ? '#666' : '#999', fontSize: 18 }}>×</Text>
          <NumberStepper
            label="H"
            value={config.rows}
            onChange={(rows) => onUpdate(config.cols, rows)}
            min={2}
            max={8}
            isDark={isDark}
            compact
          />
        </View>
        <Text
          style={{
            fontSize: 13,
            color: isDark ? '#888' : '#666',
          }}
        >
          {cellCount} cells
        </Text>
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

  // Calculate totals
  const totalCells = islands.reduce((sum, island) => sum + island.cols * island.rows, 0);
  const dominoesNeeded = Math.floor(totalCells / 2);
  const hasOddCells = totalCells % 2 !== 0;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}
      >
        <Animated.View entering={SlideInDown.springify().damping(20)} exiting={SlideOutDown}>
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
                <Pressable onPress={onClose} className="p-2">
                  <X size={24} color={isDark ? '#888' : '#666'} />
                </Pressable>
              </View>

              {/* Description */}
              <View className="px-5 pb-4">
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

              {/* Islands List */}
              <ScrollView
                className="px-5"
                style={{ maxHeight: 300 }}
                showsVerticalScrollIndicator={false}
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
                      paddingVertical: 14,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderStyle: 'dashed',
                      borderColor: isDark ? '#444' : '#ddd',
                      marginBottom: 12,
                      gap: 8,
                    }}
                  >
                    <Plus size={20} color={isDark ? '#888' : '#666'} />
                    <Text style={{ color: isDark ? '#888' : '#666', fontWeight: '500' }}>
                      Add Island ({islands.length}/5)
                    </Text>
                  </Pressable>
                )}
              </ScrollView>

              {/* Summary */}
              <View
                className="mx-5 my-3 p-3 rounded-xl"
                style={{
                  backgroundColor: hasOddCells
                    ? isDark ? '#7F1D1D' : '#FEE2E2'
                    : isDark ? '#2a2a2a' : '#f0f0f0',
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    color: hasOddCells
                      ? isDark ? '#FCA5A5' : '#DC2626'
                      : isDark ? '#aaa' : '#666',
                    textAlign: 'center',
                  }}
                >
                  {islands.length} island{islands.length > 1 ? 's' : ''} = {totalCells} total cells
                  {'\n'}
                  {hasOddCells
                    ? 'Total cells must be even for dominoes!'
                    : `${dominoesNeeded} dominoes needed`}
                </Text>
              </View>

              {/* Continue Button */}
              <View className="px-5 pt-2">
                <Pressable
                  onPress={handleConfirm}
                  disabled={hasOddCells}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: hasOddCells ? '#666' : '#3B82F6',
                    opacity: hasOddCells ? 0.5 : 1,
                    gap: 8,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                    Continue to Crop
                  </Text>
                  <ArrowRight size={20} color="#fff" />
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
