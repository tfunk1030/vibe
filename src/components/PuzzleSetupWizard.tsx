import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  Image,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import {
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  Square,
  Move,
  Layers,
  Minus,
  Plus,
  Sparkles,
  RefreshCw,
} from 'lucide-react-native';
import { IslandConfig } from '@/lib/types/puzzle';
import { GridSizeHint, detectGridDimensions } from '@/lib/services/gemini';
import { IslandConfigModal } from './IslandConfigModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_CONTAINER_WIDTH = SCREEN_WIDTH - 40;

type WizardStep = 'mode' | 'size' | 'crop-domino' | 'crop-grid' | 'preview';

interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageDimensions {
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
}

interface PuzzleSetupWizardProps {
  visible: boolean;
  sourceImageUri: string;
  onComplete: (dominoUri: string, gridUri: string, sizeHint?: GridSizeHint) => void;
  onCompleteMulti?: (dominoUri: string, gridUris: string[], configs: IslandConfig[]) => void;
  onClose: () => void;
  isDark: boolean;
}

// Progress indicator component
function StepIndicator({
  steps,
  currentStep,
  isDark,
}: {
  steps: { key: WizardStep; label: string }[];
  currentStep: WizardStep;
  isDark: boolean;
}) {
  const currentIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <View className="flex-row items-center justify-center px-5 py-3">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <React.Fragment key={step.key}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: isCompleted
                  ? '#22C55E'
                  : isCurrent
                    ? '#3B82F6'
                    : isDark ? '#333' : '#e0e0e0',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isCompleted ? (
                <Check size={14} color="#fff" />
              ) : (
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: isCurrent ? '#fff' : isDark ? '#666' : '#999',
                  }}
                >
                  {index + 1}
                </Text>
              )}
            </View>
            {index < steps.length - 1 && (
              <View
                style={{
                  width: 24,
                  height: 2,
                  backgroundColor: index < currentIndex
                    ? '#22C55E'
                    : isDark ? '#333' : '#e0e0e0',
                  marginHorizontal: 4,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

// Number stepper for size inputs
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
  return (
    <View className="flex-row items-center justify-between py-3">
      <Text style={{ fontSize: 16, fontWeight: '600', color: isDark ? '#fff' : '#333' }}>
        {label}
      </Text>
      <View className="flex-row items-center gap-4">
        <Pressable
          onPress={() => value > min && (Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), onChange(value - 1))}
          disabled={value <= min}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: value <= min ? (isDark ? '#1a1a1a' : '#e0e0e0') : (isDark ? '#2a2a2a' : '#f0f0f0'),
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
          style={{ fontSize: 22, fontWeight: '700', color: isDark ? '#fff' : '#333', minWidth: 40, textAlign: 'center' }}
          accessibilityLabel={`${label}: ${value}`}
        >
          {value}
        </Text>
        <Pressable
          onPress={() => value < max && (Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), onChange(value + 1))}
          disabled={value >= max}
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: value >= max ? (isDark ? '#1a1a1a' : '#e0e0e0') : (isDark ? '#2a2a2a' : '#f0f0f0'),
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

// Crop box component
function CropBox({
  region,
  onRegionChange,
  containerWidth,
  containerHeight,
}: {
  region: CropRegion;
  onRegionChange: (region: CropRegion) => void;
  containerWidth: number;
  containerHeight: number;
}) {
  const startX = useSharedValue(region.x);
  const startY = useSharedValue(region.y);
  const startWidth = useSharedValue(region.width);
  const startHeight = useSharedValue(region.height);
  const x = useSharedValue(region.x);
  const y = useSharedValue(region.y);
  const width = useSharedValue(region.width);
  const height = useSharedValue(region.height);
  const MIN_SIZE = 50;

  const updateRegion = useCallback(() => {
    onRegionChange({ x: x.value, y: y.value, width: width.value, height: height.value });
  }, [onRegionChange, x, y, width, height]);

  const moveGesture = Gesture.Pan()
    .onStart(() => { startX.value = x.value; startY.value = y.value; })
    .onUpdate((e) => {
      x.value = Math.max(0, Math.min(containerWidth - width.value, startX.value + e.translationX));
      y.value = Math.max(0, Math.min(containerHeight - height.value, startY.value + e.translationY));
    })
    .onEnd(() => runOnJS(updateRegion)());

  const resizeGesture = Gesture.Pan()
    .onStart(() => { startWidth.value = width.value; startHeight.value = height.value; })
    .onUpdate((e) => {
      width.value = Math.max(MIN_SIZE, Math.min(containerWidth - x.value, startWidth.value + e.translationX));
      height.value = Math.max(MIN_SIZE, Math.min(containerHeight - y.value, startHeight.value + e.translationY));
    })
    .onEnd(() => runOnJS(updateRegion)());

  const boxStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value,
    borderWidth: 2,
    borderColor: '#3B82F6',
  }));

  const handleStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    right: -14,
    bottom: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  }));

  return (
    <>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} pointerEvents="none" />
      <GestureDetector gesture={moveGesture}>
        <Animated.View style={boxStyle}>
          <View style={{ flex: 1 }} />
          <View style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -18, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(59, 130, 246, 0.8)', justifyContent: 'center', alignItems: 'center' }}>
            <Move size={20} color="#fff" />
          </View>
          <View style={{ position: 'absolute', top: -2, left: -2, width: 24, height: 24, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#3B82F6' }} />
          <View style={{ position: 'absolute', top: -2, right: -2, width: 24, height: 24, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#3B82F6' }} />
          <View style={{ position: 'absolute', bottom: -2, left: -2, width: 24, height: 24, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#3B82F6' }} />
          <GestureDetector gesture={resizeGesture}>
            <Animated.View style={handleStyle}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' }} />
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      </GestureDetector>
    </>
  );
}

export function PuzzleSetupWizard({
  visible,
  sourceImageUri,
  onComplete,
  onCompleteMulti,
  onClose,
  isDark,
}: PuzzleSetupWizardProps) {
  // Wizard state
  const [step, setStep] = useState<WizardStep>('mode');
  const [isMultiIsland, setIsMultiIsland] = useState(false);
  const [islandConfigs, setIslandConfigs] = useState<IslandConfig[]>([]);
  const [currentIslandIndex, setCurrentIslandIndex] = useState(0);
  const [showIslandConfig, setShowIslandConfig] = useState(false);

  // Size hints
  const [cols, setCols] = useState(5);
  const [rows, setRows] = useState(5);
  const [dominoCount, setDominoCount] = useState(8);
  const [isDetecting, setIsDetecting] = useState(false);

  // Image and crop state
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null);
  const [dominoCropRegion, setDominoCropRegion] = useState<CropRegion>({ x: 20, y: 200, width: 200, height: 100 });
  const [gridCropRegion, setGridCropRegion] = useState<CropRegion>({ x: 20, y: 20, width: 200, height: 200 });
  const [islandCropRegions, setIslandCropRegions] = useState<CropRegion[]>([]);

  // Cropped images
  const [dominoImageUri, setDominoImageUri] = useState<string | null>(null);
  const [gridImageUri, setGridImageUri] = useState<string | null>(null);
  const [gridImageUris, setGridImageUris] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Define steps based on mode
  const steps: { key: WizardStep; label: string }[] = isMultiIsland
    ? [
        { key: 'mode', label: 'Type' },
        { key: 'size', label: 'Size' },
        { key: 'crop-domino', label: 'Dominoes' },
        { key: 'crop-grid', label: 'Grids' },
        { key: 'preview', label: 'Review' },
      ]
    : [
        { key: 'mode', label: 'Type' },
        { key: 'size', label: 'Size' },
        { key: 'crop-domino', label: 'Dominoes' },
        { key: 'crop-grid', label: 'Grid' },
        { key: 'preview', label: 'Review' },
      ];

  // Reset on open
  useEffect(() => {
    if (visible && sourceImageUri) {
      setStep('mode');
      setIsMultiIsland(false);
      setIslandConfigs([]);
      setCurrentIslandIndex(0);
      setShowIslandConfig(false);
      setCols(5);
      setRows(5);
      setDominoCount(8);
      setDominoImageUri(null);
      setGridImageUri(null);
      setGridImageUris([]);
      setIsProcessing(false);

      Image.getSize(sourceImageUri, (w, h) => {
        const aspectRatio = w / h;
        let displayWidth = IMAGE_CONTAINER_WIDTH;
        let displayHeight = displayWidth / aspectRatio;
        // Dynamic max height based on screen size minus UI chrome
        const windowHeight = Dimensions.get('window').height;
        const chromeHeight = 180; // header + size hints + button + padding
        const maxHeight = windowHeight - chromeHeight;
        if (displayHeight > maxHeight) {
          displayHeight = maxHeight;
          displayWidth = displayHeight * aspectRatio;
        }
        setImageDimensions({ width: w, height: h, displayWidth, displayHeight });

        // Better default crop positions based on typical NYT Pips layout
        // Dominoes are usually at the bottom ~25% of the image
        setDominoCropRegion({
          x: displayWidth * 0.1,
          y: displayHeight * 0.72,
          width: displayWidth * 0.8,
          height: displayHeight * 0.24,
        });
        // Grid is usually in the top ~60% of the image
        setGridCropRegion({
          x: displayWidth * 0.15,
          y: displayHeight * 0.12,
          width: displayWidth * 0.7,
          height: displayHeight * 0.52,
        });
      });
    }
  }, [visible, sourceImageUri]);

  // Auto-detect dimensions
  const handleAutoDetect = useCallback(async () => {
    if (!sourceImageUri) return;
    setIsDetecting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const base64 = await FileSystem.readAsStringAsync(sourceImageUri, { encoding: 'base64' });
      const result = await detectGridDimensions(base64);
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
  }, [sourceImageUri]);

  // Crop image helper
  const cropImage = useCallback(async (region: CropRegion): Promise<string> => {
    if (!imageDimensions) throw new Error('Image dimensions not loaded');
    const scaleX = imageDimensions.width / imageDimensions.displayWidth;
    const scaleY = imageDimensions.height / imageDimensions.displayHeight;
    const result = await ImageManipulator.manipulateAsync(
      sourceImageUri,
      [{ crop: {
        originX: Math.round(region.x * scaleX),
        originY: Math.round(region.y * scaleY),
        width: Math.round(region.width * scaleX),
        height: Math.round(region.height * scaleY),
      }}],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  }, [sourceImageUri, imageDimensions]);

  // Navigation handlers
  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const stepOrder: WizardStep[] = ['mode', 'size', 'crop-domino', 'crop-grid', 'preview'];
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex > 0) {
      setStep(stepOrder[currentIndex - 1]);
    }
  }, [step]);

  const handleSelectMode = useCallback((multi: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsMultiIsland(multi);
    if (multi) {
      setIslandConfigs([
        { id: 'island-1', cols: 5, rows: 5 },
        { id: 'island-2', cols: 5, rows: 5 },
      ]);
      setIslandCropRegions([
        { x: 20, y: 20, width: 150, height: 150 },
        { x: 20, y: 20, width: 150, height: 150 },
      ]);
      setGridImageUris([]);
      setCurrentIslandIndex(0);
    }
    if (!multi) {
      setIslandConfigs([]);
      setIslandCropRegions([]);
      setGridImageUris([]);
      setCurrentIslandIndex(0);
    }
    setStep('size');
    handleAutoDetect();
  }, [handleAutoDetect]);

  const handleUpdateIslands = useCallback((configs: IslandConfig[]) => {
    setIslandConfigs(configs);
    setIslandCropRegions(configs.map(() => ({ x: 20, y: 20, width: 150, height: 150 })));
    setGridImageUris([]);
    setCurrentIslandIndex(0);
    setShowIslandConfig(false);
  }, []);

  const handleSizeNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('crop-domino');
  }, []);

  const handleCropDomino = useCallback(async () => {
    try {
      setIsProcessing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const croppedUri = await cropImage(dominoCropRegion);
      setDominoImageUri(croppedUri);
      setStep('crop-grid');
    } catch (error) {
      console.error('Error cropping domino region:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [cropImage, dominoCropRegion]);

  const handleCropGrid = useCallback(async () => {
    try {
      setIsProcessing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (isMultiIsland) {
        const region = islandCropRegions[currentIslandIndex];
        const croppedUri = await cropImage(region);
        const newGridUris = [...gridImageUris, croppedUri];
        setGridImageUris(newGridUris);

        if (currentIslandIndex < islandConfigs.length - 1) {
          setCurrentIslandIndex(currentIslandIndex + 1);
        } else {
          setStep('preview');
        }
      } else {
        const croppedUri = await cropImage(gridCropRegion);
        setGridImageUri(croppedUri);
        setStep('preview');
      }
    } catch (error) {
      console.error('Error cropping grid region:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [cropImage, gridCropRegion, isMultiIsland, islandCropRegions, currentIslandIndex, gridImageUris, islandConfigs.length]);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('crop-domino');
    setDominoImageUri(null);
    setGridImageUri(null);
    setGridImageUris([]);
    setCurrentIslandIndex(0);
  }, []);

  const handleComplete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const sizeHint: GridSizeHint = { cols, rows, dominoCount };

    if (isMultiIsland && onCompleteMulti && dominoImageUri && gridImageUris.length === islandConfigs.length) {
      onCompleteMulti(dominoImageUri, gridImageUris, islandConfigs);
    } else if (dominoImageUri && gridImageUri) {
      onComplete(dominoImageUri, gridImageUri, sizeHint);
    }
  }, [cols, rows, dominoCount, isMultiIsland, onCompleteMulti, dominoImageUri, gridImageUris, islandConfigs, onComplete, gridImageUri]);

  // Render mode selection step
  const renderModeStep = () => (
    <Animated.View entering={FadeInRight} className="flex-1 px-5 pt-4">
      <Text style={{ fontSize: 22, fontWeight: '700', color: isDark ? '#fff' : '#000', marginBottom: 8 }}>
        What type of puzzle?
      </Text>
      <Text style={{ fontSize: 14, color: isDark ? '#888' : '#666', marginBottom: 24 }}>
        Most NYT Pips puzzles have a single grid, but some have multiple separate islands.
      </Text>

      <Pressable
        onPress={() => handleSelectMode(false)}
        style={{
          backgroundColor: isDark ? '#1a1a2e' : '#fff',
          borderRadius: 16,
          padding: 20,
          marginBottom: 12,
          borderWidth: 2,
          borderColor: '#3B82F6',
        }}
        accessibilityLabel="Single Grid"
        accessibilityHint="Standard puzzle with one connected area"
        accessibilityRole="button"
      >
        <View className="flex-row items-center gap-4">
          <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#3B82F620', alignItems: 'center', justifyContent: 'center' }}>
            <Grid3X3 size={24} color="#3B82F6" />
          </View>
          <View className="flex-1">
            <Text style={{ fontSize: 17, fontWeight: '700', color: isDark ? '#fff' : '#000', marginBottom: 4 }}>
              Single Grid
            </Text>
            <Text style={{ fontSize: 13, color: isDark ? '#888' : '#666' }}>
              Standard puzzle with one connected area
            </Text>
          </View>
          <ChevronRight size={20} color={isDark ? '#666' : '#999'} />
        </View>
      </Pressable>

      <Pressable
        onPress={() => handleSelectMode(true)}
        style={{
          backgroundColor: isDark ? '#1a1a2e' : '#fff',
          borderRadius: 16,
          padding: 20,
          borderWidth: 1,
          borderColor: isDark ? '#333' : '#e0e0e0',
        }}
        accessibilityLabel="Multiple Islands"
        accessibilityHint="Separate grids sharing one domino pool"
        accessibilityRole="button"
      >
        <View className="flex-row items-center gap-4">
          <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#8B5CF620', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={24} color="#8B5CF6" />
          </View>
          <View className="flex-1">
            <Text style={{ fontSize: 17, fontWeight: '700', color: isDark ? '#fff' : '#000', marginBottom: 4 }}>
              Multiple Islands
            </Text>
            <Text style={{ fontSize: 13, color: isDark ? '#888' : '#666' }}>
              Separate grids sharing one domino pool
            </Text>
          </View>
          <ChevronRight size={20} color={isDark ? '#666' : '#999'} />
        </View>
      </Pressable>
    </Animated.View>
  );

  // Render size step
  const renderSizeStep = () => {
    const expectedCells = dominoCount * 2;
    const totalGridCells = cols * rows;
    const holes = totalGridCells - expectedCells;

    return (
      <Animated.View entering={FadeInRight} className="flex-1 px-5 pt-4">
        <Text style={{ fontSize: 22, fontWeight: '700', color: isDark ? '#fff' : '#000', marginBottom: 8 }}>
          Puzzle dimensions
        </Text>
        <Text style={{ fontSize: 14, color: isDark ? '#888' : '#666', marginBottom: 16 }}>
          These hints help the AI extract your puzzle more accurately.
        </Text>

        {/* Auto-detect button */}
        <Pressable
          onPress={handleAutoDetect}
          disabled={isDetecting}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 48,
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0',
            marginBottom: 20,
            gap: 8,
          }}
          accessibilityLabel={isDetecting ? 'Detecting puzzle dimensions' : 'Auto-detect from image'}
          accessibilityHint="Automatically detect grid size and domino count"
          accessibilityRole="button"
          accessibilityState={{ disabled: isDetecting }}
        >
          {isDetecting ? (
            <ActivityIndicator size="small" color="#3B82F6" />
          ) : (
            <Sparkles size={18} color="#3B82F6" />
          )}
          <Text style={{ color: '#3B82F6', fontWeight: '600' }}>
            {isDetecting ? 'Detecting...' : 'Auto-detect from image'}
          </Text>
        </Pressable>

        <View style={{ backgroundColor: isDark ? '#1a1a2e' : '#fff', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <NumberStepper label="Columns" value={cols} onChange={setCols} min={2} max={12} isDark={isDark} />
          <NumberStepper label="Rows" value={rows} onChange={setRows} min={2} max={12} isDark={isDark} />
          <NumberStepper label="Dominoes" value={dominoCount} onChange={setDominoCount} min={1} max={30} isDark={isDark} />
        {isMultiIsland && (
          <View style={{ marginTop: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? '#fff' : '#111' }}>
                  Islands
                </Text>
                <Text style={{ fontSize: 13, color: isDark ? '#888' : '#666' }}>
                  {islandConfigs.length} island{islandConfigs.length === 1 ? '' : 's'} configured
                </Text>
              </View>
              <Pressable
                onPress={() => setShowIslandConfig(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0',
                  gap: 8,
                }}
                accessibilityLabel="Configure islands"
                accessibilityRole="button"
              >
                <Layers size={18} color={isDark ? '#fff' : '#3B82F6'} />
                <Text style={{ color: isDark ? '#fff' : '#111', fontWeight: '600' }}>Configure</Text>
              </Pressable>
            </View>
            <Text style={{ fontSize: 13, color: isDark ? '#777' : '#666' }}>
              Adjust how many islands to crop (up to 5). Each island will be cropped separately.
            </Text>
          </View>
        )}
        </View>

        {/* Summary */}
        <View style={{ backgroundColor: isDark ? '#1a1a2e' : '#f0f0f0', borderRadius: 12, padding: 12 }}>
          <Text style={{ fontSize: 13, color: isDark ? '#aaa' : '#666', textAlign: 'center' }}>
            {cols}×{rows} = {totalGridCells} cells • {dominoCount} dominoes = {expectedCells} needed
            {holes > 0 ? ` • ${holes} holes` : ''}
          </Text>
        </View>

        <View className="flex-1" />

        <Pressable
          onPress={handleSizeNext}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 56,
            paddingVertical: 16,
            borderRadius: 14,
            backgroundColor: '#3B82F6',
            marginBottom: 8,
            gap: 8,
          }}
          accessibilityLabel="Continue to Crop"
          accessibilityHint="Proceed to cropping the domino and grid areas"
          accessibilityRole="button"
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Continue to Crop</Text>
          <ChevronRight size={20} color="#fff" />
        </Pressable>
      </Animated.View>
    );
  };

  // Render crop step
  const renderCropStep = (
    title: string,
    subtitle: string,
    region: CropRegion,
    onRegionChange: (r: CropRegion) => void,
    onConfirm: () => void,
    icon: React.ReactNode
  ) => (
    <Animated.View entering={FadeInRight} className="flex-1">
      {/* Compact header with title */}
      <View className="flex-row items-center px-5 py-2">
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#3B82F620', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
          {icon}
        </View>
        <View className="flex-1">
          <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? '#fff' : '#000' }}>{title}</Text>
          <Text style={{ fontSize: 12, color: isDark ? '#888' : '#666' }}>{subtitle}</Text>
        </View>
        {/* Reference thumbnail */}
        <Pressable
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            overflow: 'hidden',
            borderWidth: 2,
            borderColor: isDark ? '#444' : '#ddd',
          }}
          accessibilityLabel="Reference image thumbnail"
          accessibilityHint="Tap to preview the original image"
          accessibilityRole="button"
        >
          <Image
            source={{ uri: sourceImageUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            accessible={true}
            accessibilityLabel="Original puzzle screenshot"
          />
        </Pressable>
      </View>
      
      {/* Size hints bar - compact */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingBottom: 4
      }}>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          backgroundColor: isDark ? '#2a2a4a' : '#e8e8f0', 
          paddingHorizontal: 10, 
          paddingVertical: 4, 
          borderRadius: 8,
          gap: 4,
        }}>
          <Grid3X3 size={14} color="#3B82F6" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#aaa' : '#555' }}>
            {cols}×{rows}
          </Text>
        </View>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          backgroundColor: isDark ? '#2a4a2a' : '#e8f0e8', 
          paddingHorizontal: 10, 
          paddingVertical: 4, 
          borderRadius: 8,
          gap: 4,
        }}>
          <Square size={14} color="#22C55E" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#aaa' : '#555' }}>
            {dominoCount} dominoes
          </Text>
        </View>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          backgroundColor: isDark ? '#4a3a2a' : '#f0e8e0', 
          paddingHorizontal: 10, 
          paddingVertical: 4, 
          borderRadius: 8,
          gap: 4,
        }}>
          <Layers size={14} color="#F59E0B" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: isDark ? '#aaa' : '#555' }}>
            {dominoCount * 2} cells
          </Text>
        </View>
      </View>

      {imageDimensions && (
        <View className="items-center justify-center flex-1" style={{ paddingHorizontal: 20 }}>
          <GestureHandlerRootView>
            <View style={{ width: imageDimensions.displayWidth, height: imageDimensions.displayHeight, position: 'relative' }}>
              <Image
                source={{ uri: sourceImageUri }}
                style={{ width: imageDimensions.displayWidth, height: imageDimensions.displayHeight, borderRadius: 12 }}
                resizeMode="contain"
              />
              <CropBox
                region={region}
                onRegionChange={onRegionChange}
                containerWidth={imageDimensions.displayWidth}
                containerHeight={imageDimensions.displayHeight}
              />
            </View>
          </GestureHandlerRootView>
        </View>
      )}

      <View className="px-5 py-4">
        <Pressable
          onPress={onConfirm}
          disabled={isProcessing}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 56,
            paddingVertical: 16,
            borderRadius: 14,
            backgroundColor: '#3B82F6',
            gap: 8,
          }}
          accessibilityLabel={isProcessing ? 'Processing crop' : 'Confirm Crop'}
          accessibilityHint="Confirm the selected crop area"
          accessibilityRole="button"
          accessibilityState={{ disabled: isProcessing }}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Check size={20} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Confirm Crop</Text>
            </>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );

  // Render preview step
  const renderPreviewStep = () => (
    <Animated.View entering={FadeInRight} className="flex-1 px-5 pt-4">
      <Text style={{ fontSize: 22, fontWeight: '700', color: isDark ? '#fff' : '#000', marginBottom: 16 }}>
        Review your crops
      </Text>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="mb-4">
          <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? '#888' : '#666', marginBottom: 8 }}>
            Domino Tray
          </Text>
          {dominoImageUri && (
            <Image
              source={{ uri: dominoImageUri }}
              style={{ width: '100%', height: 100, borderRadius: 12, backgroundColor: isDark ? '#222' : '#eee' }}
              resizeMode="contain"
            />
          )}
        </View>

        <View className="mb-4">
          <Text style={{ fontSize: 14, fontWeight: '600', color: isDark ? '#888' : '#666', marginBottom: 8 }}>
            {isMultiIsland ? `Grid Islands (${gridImageUris.length})` : 'Puzzle Grid'}
          </Text>
          {isMultiIsland ? (
            <View className="flex-row flex-wrap gap-2">
              {gridImageUris.map((uri, i) => (
                <Image
                  key={i}
                  source={{ uri }}
                  style={{ width: '48%', height: 120, borderRadius: 12, backgroundColor: isDark ? '#222' : '#eee' }}
                  resizeMode="contain"
                />
              ))}
            </View>
          ) : gridImageUri ? (
            <Image
              source={{ uri: gridImageUri }}
              style={{ width: '100%', height: 180, borderRadius: 12, backgroundColor: isDark ? '#222' : '#eee' }}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </ScrollView>

      <View className="flex-row gap-3 pt-2 pb-4">
        <Pressable
          onPress={handleReset}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 56,
            paddingVertical: 16,
            borderRadius: 14,
            backgroundColor: isDark ? '#333' : '#e5e5e5',
            gap: 8,
          }}
          accessibilityLabel="Redo crops"
          accessibilityHint="Go back and recrop the domino and grid areas"
          accessibilityRole="button"
        >
          <RefreshCw size={18} color={isDark ? '#fff' : '#333'} />
          <Text style={{ color: isDark ? '#fff' : '#333', fontWeight: '700', fontSize: 15 }}>Redo</Text>
        </Pressable>
        <Pressable
          onPress={handleComplete}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 56,
            paddingVertical: 16,
            borderRadius: 14,
            backgroundColor: '#22C55E',
            gap: 8,
          }}
          accessibilityLabel="Analyze puzzle"
          accessibilityHint="Start AI analysis of your puzzle"
          accessibilityRole="button"
        >
          <Sparkles size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Analyze</Text>
        </Pressable>
      </View>
    </Animated.View>
  );

  const canGoBack = step !== 'mode';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: isDark ? '#111' : '#f5f5f5' }}>
        <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
          {/* Header */}
          <View className="flex-row items-center justify-between px-4 py-2" style={{ borderBottomWidth: 1, borderBottomColor: isDark ? '#333' : '#e0e0e0' }}>
            <Pressable
              onPress={canGoBack ? handleBack : onClose}
              style={{ minWidth: 48, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}
              accessibilityLabel={canGoBack ? "Go back" : "Close wizard"}
              accessibilityRole="button"
            >
              {canGoBack ? (
                <ChevronLeft size={24} color={isDark ? '#fff' : '#333'} />
              ) : (
                <X size={24} color={isDark ? '#fff' : '#333'} />
              )}
            </Pressable>

            <StepIndicator steps={steps} currentStep={step} isDark={isDark} />

            <View style={{ width: 44 }} />
          </View>

          {/* Content */}
          {step === 'mode' && renderModeStep()}
          {step === 'size' && renderSizeStep()}
          {step === 'crop-domino' && renderCropStep(
            'Crop Domino Tray',
            'Select the area with dominoes',
            dominoCropRegion,
            setDominoCropRegion,
            handleCropDomino,
            <Square size={22} color="#3B82F6" />
          )}
          {step === 'crop-grid' && (
            isMultiIsland && islandCropRegions[currentIslandIndex]
              ? renderCropStep(
                  `Crop Island ${currentIslandIndex + 1}`,
                  `Select grid ${currentIslandIndex + 1} of ${islandConfigs.length}`,
                  islandCropRegions[currentIslandIndex],
                  (r) => {
                    const updated = [...islandCropRegions];
                    updated[currentIslandIndex] = r;
                    setIslandCropRegions(updated);
                  },
                  handleCropGrid,
                  <Layers size={22} color="#3B82F6" />
                )
              : renderCropStep(
                  'Crop Puzzle Grid',
                  'Select the puzzle area',
                  gridCropRegion,
                  setGridCropRegion,
                  handleCropGrid,
                  <Grid3X3 size={22} color="#3B82F6" />
                )
          )}
          {step === 'preview' && renderPreviewStep()}
        </SafeAreaView>
        <IslandConfigModal
          visible={showIslandConfig}
          onClose={() => setShowIslandConfig(false)}
          onConfirm={handleUpdateIslands}
          isDark={isDark}
        />
      </View>
    </Modal>
  );
}
