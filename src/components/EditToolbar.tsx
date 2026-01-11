import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import {
  Grid3X3,
  Plus,
  Pencil,
  Trash2,
  PaintBucket,
  Undo2,
  Redo2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Region, constraintLabel } from '@/lib/types/puzzle';
import { GridEditMode } from '@/lib/state/puzzle-store';

interface EditToolbarProps {
  regions: Region[];
  selectedRegionId: string | null;
  onSelectRegion: (regionId: string) => void;
  onAddRegion: () => void;
  onEditRegion: (regionId: string) => void;
  onGridSize: () => void;
  gridEditMode: GridEditMode;
  onToggleGridEditMode: () => void;
  isDark: boolean;
  isRemoveCellMode?: boolean;
  onToggleRemoveCellMode?: () => void;
  isPaintBucketMode?: boolean;
  onTogglePaintBucketMode?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

function ToolButton({
  icon,
  label,
  isActive,
  onPress,
  isDark,
  small = false,
  activeColor,
}: {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onPress: () => void;
  isDark: boolean;
  small?: boolean;
  activeColor?: string;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bgColor = isActive
    ? (activeColor ?? '#3B82F6')
    : isDark
      ? '#2a2a2a'
      : '#f0f0f0';

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => {
          scale.value = withSpring(0.95);
        }}
        onPressOut={() => {
          scale.value = withSpring(1);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: small ? 6 : 10,
          paddingHorizontal: small ? 10 : 14,
          borderRadius: 10,
          backgroundColor: bgColor,
          gap: 6,
        }}
      >
        {icon}
        <Text
          style={{
            fontSize: small ? 12 : 13,
            fontWeight: '600',
            color: isActive ? '#fff' : isDark ? '#ccc' : '#555',
          }}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function RegionChip({
  region,
  isSelected,
  onPress,
  onEditPress,
  isDark,
}: {
  region: Region;
  isSelected: boolean;
  onPress: () => void;
  onEditPress: () => void;
  isDark: boolean;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, { marginRight: 8 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
          }}
          onPressIn={() => {
            scale.value = withSpring(0.95);
          }}
          onPressOut={() => {
            scale.value = withSpring(1);
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
            paddingLeft: 10,
            paddingRight: 6,
            borderTopLeftRadius: 10,
            borderBottomLeftRadius: 10,
            backgroundColor: isSelected
              ? region.color
              : isDark
                ? '#2a2a2a'
                : '#f0f0f0',
            borderWidth: isSelected ? 2 : 1,
            borderRightWidth: 0,
            borderColor: isSelected ? region.color : isDark ? '#444' : '#ddd',
            gap: 6,
          }}
        >
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              backgroundColor: isSelected ? '#fff' : region.color,
            }}
          />
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: isSelected ? '#fff' : isDark ? '#fff' : '#333',
            }}
          >
            {constraintLabel(region.constraint)}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onEditPress();
          }}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 8,
            borderTopRightRadius: 10,
            borderBottomRightRadius: 10,
            backgroundColor: isSelected
              ? region.color
              : isDark
                ? '#2a2a2a'
                : '#f0f0f0',
            borderWidth: isSelected ? 2 : 1,
            borderLeftWidth: 0,
            borderColor: isSelected ? region.color : isDark ? '#444' : '#ddd',
          }}
        >
          <Pencil size={14} color={isSelected ? '#fff' : isDark ? '#888' : '#666'} />
        </Pressable>
      </View>
    </Animated.View>
  );
}

function AddRegionButton({
  onPress,
  isDark,
}: {
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
          scale.value = withSpring(0.95);
        }}
        onPressOut={() => {
          scale.value = withSpring(1);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: isDark ? '#1a3a1a' : '#e8f5e9',
          borderWidth: 2,
          borderColor: '#4CAF50',
          borderStyle: 'dashed',
          gap: 6,
        }}
      >
        <Plus size={16} color="#4CAF50" />
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: '#4CAF50',
          }}
        >
          Add
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function EditToolbar({
  regions,
  selectedRegionId,
  onSelectRegion,
  onAddRegion,
  onEditRegion,
  onGridSize,
  isDark,
  isRemoveCellMode = false,
  onToggleRemoveCellMode,
  isPaintBucketMode = false,
  onTogglePaintBucketMode,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: EditToolbarProps) {
  // Get selected region color for paint bucket icon
  const selectedRegion = regions.find(r => r.id === selectedRegionId);
  const paintBucketColor = isPaintBucketMode
    ? '#fff'
    : selectedRegion?.color ?? (isDark ? '#ccc' : '#555');

  return (
    <Animated.View entering={FadeIn} className="mb-4">
      {/* Instructions */}
      <View className="px-5 mb-3">
        <Text
          style={{
            fontSize: 13,
            color: isRemoveCellMode
              ? '#EF4444'
              : isPaintBucketMode
                ? selectedRegion?.color ?? '#3B82F6'
                : isDark ? '#888' : '#666',
            textAlign: 'center',
            fontWeight: isPaintBucketMode ? '600' : '400',
          }}
        >
          {isRemoveCellMode
            ? 'Tap cells to remove them from the grid'
            : isPaintBucketMode
              ? 'Tap to fill all connected cells with selected region'
              : 'Select a region, then tap cells to assign them'}
        </Text>
      </View>

      {/* Region selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 4,
        }}
        style={{ flexGrow: 0 }}
      >
        {regions.map((region) => (
          <RegionChip
            key={region.id}
            region={region}
            isSelected={selectedRegionId === region.id && !isRemoveCellMode}
            onPress={() => onSelectRegion(region.id)}
            onEditPress={() => onEditRegion(region.id)}
            isDark={isDark}
          />
        ))}
        <AddRegionButton onPress={onAddRegion} isDark={isDark} />
      </ScrollView>

      {/* Grid tools */}
      <View className="flex-row justify-center gap-2 px-5 mt-3">
        <ToolButton
          icon={<Undo2 size={16} color={canUndo ? (isDark ? '#ccc' : '#555') : (isDark ? '#555' : '#bbb')} />}
          label="Undo"
          onPress={onUndo ?? (() => {})}
          isDark={isDark}
          small
          isActive={false}
        />
        <ToolButton
          icon={<Redo2 size={16} color={canRedo ? (isDark ? '#ccc' : '#555') : (isDark ? '#555' : '#bbb')} />}
          label="Redo"
          onPress={onRedo ?? (() => {})}
          isDark={isDark}
          small
          isActive={false}
        />
        <ToolButton
          icon={<Grid3X3 size={16} color={isDark ? '#ccc' : '#555'} />}
          label="Grid Size"
          onPress={onGridSize}
          isDark={isDark}
          small
        />
        <ToolButton
          icon={<PaintBucket size={16} color={paintBucketColor} />}
          label="Fill Area"
          onPress={onTogglePaintBucketMode ?? (() => {})}
          isDark={isDark}
          small
          isActive={isPaintBucketMode}
          activeColor={selectedRegion?.color ?? '#3B82F6'}
        />
        <ToolButton
          icon={<Trash2 size={16} color={isRemoveCellMode ? '#fff' : '#EF4444'} />}
          label="Remove"
          onPress={onToggleRemoveCellMode ?? (() => {})}
          isDark={isDark}
          small
          isActive={isRemoveCellMode}
          activeColor="#EF4444"
        />
      </View>
    </Animated.View>
  );
}
