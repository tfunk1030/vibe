# UI Multi-Agent Review Pipeline - Vibe (Pips Solver)

Automated UI/UX review system using multiple AI perspectives for professional-grade polish.

## Quick Start

```powershell
# Windows
cd scripts\ralph\ui-pipeline
.\run-ui-pipeline.bat

# Or with options
.\ralph-ui-pipeline.ps1 -MaxIterations 50
```

## Pipeline Flow

```
RAMS Review → GPT Cross-Review → Skills Synthesis → Final Plan
     ↓
Implementation → Post-Review → GPT Verify → Fix & Commit
```

## Components (Processing Order)

| # | Component | Focus |
|---|-----------|-------|
| 1 | Main Puzzle Screen | Grid display, interactions |
| 2 | Camera Screen | Capture UX, framing |
| 3 | Saved Puzzles | List/grid view |
| 4 | Puzzle Grid | Touch precision |
| 5 | Domino Editor | Drag-drop UX |
| 6 | Setup Wizard & Modals | Flow, validation |
| 7 | Core UI Components | Consistency |
| 8 | Navigation | Layout polish |
| 99 | GLOBAL | Cross-component check |

## Files

```
scripts/ralph/ui-pipeline/
├── prd.json               - Pipeline state
├── progress.txt           - Learning log
├── prompt.md              - Ralph instructions
├── ralph-ui-pipeline.ps1  - PowerShell launcher
├── ralph-ui-pipeline.sh   - Bash launcher
├── run-ui-pipeline.bat    - Simple launcher
└── reviews/               - All outputs
```

## NativeWind/Tailwind Focus

This app uses NativeWind (Tailwind for React Native):
- Use `className` prop, not `style={{}}`
- Colors from `src/lib/theme.ts`
- Animations via Reanimated, not CSS
- Gestures via react-native-gesture-handler

## Reviewers

1. **RAMS** - Initial UI/UX analysis
2. **GPT** (via moderator) - Cross-review, blind spots
3. **frontend-app-design** - Pattern synthesis
4. **RAMS** - Final plan creation
