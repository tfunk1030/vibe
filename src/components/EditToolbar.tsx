import React, { useState } from 'react';
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
  ChevronDown,
  ChevronUp,
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
  disabled = false,
  accessibilityLabel,
}: {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onPress: () => void;
  isDark: boolean;
  small?: boolean;
  activeColor?: string;
  disabled?: boolean;
  accessibilityLabel?: string;
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
          if (!disabled) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
          }
        }}
        onPressIn={() => {
          if (!disabled) scale.value = withSpring(0.95);
        }}
        onPressOut={() => {
          scale.value = withSpring(1);
        }}
        accessibilityLabel={accessibilityLabel || label}
        accessibilityRole="button"
        accessibilityState={{ disabled, selected: isActive }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 44,
          paddingVertical: small ? 10 : 12,
          paddingHorizontal: small ? 12 : 16,
          borderRadius: 12,
          backgroundColor: bgColor,
          gap: 8,
          opacity: disabled ? 0.4 : 1,
        }}
      >
        {icon}
        <Text
          style={{
            fontSize: small ? 13 : 14,
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
    <Animated.View style={[animatedStyle, { marginRight: 10 }]}>
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
          accessibilityLabel={`Select region ${constraintLabel(region.constraint)}`}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 44,
            paddingVertical: 10,
            paddingLeft: 14,
            paddingRight: 10,
            borderTopLeftRadius: 12,
            borderBottomLeftRadius: 12,
            backgroundColor: isSelected
              ? region.color
              : isDark
                ? '#2a2a2a'
                : '#f0f0f0',
            borderWidth: isSelected ? 2 : 1,
            borderRightWidth: 0,
            borderColor: isSelected ? region.color : isDark ? '#444' : '#ddd',
            gap: 8,
          }}
        >
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              backgroundColor: isSelected ? '#fff' : region.color,
            }}
          />
          <Text
            style={{
              fontSize: 14,
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
          accessibilityLabel={`Edit region ${constraintLabel(region.constraint)}`}
          accessibilityRole="button"
          style={{
            minHeight: 44,
            minWidth: 44,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderTopRightRadius: 12,
            borderBottomRightRadius: 12,
            backgroundColor: isSelected
              ? region.color
              : isDark
                ? '#2a2a2a'
                : '#f0f0f0',
            borderWidth: isSelected ? 2 : 1,
            borderLeftWidth: 0,
            borderColor: isSelected ? region.color : isDark ? '#444' : '#ddd',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Pencil size={18} color={isSelected ? '#fff' : isDark ? '#888' : '#666'} />
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
  const [showTools, setShowTools] = useState(true);

  // Get selected region color for paint bucket icon
  const selectedRegion = regions.find(r => r.id === selectedRegionId);
  const paintBucketColor = isPaintBucketMode
    ? '#fff'
    : selectedRegion?.color ?? (isDark ? '#ccc' : '#555');

  return (
    <Animated.View entering={FadeIn} className="mb-4">
      {/* Instructions banner */}
      <View
        className="mx-5 mb-3 px-4 py-3 rounded-xl"
        style={{
          backgroundColor: isRemoveCellMode
            ? '#EF444420'
            : isPaintBucketMode
              ? `${selectedRegion?.color ?? '#3B82F6'}20`
              : isDark ? '#ffffff10' : '#00000008',
          borderWidth: 1,
          borderColor: isRemoveCellMode
            ? '#EF444440'
            : isPaintBucketMode
              ? `${selectedRegion?.color ?? '#3B82F6'}40`
              : isDark ? '#ffffff15' : '#00000010',
        }}
      >
        <Text
          style={{
            fontSize: 14,
            color: isRemoveCellMode
              ? '#EF4444'
              : isPaintBucketMode
                ? selectedRegion?.color ?? '#3B82F6'
                : isDark ? '#aaa' : '#555',
            textAlign: 'center',
            fontWeight: '500',
          }}
        >
          {isRemoveCellMode
            ? 'Tap cells to remove them from the grid'
            : isPaintBucketMode
              ? 'Tap to fill all connected cells with selected region'
              : 'Select a region below, then tap cells to assign'}
        </Text>
      </View>

      {/* Region selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 8,
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

      {/* Collapsible tools header */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowTools(!showTools);
        }}
        accessibilityLabel={showTools ? 'Hide tools' : 'Show tools'}
        accessibilityRole="button"
        className="flex-row items-center justify-center py-2 mx-5"
      >
        <Text style={{ fontSize: 13, color: isDark ? '#666' : '#999', marginRight: 4 }}>
          {showTools ? 'Tools' : 'Show Tools'}
        </Text>
        {showTools ? (
          <ChevronUp size={14} color={isDark ? '#666' : '#999'} />
        ) : (
          <ChevronDown size={14} color={isDark ? '#666' : '#999'} />
        )}
      </Pressable>

      {/* Grid tools - collapsible */}
      {showTools && (
        <Animated.View entering={FadeIn} className="px-5">
          {/* Undo/Redo row */}
          <View className="flex-row justify-center gap-3 mb-2">
            <ToolButton
              icon={<Undo2 size={18} color={canUndo ? (isDark ? '#ccc' : '#555') : (isDark ? '#444' : '#ccc')} />}
              label="Undo"
              onPress={onUndo ?? (() => {})}
              isDark={isDark}
              small
              isActive={false}
              disabled={!canUndo}
              accessibilityLabel={canUndo ? 'Undo last action' : 'Nothing to undo'}
            />
            <ToolButton
              icon={<Redo2 size={18} color={canRedo ? (isDark ? '#ccc' : '#555') : (isDark ? '#444' : '#ccc')} />}
              label="Redo"
              onPress={onRedo ?? (() => {})}
              isDark={isDark}
              small
              isActive={false}
              disabled={!canRedo}
              accessibilityLabel={canRedo ? 'Redo last action' : 'Nothing to redo'}
            />
          </View>

          {/* Grid tools row */}
          <View className="flex-row justify-center gap-3">
            <ToolButton
              icon={<Grid3X3 size={18} color={isDark ? '#ccc' : '#555'} />}
              label="Grid Size"
              onPress={onGridSize}
              isDark={isDark}
              small
              accessibilityLabel="Change grid size"
            />
            <ToolButton
              icon={<PaintBucket size={18} color={paintBucketColor} />}
              label="Fill"
              onPress={onTogglePaintBucketMode ?? (() => {})}
              isDark={isDark}
              small
              isActive={isPaintBucketMode}
              activeColor={selectedRegion?.color ?? '#3B82F6'}
              accessibilityLabel={isPaintBucketMode ? 'Disable paint bucket mode' : 'Enable paint bucket mode'}
            />
            <ToolButton
              icon={<Trash2 size={18} color={isRemoveCellMode ? '#fff' : '#EF4444'} />}
              label="Remove"
              onPress={onToggleRemoveCellMode ?? (() => {})}
              isDark={isDark}
              small
              isActive={isRemoveCellMode}
              activeColor="#EF4444"
              accessibilityLabel={isRemoveCellMode ? 'Disable remove mode' : 'Enable remove mode'}
            />
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}
