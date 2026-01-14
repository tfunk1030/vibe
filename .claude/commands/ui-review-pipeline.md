---
name: ui-review-pipeline
description: Multi-agent UI review pipeline using RAMS, GPT, and frontend-app-design
allowed-tools: ["Read", "Write", "Grep", "Bash", "Glob", "mcp__*"]
---

# UI Multi-Agent Review Pipeline - Vibe

Execute a comprehensive UI review using multiple AI perspectives:
1. **RAMS** - Initial UI/UX review
2. **GPT** (via moderator) - Cross-review and blind spot detection
3. **frontend-app-design** - Design pattern synthesis
4. **RAMS** - Final plan creation
5. **Claude** - Implementation
6. **Both** - Post-implementation verification

## Usage

```
/project:ui-review-pipeline src/app/index.tsx
```

Or for full pipeline:
```
/project:ui-review-pipeline --all
```

## Execution Flow

### Step 1: RAMS Initial Review

```
/rams Review this NativeWind component for:
- Visual hierarchy and spacing
- Touch targets (≥44pt)
- Tailwind class compliance
- Accessibility (contrast, labels)
- Animation patterns (Reanimated)

Be specific with file paths and line numbers.
```

### Step 2: GPT Cross-Review

```
/moderator gpt "Review this UI analysis for a React Native puzzle app.
Identify blind spots, disagree with incorrect assessments, add NativeWind-specific issues.
[PASTE RAMS OUTPUT]"
```

### Step 3: Skills Synthesis

Use frontend-app-design skill to research patterns and create consensus.

### Step 4: Final Plan

```
/rams Create prioritized implementation plan with P0/P1/P2 issues.
Include specific Tailwind class changes.
```

### Step 5-8: Implement, Review, Verify, Commit

## Output Directory

```
scripts/ralph/ui-pipeline/reviews/
```

## Notes

- NativeWind focus: Use `className`, not `style={{}}`
- Animations via Reanimated
- Gestures via react-native-gesture-handler
