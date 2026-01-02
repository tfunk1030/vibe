import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  ChevronLeft,
  Puzzle,
  Trash2,
  Pencil,
  Play,
  Calendar,
} from 'lucide-react-native';

import { useColorScheme } from '@/lib/useColorScheme';
import { useSavedPuzzlesStore, SavedPuzzle } from '@/lib/state/saved-puzzles-store';
import { usePuzzleStore } from '@/lib/state/puzzle-store';
import { solvePuzzle } from '@/lib/services/solver';
import { constraintLabel } from '@/lib/types/puzzle';

function PuzzleCard({
  puzzle,
  onPress,
  onEdit,
  onDelete,
  isDark,
}: {
  puzzle: SavedPuzzle;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDark: boolean;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get a preview summary of the puzzle
  const getPreview = () => {
    const { width, height, regions, availableDominoes } = puzzle.puzzle;
    return `${width}x${height} grid • ${regions.length} regions • ${availableDominoes.length} dominoes`;
  };

  // Get region colors preview
  const regionColors = puzzle.puzzle.regions.slice(0, 5).map((r) => r.color);

  return (
    <Animated.View style={[animatedStyle, { marginBottom: 12 }]}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => {
          scale.value = withSpring(0.98);
        }}
        onPressOut={() => {
          scale.value = withSpring(1);
        }}
        style={{
          backgroundColor: isDark ? '#1a1a2e' : '#fff',
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text
              style={{
                fontSize: 18,
                fontWeight: '700',
                color: isDark ? '#fff' : '#1a1a1a',
                marginBottom: 4,
              }}
              numberOfLines={1}
            >
              {puzzle.name}
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: isDark ? '#888' : '#666',
                marginBottom: 8,
              }}
            >
              {getPreview()}
            </Text>

            {/* Region colors preview */}
            <View className="flex-row gap-1 mb-3">
              {regionColors.map((color, i) => (
                <View
                  key={i}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    backgroundColor: color,
                  }}
                />
              ))}
              {puzzle.puzzle.regions.length > 5 && (
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    backgroundColor: isDark ? '#333' : '#e0e0e0',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '600',
                      color: isDark ? '#888' : '#666',
                    }}
                  >
                    +{puzzle.puzzle.regions.length - 5}
                  </Text>
                </View>
              )}
            </View>

            {/* Date */}
            <View className="flex-row items-center gap-1">
              <Calendar size={12} color={isDark ? '#666' : '#999'} />
              <Text
                style={{
                  fontSize: 11,
                  color: isDark ? '#666' : '#999',
                }}
              >
                {formatDate(puzzle.updatedAt)}
              </Text>
            </View>
          </View>

          {/* Action buttons */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onEdit();
              }}
              style={{
                padding: 10,
                borderRadius: 10,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              }}
            >
              <Pencil size={18} color={isDark ? '#888' : '#666'} />
            </Pressable>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onDelete();
              }}
              style={{
                padding: 10,
                borderRadius: 10,
                backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
              }}
            >
              <Trash2 size={18} color="#EF4444" />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function RenameModal({
  visible,
  currentName,
  onSave,
  onClose,
  isDark,
}: {
  visible: boolean;
  currentName: string;
  onSave: (name: string) => void;
  onClose: () => void;
  isDark: boolean;
}) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    if (visible) {
      setName(currentName);
    }
  }, [visible, currentName]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: '85%',
            maxWidth: 340,
            backgroundColor: isDark ? '#1a1a2e' : '#fff',
            borderRadius: 20,
            padding: 20,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: isDark ? '#fff' : '#1a1a1a',
              marginBottom: 16,
              textAlign: 'center',
            }}
          >
            Rename Puzzle
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Puzzle name"
            placeholderTextColor={isDark ? '#666' : '#999'}
            style={{
              backgroundColor: isDark ? '#2a2a3e' : '#f5f5f5',
              borderRadius: 12,
              padding: 14,
              fontSize: 16,
              color: isDark ? '#fff' : '#1a1a1a',
              marginBottom: 16,
            }}
            autoFocus
          />

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
              onPress={() => {
                if (name.trim()) {
                  onSave(name.trim());
                  onClose();
                }
              }}
              className="flex-1"
              style={{
                padding: 14,
                borderRadius: 12,
                backgroundColor: '#3B82F6',
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: '#fff',
                  textAlign: 'center',
                }}
              >
                Save
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DeleteConfirmModal({
  visible,
  puzzleName,
  onConfirm,
  onClose,
  isDark,
}: {
  visible: boolean;
  puzzleName: string;
  onConfirm: () => void;
  onClose: () => void;
  isDark: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            width: '85%',
            maxWidth: 340,
            backgroundColor: isDark ? '#1a1a2e' : '#fff',
            borderRadius: 20,
            padding: 20,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: isDark ? '#fff' : '#1a1a1a',
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            Delete Puzzle?
          </Text>

          <Text
            style={{
              fontSize: 14,
              color: isDark ? '#888' : '#666',
              marginBottom: 20,
              textAlign: 'center',
            }}
          >
            "{puzzleName}" will be permanently deleted.
          </Text>

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
              onPress={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1"
              style={{
                padding: 14,
                borderRadius: 12,
                backgroundColor: '#EF4444',
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: '#fff',
                  textAlign: 'center',
                }}
              >
                Delete
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function SavedPuzzlesScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const puzzles = useSavedPuzzlesStore((s) => s.puzzles);
  const isLoading = useSavedPuzzlesStore((s) => s.isLoading);
  const hasLoaded = useSavedPuzzlesStore((s) => s.hasLoaded);
  const loadPuzzles = useSavedPuzzlesStore((s) => s.loadPuzzles);
  const deletePuzzle = useSavedPuzzlesStore((s) => s.deletePuzzle);
  const renamePuzzle = useSavedPuzzlesStore((s) => s.renamePuzzle);

  const setPuzzle = usePuzzleStore((s) => s.setPuzzle);
  const setSolution = usePuzzleStore((s) => s.setSolution);
  const setError = usePuzzleStore((s) => s.setError);
  const setCurrentSavedPuzzle = usePuzzleStore((s) => s.setCurrentSavedPuzzle);

  // Modal state
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedPuzzle, setSelectedPuzzle] = useState<SavedPuzzle | null>(null);

  // Load puzzles on mount
  useEffect(() => {
    loadPuzzles();
  }, [loadPuzzles]);

  // Load a puzzle and solve it
  const handleLoadPuzzle = useCallback(
    (saved: SavedPuzzle) => {
      setPuzzle(saved.puzzle);
      setCurrentSavedPuzzle(saved.id, saved.name);
      const sol = solvePuzzle(saved.puzzle);
      setSolution(sol);
      if (!sol.isValid) {
        setError(sol.error || 'Could not solve puzzle - try editing the puzzle data');
      } else {
        setError(null);
      }
      router.back();
    },
    [setPuzzle, setSolution, setError, setCurrentSavedPuzzle, router]
  );

  // Open rename modal
  const handleOpenRename = useCallback((puzzle: SavedPuzzle) => {
    setSelectedPuzzle(puzzle);
    setRenameModalVisible(true);
  }, []);

  // Open delete modal
  const handleOpenDelete = useCallback((puzzle: SavedPuzzle) => {
    setSelectedPuzzle(puzzle);
    setDeleteModalVisible(true);
  }, []);

  // Sorted puzzles (most recent first)
  const sortedPuzzles = [...puzzles].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <View className="flex-1">
      <LinearGradient
        colors={isDark ? ['#0f0f0f', '#1a1a2e', '#0f0f0f'] : ['#f8fafc', '#e2e8f0', '#f8fafc']}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <Animated.View
          entering={FadeInDown.delay(100)}
          className="px-5 pt-4 pb-4 flex-row items-center"
        >
          <Pressable
            onPress={() => router.back()}
            style={{
              padding: 8,
              marginRight: 12,
              borderRadius: 10,
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            }}
          >
            <ChevronLeft size={24} color={isDark ? '#fff' : '#333'} />
          </Pressable>
          <View>
            <Text
              className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
            >
              Saved Puzzles
            </Text>
            <Text
              className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
            >
              {puzzles.length} puzzle{puzzles.length !== 1 ? 's' : ''} saved
            </Text>
          </View>
        </Animated.View>

        {/* Loading */}
        {isLoading && !hasLoaded && (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        )}

        {/* Empty State */}
        {hasLoaded && puzzles.length === 0 && (
          <Animated.View
            entering={FadeIn}
            className="flex-1 items-center justify-center px-8"
          >
            <View
              className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${isDark ? 'bg-white/10' : 'bg-black/10'}`}
            >
              <Puzzle size={36} color={isDark ? '#888' : '#666'} />
            </View>
            <Text
              className={`text-lg font-semibold text-center mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}
            >
              No saved puzzles
            </Text>
            <Text
              className={`text-sm text-center ${isDark ? 'text-gray-500' : 'text-gray-600'}`}
            >
              Load a puzzle and tap "Save" to store it for later
            </Text>
          </Animated.View>
        )}

        {/* Puzzle List */}
        {hasLoaded && puzzles.length > 0 && (
          <ScrollView
            className="flex-1 px-5"
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            {sortedPuzzles.map((puzzle, index) => (
              <Animated.View
                key={puzzle.id}
                entering={FadeInDown.delay(index * 50)}
              >
                <PuzzleCard
                  puzzle={puzzle}
                  onPress={() => handleLoadPuzzle(puzzle)}
                  onEdit={() => handleOpenRename(puzzle)}
                  onDelete={() => handleOpenDelete(puzzle)}
                  isDark={isDark}
                />
              </Animated.View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Rename Modal */}
      <RenameModal
        visible={renameModalVisible}
        currentName={selectedPuzzle?.name ?? ''}
        onSave={(name) => {
          if (selectedPuzzle) {
            renamePuzzle(selectedPuzzle.id, name);
          }
        }}
        onClose={() => setRenameModalVisible(false)}
        isDark={isDark}
      />

      {/* Delete Modal */}
      <DeleteConfirmModal
        visible={deleteModalVisible}
        puzzleName={selectedPuzzle?.name ?? ''}
        onConfirm={() => {
          if (selectedPuzzle) {
            deletePuzzle(selectedPuzzle.id);
          }
        }}
        onClose={() => setDeleteModalVisible(false)}
        isDark={isDark}
      />
    </View>
  );
}
