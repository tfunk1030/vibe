import React, { useState, useCallback, useRef } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
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
  RefreshCw,
  Grid3X3,
  Square,
  Move,
  Layers,
} from 'lucide-react-native';
import { IslandConfig } from '@/lib/types/puzzle';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_CONTAINER_WIDTH = SCREEN_WIDTH - 40;

interface DualImageCropperProps {
  visible: boolean;
  sourceImageUri: string;
  onComplete: (dominoUri: string, gridUri: string) => void;
  onClose: () => void;
  isDark: boolean;
  // Multi-island support
  islandConfigs?: IslandConfig[];
  onCompleteMulti?: (dominoUri: string, gridUris: string[]) => void;
}

// Step can be 'domino', 'grid' (single), 'grid-0', 'grid-1', etc (multi), or 'preview'
type CropStep = 'domino' | 'grid' | 'preview' | `grid-${number}`;

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

function CropBox({
  region,
  onRegionChange,
  containerWidth,
  containerHeight,
  isDark,
}: {
  region: CropRegion;
  onRegionChange: (region: CropRegion) => void;
  containerWidth: number;
  containerHeight: number;
  isDark: boolean;
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
    onRegionChange({
      x: x.value,
      y: y.value,
      width: width.value,
      height: height.value,
    });
  }, [onRegionChange, x, y, width, height]);

  // Move gesture for the entire box
  const moveGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      const newX = Math.max(0, Math.min(containerWidth - width.value, startX.value + e.translationX));
      const newY = Math.max(0, Math.min(containerHeight - height.value, startY.value + e.translationY));
      x.value = newX;
      y.value = newY;
    })
    .onEnd(() => {
      runOnJS(updateRegion)();
    });

  // Resize gesture for bottom-right corner
  const resizeGesture = Gesture.Pan()
    .onStart(() => {
      startWidth.value = width.value;
      startHeight.value = height.value;
    })
    .onUpdate((e) => {
      const newWidth = Math.max(MIN_SIZE, Math.min(containerWidth - x.value, startWidth.value + e.translationX));
      const newHeight = Math.max(MIN_SIZE, Math.min(containerHeight - y.value, startHeight.value + e.translationY));
      width.value = newWidth;
      height.value = newHeight;
    })
    .onEnd(() => {
      runOnJS(updateRegion)();
    });

  const boxStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x.value,
    top: y.value,
    width: width.value,
    height: height.value,
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: 'transparent',
  }));

  const handleStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    right: -12,
    bottom: -12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  }));

  return (
    <>
      {/* Darkened overlay outside crop area */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}
        pointerEvents="none"
      />

      <GestureDetector gesture={moveGesture}>
        <Animated.View style={boxStyle}>
          {/* Clear area inside crop box */}
          <View
            style={{
              flex: 1,
              backgroundColor: 'transparent',
            }}
          />

          {/* Move indicator */}
          <View
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginLeft: -16,
              marginTop: -16,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(59, 130, 246, 0.8)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Move size={18} color="#fff" />
          </View>

          {/* Corner markers */}
          <View style={{ position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#3B82F6' }} />
          <View style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#3B82F6' }} />
          <View style={{ position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#3B82F6' }} />

          {/* Resize handle */}
          <GestureDetector gesture={resizeGesture}>
            <Animated.View style={handleStyle}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
            </Animated.View>
          </GestureDetector>
        </Animated.View>
      </GestureDetector>
    </>
  );
}

export function DualImageCropper({
  visible,
  sourceImageUri,
  onComplete,
  onClose,
  isDark,
  islandConfigs,
  onCompleteMulti,
}: DualImageCropperProps) {
  const isMultiIsland = !!(islandConfigs && islandConfigs.length > 0);
  const islandCount = islandConfigs?.length || 1;

  const [step, setStep] = useState<CropStep>('domino');
  const [dominoImageUri, setDominoImageUri] = useState<string | null>(null);
  const [gridImageUri, setGridImageUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null);

  // Multi-island: array of grid image URIs
  const [gridImageUris, setGridImageUris] = useState<string[]>([]);
  // Multi-island: current island index being cropped
  const [currentIslandIndex, setCurrentIslandIndex] = useState(0);

  // Default crop regions (will be set when image loads)
  const [dominoCropRegion, setDominoCropRegion] = useState<CropRegion>({
    x: 20,
    y: 200,
    width: 200,
    height: 100,
  });
  const [gridCropRegion, setGridCropRegion] = useState<CropRegion>({
    x: 20,
    y: 20,
    width: 200,
    height: 200,
  });
  // Multi-island: array of crop regions for each island
  const [islandCropRegions, setIslandCropRegions] = useState<CropRegion[]>([]);

  // Reset state when modal opens
  React.useEffect(() => {
    if (visible && sourceImageUri) {
      setStep('domino');
      setDominoImageUri(null);
      setGridImageUri(null);
      setGridImageUris([]);
      setCurrentIslandIndex(0);
      setIsProcessing(false);

      // Get image dimensions
      Image.getSize(sourceImageUri, (w, h) => {
        const aspectRatio = w / h;
        let displayWidth = IMAGE_CONTAINER_WIDTH;
        let displayHeight = displayWidth / aspectRatio;

        // Cap height
        const maxHeight = 400;
        if (displayHeight > maxHeight) {
          displayHeight = maxHeight;
          displayWidth = displayHeight * aspectRatio;
        }

        setImageDimensions({
          width: w,
          height: h,
          displayWidth,
          displayHeight,
        });

        // Set default crop regions optimized for NYT Pips layout
        // NYT puzzles have consistent layout: grid top ~60%, domino tray bottom ~35%

        // Domino tray - positioned for NYT's bottom tray area
        setDominoCropRegion({
          x: displayWidth * 0.05,
          y: displayHeight * 0.68,
          width: displayWidth * 0.9,
          height: displayHeight * 0.28,
        });

        // Grid - positioned with room for NYT app header (for single island)
        setGridCropRegion({
          x: displayWidth * 0.05,
          y: displayHeight * 0.08,
          width: displayWidth * 0.9,
          height: displayHeight * 0.55,
        });

        // Multi-island: initialize crop regions for each island
        if (isMultiIsland && islandConfigs) {
          const regions: CropRegion[] = islandConfigs.map((_, i) => ({
            x: displayWidth * 0.1,
            y: displayHeight * 0.1,
            width: displayWidth * 0.8,
            height: displayHeight * 0.5,
          }));
          setIslandCropRegions(regions);
        }
      });
    }
  }, [visible, sourceImageUri, isMultiIsland, islandConfigs]);

  const cropImage = useCallback(
    async (region: CropRegion): Promise<string> => {
      if (!imageDimensions) throw new Error('Image dimensions not loaded');

      // Convert display coordinates to actual image coordinates
      const scaleX = imageDimensions.width / imageDimensions.displayWidth;
      const scaleY = imageDimensions.height / imageDimensions.displayHeight;

      const cropData = {
        originX: Math.round(region.x * scaleX),
        originY: Math.round(region.y * scaleY),
        width: Math.round(region.width * scaleX),
        height: Math.round(region.height * scaleY),
      };

      const result = await ImageManipulator.manipulateAsync(
        sourceImageUri,
        [{ crop: cropData }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      return result.uri;
    },
    [sourceImageUri, imageDimensions]
  );

  const handleConfirmDominoCrop = useCallback(async () => {
    try {
      setIsProcessing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const croppedUri = await cropImage(dominoCropRegion);
      setDominoImageUri(croppedUri);

      // Multi-island: go to first island crop, otherwise single grid crop
      if (isMultiIsland) {
        setCurrentIslandIndex(0);
        setStep('grid-0');
      } else {
        setStep('grid');
      }
    } catch (error) {
      console.error('Error cropping domino region:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [cropImage, dominoCropRegion, isMultiIsland]);

  const handleConfirmGridCrop = useCallback(async () => {
    try {
      setIsProcessing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const croppedUri = await cropImage(gridCropRegion);
      setGridImageUri(croppedUri);
      setStep('preview');
    } catch (error) {
      console.error('Error cropping grid region:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [cropImage, gridCropRegion]);

  // Multi-island: crop handler for each island
  const handleConfirmIslandCrop = useCallback(async () => {
    try {
      setIsProcessing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const region = islandCropRegions[currentIslandIndex];
      const croppedUri = await cropImage(region);

      // Add to array of grid URIs
      const newGridUris = [...gridImageUris, croppedUri];
      setGridImageUris(newGridUris);

      // Move to next island or preview
      if (currentIslandIndex < islandCount - 1) {
        const nextIndex = currentIslandIndex + 1;
        setCurrentIslandIndex(nextIndex);
        setStep(`grid-${nextIndex}` as CropStep);
      } else {
        setStep('preview');
      }
    } catch (error) {
      console.error('Error cropping island region:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [cropImage, islandCropRegions, currentIslandIndex, gridImageUris, islandCount]);

  // Update island crop region
  const handleIslandCropRegionChange = useCallback((index: number, region: CropRegion) => {
    setIslandCropRegions(prev => {
      const updated = [...prev];
      updated[index] = region;
      return updated;
    });
  }, []);

  const handleReset = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('domino');
    setDominoImageUri(null);
    setGridImageUri(null);
    setGridImageUris([]);
    setCurrentIslandIndex(0);
  }, []);

  const handleComplete = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (isMultiIsland && onCompleteMulti && dominoImageUri && gridImageUris.length === islandCount) {
      onCompleteMulti(dominoImageUri, gridImageUris);
    } else if (dominoImageUri && gridImageUri) {
      onComplete(dominoImageUri, gridImageUri);
    }
  }, [dominoImageUri, gridImageUri, gridImageUris, isMultiIsland, islandCount, onComplete, onCompleteMulti]);

  const canComplete = isMultiIsland
    ? dominoImageUri && gridImageUris.length === islandCount
    : dominoImageUri && gridImageUri;

  const renderCropView = (
    title: string,
    subtitle: string,
    region: CropRegion,
    onRegionChange: (r: CropRegion) => void,
    onConfirm: () => void,
    icon: React.ReactNode
  ) => (
    <View className="flex-1">
      {/* Header */}
      <View className="flex-row items-center px-5 py-3">
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: '#3B82F6' }}
        >
          {icon}
        </View>
        <View className="flex-1">
          <Text
            className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
          >
            {title}
          </Text>
          <Text
            className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
          >
            {subtitle}
          </Text>
        </View>
      </View>

      {/* Image with crop overlay */}
      {imageDimensions && (
        <View
          className="items-center justify-center flex-1"
          style={{ paddingHorizontal: 20 }}
        >
          <GestureHandlerRootView>
            <View
              style={{
                width: imageDimensions.displayWidth,
                height: imageDimensions.displayHeight,
                position: 'relative',
              }}
            >
              <Image
                source={{ uri: sourceImageUri }}
                style={{
                  width: imageDimensions.displayWidth,
                  height: imageDimensions.displayHeight,
                  borderRadius: 8,
                }}
                resizeMode="contain"
              />
              <CropBox
                region={region}
                onRegionChange={onRegionChange}
                containerWidth={imageDimensions.displayWidth}
                containerHeight={imageDimensions.displayHeight}
                isDark={isDark}
              />
            </View>
          </GestureHandlerRootView>
        </View>
      )}

      {/* Confirm button */}
      <View className="px-5 py-4">
        <Pressable
          onPress={onConfirm}
          disabled={isProcessing}
          className="py-4 rounded-xl items-center flex-row justify-center"
          style={{ backgroundColor: '#3B82F6' }}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Check size={20} color="#fff" />
              <Text className="text-white font-bold text-lg ml-2">
                Confirm Crop
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );

  const renderPreview = () => (
    <View className="flex-1 px-5">
      <Text
        className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}
      >
        Review Cropped Images
      </Text>

      {/* Domino preview */}
      <View className="mb-4">
        <Text
          className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
        >
          Domino Tray
        </Text>
        {dominoImageUri && (
          <Image
            source={{ uri: dominoImageUri }}
            style={{
              width: '100%',
              height: 120,
              borderRadius: 8,
            }}
            resizeMode="contain"
          />
        )}
      </View>

      {/* Grid preview */}
      <View className="mb-4">
        <Text
          className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
        >
          Puzzle Grid
        </Text>
        {gridImageUri && (
          <Image
            source={{ uri: gridImageUri }}
            style={{
              width: '100%',
              height: 180,
              borderRadius: 8,
            }}
            resizeMode="contain"
          />
        )}
      </View>

      {/* Actions */}
      <View className="flex-row gap-3 mt-4">
        <Pressable
          onPress={handleReset}
          className="flex-1 py-4 rounded-xl items-center flex-row justify-center"
          style={{ backgroundColor: isDark ? '#333' : '#e5e5e5' }}
        >
          <RefreshCw size={20} color={isDark ? '#fff' : '#333'} />
          <Text
            className={`font-bold text-base ml-2 ${isDark ? 'text-white' : 'text-gray-900'}`}
          >
            Redo
          </Text>
        </Pressable>
        <Pressable
          onPress={handleComplete}
          className="flex-1 py-4 rounded-xl items-center flex-row justify-center"
          style={{ backgroundColor: '#22C55E' }}
        >
          <Check size={20} color="#fff" />
          <Text className="text-white font-bold text-base ml-2">Analyze</Text>
        </Pressable>
      </View>
    </View>
  );

  // Multi-island preview
  const renderMultiPreview = () => (
    <View className="flex-1 px-5">
      <Text
        className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}
      >
        Review {islandCount} Islands
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Domino preview */}
        <View className="mb-4">
          <Text
            className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
          >
            Domino Tray
          </Text>
          {dominoImageUri && (
            <Image
              source={{ uri: dominoImageUri }}
              style={{
                width: '100%',
                height: 100,
                borderRadius: 8,
              }}
              resizeMode="contain"
            />
          )}
        </View>

        {/* Islands preview */}
        <View className="flex-row flex-wrap gap-2">
          {gridImageUris.map((uri, index) => (
            <View key={index} style={{ width: '48%' }} className="mb-3">
              <Text
                className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
              >
                Island {index + 1}
                {islandConfigs?.[index] && ` (${islandConfigs[index].cols}×${islandConfigs[index].rows})`}
              </Text>
              <Image
                source={{ uri }}
                style={{
                  width: '100%',
                  height: 120,
                  borderRadius: 8,
                  backgroundColor: isDark ? '#222' : '#eee',
                }}
                resizeMode="contain"
              />
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Actions */}
      <View className="flex-row gap-3 pt-2">
        <Pressable
          onPress={handleReset}
          className="flex-1 py-4 rounded-xl items-center flex-row justify-center"
          style={{ backgroundColor: isDark ? '#333' : '#e5e5e5' }}
        >
          <RefreshCw size={20} color={isDark ? '#fff' : '#333'} />
          <Text
            className={`font-bold text-base ml-2 ${isDark ? 'text-white' : 'text-gray-900'}`}
          >
            Redo
          </Text>
        </Pressable>
        <Pressable
          onPress={handleComplete}
          disabled={!canComplete}
          className="flex-1 py-4 rounded-xl items-center flex-row justify-center"
          style={{
            backgroundColor: canComplete ? '#22C55E' : '#666',
            opacity: canComplete ? 1 : 0.5,
          }}
        >
          <Check size={20} color="#fff" />
          <Text className="text-white font-bold text-base ml-2">Analyze</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        className="flex-1"
        style={{ backgroundColor: isDark ? '#111' : '#f5f5f5' }}
      >
        <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
          {/* Header */}
          <View
            className="flex-row items-center justify-between px-5 py-3"
            style={{
              borderBottomWidth: 1,
              borderBottomColor: isDark ? '#333' : '#e0e0e0',
            }}
          >
            <Pressable onPress={onClose} className="p-2">
              <X size={24} color={isDark ? '#fff' : '#333'} />
            </Pressable>
            <Text
              className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
            >
              {step === 'domino'
                ? `Step 1 of ${isMultiIsland ? islandCount + 1 : 2}`
                : step === 'grid'
                  ? 'Step 2 of 2'
                  : step.startsWith('grid-')
                    ? `Step ${currentIslandIndex + 2} of ${islandCount + 1}`
                    : 'Preview'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Content based on step */}
          {step === 'domino' &&
            renderCropView(
              'Crop Domino Tray',
              'Drag to move, drag corner to resize',
              dominoCropRegion,
              setDominoCropRegion,
              handleConfirmDominoCrop,
              <Square size={20} color="#fff" />
            )}

          {step === 'grid' &&
            renderCropView(
              'Crop Puzzle Grid',
              'Drag to move, drag corner to resize',
              gridCropRegion,
              setGridCropRegion,
              handleConfirmGridCrop,
              <Grid3X3 size={20} color="#fff" />
            )}

          {/* Multi-island: render crop for current island */}
          {step.startsWith('grid-') && islandCropRegions[currentIslandIndex] &&
            renderCropView(
              `Crop Island ${currentIslandIndex + 1}${islandConfigs?.[currentIslandIndex] ? ` (${islandConfigs[currentIslandIndex].cols}×${islandConfigs[currentIslandIndex].rows})` : ''}`,
              `Island ${currentIslandIndex + 1} of ${islandCount} - Drag to move, corner to resize`,
              islandCropRegions[currentIslandIndex],
              (region) => handleIslandCropRegionChange(currentIslandIndex, region),
              handleConfirmIslandCrop,
              <Layers size={20} color="#fff" />
            )}

          {step === 'preview' && (isMultiIsland ? renderMultiPreview() : renderPreview())}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
