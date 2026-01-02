import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PuzzleData } from '../types/puzzle';

export interface SavedPuzzle {
  id: string;
  name: string;
  puzzle: PuzzleData;
  createdAt: number;
  updatedAt: number;
}

interface SavedPuzzlesStore {
  puzzles: SavedPuzzle[];
  isLoading: boolean;
  hasLoaded: boolean;

  // Actions
  loadPuzzles: () => Promise<void>;
  savePuzzle: (name: string, puzzle: PuzzleData) => Promise<SavedPuzzle>;
  updatePuzzle: (id: string, puzzle: PuzzleData, name?: string) => Promise<void>;
  deletePuzzle: (id: string) => Promise<void>;
  renamePuzzle: (id: string, name: string) => Promise<void>;
}

const STORAGE_KEY = '@pips_solver_saved_puzzles';

export const useSavedPuzzlesStore = create<SavedPuzzlesStore>((set, get) => ({
  puzzles: [],
  isLoading: false,
  hasLoaded: false,

  loadPuzzles: async () => {
    if (get().hasLoaded) return;

    set({ isLoading: true });
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const puzzles = JSON.parse(stored) as SavedPuzzle[];
        set({ puzzles, hasLoaded: true });
      } else {
        set({ hasLoaded: true });
      }
    } catch (error) {
      console.error('Failed to load saved puzzles:', error);
      set({ hasLoaded: true });
    }
    set({ isLoading: false });
  },

  savePuzzle: async (name, puzzle) => {
    const now = Date.now();
    const newPuzzle: SavedPuzzle = {
      id: `puzzle-${now}`,
      name,
      puzzle,
      createdAt: now,
      updatedAt: now,
    };

    const updatedPuzzles = [...get().puzzles, newPuzzle];
    set({ puzzles: updatedPuzzles });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPuzzles));
    } catch (error) {
      console.error('Failed to save puzzle:', error);
    }

    return newPuzzle;
  },

  updatePuzzle: async (id, puzzle, name) => {
    const now = Date.now();
    const updatedPuzzles = get().puzzles.map((p) =>
      p.id === id
        ? { ...p, puzzle, updatedAt: now, name: name ?? p.name }
        : p
    );
    set({ puzzles: updatedPuzzles });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPuzzles));
    } catch (error) {
      console.error('Failed to update puzzle:', error);
    }
  },

  deletePuzzle: async (id) => {
    const updatedPuzzles = get().puzzles.filter((p) => p.id !== id);
    set({ puzzles: updatedPuzzles });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPuzzles));
    } catch (error) {
      console.error('Failed to delete puzzle:', error);
    }
  },

  renamePuzzle: async (id, name) => {
    const now = Date.now();
    const updatedPuzzles = get().puzzles.map((p) =>
      p.id === id ? { ...p, name, updatedAt: now } : p
    );
    set({ puzzles: updatedPuzzles });

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPuzzles));
    } catch (error) {
      console.error('Failed to rename puzzle:', error);
    }
  },
}));
