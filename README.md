# Pips Solver

An iOS app that solves NYT Pips domino puzzles from screenshots using AI vision.

## Features

- **Camera Capture**: Take a photo of any Pips puzzle directly in the app
- **Photo Upload**: Import puzzle screenshots from your photo library
- **AI Extraction**: Uses Gemini 2.5 Pro + GPT-4.1 for accurate puzzle extraction
- **Constraint Solver**: Backtracking algorithm with MRV heuristic to solve puzzles
- **Full Edit Mode**: Manually correct any AI extraction errors before solving
- **Save & Load Puzzles**: Save puzzles for later and edit them after saving
- **Large Grid Support**: Supports grids up to 12x12 (e.g., 7x9 with 33 holes and 30 cells, 15 dominoes)

### Solve Modes

1. **Full Solve** - Shows the complete solution immediately
2. **Hint** - Tap any cell to reveal just that domino
3. **Step Through** - Press "Next" to reveal one domino at a time
4. **Verify** - Check if your current placements are valid

### Saving & Loading Puzzles

- Tap the **folder icon** in the header to view saved puzzles
- Tap the **save icon** (blue) to save a new puzzle, or (green) to update an existing saved puzzle
- From the saved puzzles screen, tap a puzzle to load it
- Rename or delete saved puzzles using the edit/trash buttons

### Edit Mode

If the AI misreads your puzzle, tap the pencil icon to enter Edit Mode:

**Domino Editing:**
- Tap any domino in the tray to edit its pip values
- Tap the + button to add missing dominoes
- Delete incorrect dominoes

**Grid & Region Editing:**
- Select a region from the toolbar (shows color and constraint)
- Tap the pencil icon next to a region to edit its constraint
- Tap cells to reassign them to the selected region
- Tap empty cells (dashed boxes) to add new cells to the selected region
- Tap "Grid Size" to change rows and columns
- Tap "+ Add" to create a new region

**Remove Individual Cells:**
- Tap "Remove Cell" button to enter remove mode
- Tap any cell to remove it from the grid (without deleting the entire region)
- Tap "Remove Cell" again to exit remove mode

Tap "Re-Solve" when done to find the solution.

## How It Works

1. Capture or upload a screenshot of a NYT Pips puzzle
2. **Optional**: Enter grid size hints (columns, rows, domino count) to help AI accuracy
3. **Dual Image Cropping**: Crop two separate regions from your screenshot:
   - **Domino Tray**: Just the dominoes at the bottom
   - **Puzzle Grid**: Just the colored grid with regions
4. The app uses specialized AI models:
   - **GPT-5.2**: Counts domino pip values precisely (halved error rates vs GPT-4.1)
   - **Gemini 3 Pro**: Analyzes grid structure, regions, holes, and constraints (#1 on Vision leaderboard)
5. If extraction is incorrect, use Edit Mode to fix it
6. The solver finds valid domino placements satisfying all constraints
7. View the solution using your preferred solve mode

## Puzzle Constraints (from Real NYT Pips)

The AI recognizes these constraint badge types from real puzzles:

| Badge | Type | Example | Meaning |
|-------|------|---------|---------|
| Number (3, 5, 8, 12) | Sum | "8" | Pips in region must sum to 8 |
| = | Equal | "=" | All pips must be the same value |
| <N | Less | "<2" | Each pip must be less than 2 (i.e., 0 or 1) |
| >N | Greater | ">2" | Each pip must be greater than 2 (i.e., 3-6) |
| No badge | Any | (none) | No constraint on pip values |

Constraint badges appear as small colored diamonds at region edges/corners.

## Tech Stack

- Expo SDK 53 / React Native
- TypeScript
- GPT-5.2 + Gemini 3 Pro Vision APIs (via OpenRouter)
- Qwen3-VL as fallback option
- React Query for async state
- Zustand for local state
- NativeWind/Tailwind for styling
- Reanimated for animations
- Haptics for touch feedback

## Project Structure

```
src/
├── app/
│   ├── _layout.tsx      # Root layout
│   ├── index.tsx        # Main puzzle screen
│   ├── camera.tsx       # Camera capture screen
│   └── saved.tsx        # Saved puzzles screen
├── components/
│   ├── PuzzleGrid.tsx   # Grid display with regions
│   ├── DominoTray.tsx   # Available dominoes display
│   ├── DominoEditor.tsx # Edit domino modal
│   ├── RegionEditor.tsx # Edit region constraints modal
│   ├── GridSizeEditor.tsx # Change grid dimensions modal
│   ├── GridSizeHintModal.tsx # Pre-extraction size hints
│   ├── DualImageCropper.tsx # Crop domino and grid images separately
│   ├── EditToolbar.tsx  # Edit mode toolbar
│   ├── SavePuzzleModal.tsx # Save/update puzzle modal
│   └── SolveModeSelector.tsx
└── lib/
    ├── types/puzzle.ts  # Type definitions
    ├── services/
    │   ├── gemini.ts    # AI extraction (GPT-5.2 + Gemini 3 Pro)
    │   │               # Also contains createRealPuzzle1Unsolved() and createRealPuzzle2()
    │   │               # reference puzzles from real NYT Pips screenshots
    │   └── solver.ts    # Constraint solver
    └── state/
        ├── puzzle-store.ts       # Main puzzle state
        └── saved-puzzles-store.ts # Saved puzzles with AsyncStorage
```
