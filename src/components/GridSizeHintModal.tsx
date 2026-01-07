import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator } from 'react-native';
import Animated, { SlideInDown, SlideOutDown, FadeIn } from 'react-native-reanimated';
import { X, Grid3X3, Minus, Plus, Sparkles, Wand2, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { detectGridDimensions, DetectedDimensions } from '@/lib/services/gemini';

interface GridSizeHintModalProps {
  visible: boolean;
  onConfirm: (cols: number, rows: number, dominoCount: number) => void;
  onSkip: () => void;
  onClose: () => void;
  isDark: boolean;
  imageUri?: string; // Optional image URI for auto-detection
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
            width: 40,
            height: 40,
            borderRadius: 10,
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
          <Minus size={18} color={isDark ? '#fff' : '#333'} />
        </Pressable>
        <Text
          style={{
            fontSize: 20,
            fontWeight: '700',
            color: isDark ? '#fff' : '#333',
            minWidth: 36,
            textAlign: 'center',
          }}
        >
          {value}
        </Text>
        <Pressable
          onPress={handleIncrease}
          disabled={value >= max}
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
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
          <Plus size={18} color={isDark ? '#fff' : '#333'} />
        </Pressable>
      </View>
    </View>
  );
}

export function GridSizeHintModal({
  visible,
  onConfirm,
  onSkip,
  onClose,
  isDark,
  imageUri,
}: GridSizeHintModalProps) {
  const [cols, setCols] = useState(5);
  const [rows, setRows] = useState(5);
  const [dominoCount, setDominoCount] = useState(8);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DetectedDimensions | null>(null);

  // Auto-detect on mount if imageUri is provided
  useEffect(() => {
    if (visible && imageUri && !detectionResult) {
      handleAutoDetect();
    }
  }, [visible, imageUri]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setDetectionResult(null);
    }
  }, [visible]);

  const handleAutoDetect = async () => {
    if (!imageUri) return;

    setIsDetecting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: 'base64',
      });

      const result = await detectGridDimensions(base64);
      setDetectionResult(result);

      // Apply detected values
      if (result.confidence >= 0.5) {
        setCols(result.cols);
        setRows(result.rows);
        setDominoCount(result.dominoCount);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.warn('Auto-detection failed:', error);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm(cols, rows, dominoCount);
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSkip();
  };

  // Calculate expected cells
  const expectedCells = dominoCount * 2;
  const totalGridCells = cols * rows;
  const holes = totalGridCells - expectedCells;

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
                    Puzzle Size Hint
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
                  {imageUri
                    ? 'Auto-detecting dimensions... You can adjust if needed.'
                    : 'Help the AI by entering the puzzle dimensions. Count the columns, rows, and number of dominoes in the tray.'}
                </Text>
              </View>

              {/* Auto-Detection Status */}
              {imageUri && (
                <View className="mx-5 mb-4">
                  <Pressable
                    onPress={handleAutoDetect}
                    disabled={isDetecting}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 12,
                      backgroundColor: detectionResult
                        ? detectionResult.confidence >= 0.8
                          ? '#22C55E20'
                          : detectionResult.confidence >= 0.5
                            ? '#F59E0B20'
                            : '#EF444420'
                        : isDark
                          ? '#2a2a2a'
                          : '#f0f0f0',
                      borderWidth: 1,
                      borderColor: detectionResult
                        ? detectionResult.confidence >= 0.8
                          ? '#22C55E'
                          : detectionResult.confidence >= 0.5
                            ? '#F59E0B'
                            : '#EF4444'
                        : isDark
                          ? '#444'
                          : '#ddd',
                      gap: 8,
                    }}
                  >
                    {isDetecting ? (
                      <>
                        <ActivityIndicator size="small" color="#3B82F6" />
                        <Text style={{ color: '#3B82F6', fontWeight: '500' }}>
                          Detecting dimensions...
                        </Text>
                      </>
                    ) : detectionResult ? (
                      <>
                        {detectionResult.confidence >= 0.8 ? (
                          <Check size={18} color="#22C55E" />
                        ) : (
                          <Wand2 size={18} color={detectionResult.confidence >= 0.5 ? '#F59E0B' : '#EF4444'} />
                        )}
                        <Text
                          style={{
                            color: detectionResult.confidence >= 0.8
                              ? '#22C55E'
                              : detectionResult.confidence >= 0.5
                                ? '#F59E0B'
                                : '#EF4444',
                            fontWeight: '500',
                          }}
                        >
                          {detectionResult.confidence >= 0.8
                            ? 'Auto-detected successfully!'
                            : detectionResult.confidence >= 0.5
                              ? 'Detected - please verify'
                              : 'Low confidence - please check'}
                          {' '}({Math.round(detectionResult.confidence * 100)}%)
                        </Text>
                      </>
                    ) : (
                      <>
                        <Wand2 size={18} color={isDark ? '#888' : '#666'} />
                        <Text style={{ color: isDark ? '#888' : '#666', fontWeight: '500' }}>
                          Tap to auto-detect
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}

              {/* Size Controls */}
              <View className="px-5 py-2">
                <NumberStepper
                  label="Columns (width)"
                  value={cols}
                  onChange={setCols}
                  min={2}
                  max={12}
                  isDark={isDark}
                />
                <NumberStepper
                  label="Rows (height)"
                  value={rows}
                  onChange={setRows}
                  min={2}
                  max={12}
                  isDark={isDark}
                />
                <NumberStepper
                  label="Dominoes"
                  value={dominoCount}
                  onChange={setDominoCount}
                  min={1}
                  max={30}
                  isDark={isDark}
                />
              </View>

              {/* Summary */}
              <View className="mx-5 my-3 p-3 rounded-xl" style={{ backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }}>
                <Text
                  style={{
                    fontSize: 14,
                    color: isDark ? '#aaa' : '#666',
                    textAlign: 'center',
                  }}
                >
                  {cols}×{rows} grid = {totalGridCells} cells total{'\n'}
                  {dominoCount} dominoes = {expectedCells} cells needed{'\n'}
                  {holes > 0 ? `${holes} holes/blocked cells` : 'No holes'}
                </Text>
              </View>

              {/* Buttons */}
              <View className="px-5 pt-2 gap-3">
                <Pressable
                  onPress={handleConfirm}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: '#3B82F6',
                    gap: 8,
                  }}
                >
                  <Sparkles size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>
                    Extract with Hints
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleSkip}
                  style={{
                    alignItems: 'center',
                    paddingVertical: 12,
                  }}
                >
                  <Text style={{ color: isDark ? '#888' : '#666', fontSize: 14 }}>
                    Skip - let AI figure it out
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
