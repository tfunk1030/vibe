import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import { Plus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Domino, PlacedDomino, dominoId } from '@/lib/types/puzzle';

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

interface DominoTileProps {
  domino: Domino;
  isUsed: boolean;
  isDark: boolean;
  isEditMode: boolean;
  onPress?: () => void;
  size?: number;
}

function DominoTile({
  domino,
  isUsed,
  isDark,
  isEditMode,
  onPress,
  size = 36,
}: DominoTileProps) {
  const scale = useSharedValue(1);
  const bgColor = isDark ? '#2a2a2a' : '#f5f5f5';
  const borderColor = isDark ? '#444' : '#ddd';
  const pipColor = isDark ? '#fff' : '#1a1a1a';

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (isEditMode) {
      scale.value = withSpring(0.95);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    if (isEditMode && onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const content = (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: isUsed ? (isDark ? '#1a1a1a' : '#e0e0e0') : bgColor,
        borderRadius: 8,
        borderWidth: isEditMode ? 2 : 1,
        borderColor: isEditMode ? '#3B82F6' : isUsed ? 'transparent' : borderColor,
        marginHorizontal: 4,
        opacity: isUsed ? 0.3 : 1,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          padding: 4,
          borderRightWidth: 1,
          borderRightColor: isDark ? '#444' : '#ccc',
        }}
      >
        <PipDots count={domino.pips[0]} size={size} color={isUsed ? '#888' : pipColor} />
      </View>
      <View style={{ padding: 4 }}>
        <PipDots count={domino.pips[1]} size={size} color={isUsed ? '#888' : pipColor} />
      </View>
    </View>
  );

  if (isEditMode) {
    return (
      <Animated.View entering={FadeIn} exiting={FadeOut} style={animatedStyle}>
        <Pressable
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          accessibilityLabel={`Domino ${domino.pips[0]}-${domino.pips[1]}${isUsed ? ', already placed' : ''}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: isUsed }}
        >
          {content}
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      accessible={true}
      accessibilityLabel={`Domino ${domino.pips[0]}-${domino.pips[1]}${isUsed ? ', placed on grid' : ', available'}`}
      accessibilityRole="text"
    >
      {content}
    </Animated.View>
  );
}

function AddDominoButton({
  isDark,
  onPress,
  size = 36,
}: {
  isDark: boolean;
  onPress: () => void;
  size?: number;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          flexDirection: 'row',
          backgroundColor: isDark ? '#1a3a1a' : '#e8f5e9',
          borderRadius: 8,
          borderWidth: 2,
          borderColor: '#4CAF50',
          borderStyle: 'dashed',
          marginHorizontal: 4,
          padding: 4,
          alignItems: 'center',
          justifyContent: 'center',
          width: size * 2 + 18,
          height: size + 8,
        }}
        accessibilityLabel="Add new domino"
        accessibilityRole="button"
      >
        <Plus size={24} color="#4CAF50" />
      </Pressable>
    </Animated.View>
  );
}

interface DominoTrayProps {
  dominoes: Domino[];
  placements: PlacedDomino[];
  isDark: boolean;
  isEditMode?: boolean;
  onDominoPress?: (index: number) => void;
  onAddDomino?: () => void;
}

export function DominoTray({
  dominoes,
  placements,
  isDark,
  isEditMode = false,
  onDominoPress,
  onAddDomino,
}: DominoTrayProps) {
  // Track which dominoes are used by index
  const usedDominoIndices = useMemo(() => {
    const used = new Set<number>();
    for (const placement of placements) {
      // Find the index of this domino in the available list
      for (let i = 0; i < dominoes.length; i++) {
        if (!used.has(i) && dominoId(dominoes[i].pips) === dominoId(placement.domino.pips)) {
          used.add(i);
          break;
        }
      }
    }
    return used;
  }, [dominoes, placements]);

  const usedCount = usedDominoIndices.size;
  const totalCount = dominoes.length;

  return (
    <View className="w-full">
      <View className="flex-row justify-between px-4 mb-2">
        <Text className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {isEditMode ? 'Tap to edit dominoes' : 'Dominoes'}
        </Text>
        <Text className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {usedCount}/{totalCount} placed
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
        style={{
          flexGrow: 0,
        }}
      >
        {dominoes.map((domino, index) => (
          <DominoTile
            key={`${domino.id}-${index}`}
            domino={domino}
            isUsed={usedDominoIndices.has(index)}
            isDark={isDark}
            isEditMode={isEditMode}
            onPress={() => onDominoPress?.(index)}
          />
        ))}
        {isEditMode && onAddDomino && (
          <AddDominoButton isDark={isDark} onPress={onAddDomino} />
        )}
      </ScrollView>
    </View>
  );
}
