# Ralph Agent Instructions

## Context
You are working on a React Native + Expo application built with Expo SDK 54. The app uses NativeWind (Tailwind) for styling, React Query for state, and react-native-reanimated for animations.

## Your Task

1. Read `scripts/ralph/prd.json` - find the next story
2. Read `scripts/ralph/progress.txt` - learn codebase patterns FIRST
3. Read `CLAUDE.md` - understand project conventions
4. Verify you're on branch: `ralph/improvements` (create if needed)
5. Pick highest priority story where `passes: false`
6. Implement that ONE story completely
7. Run `bunx tsc --noEmit` to typecheck
8. Commit: `feat: [ID] - [Title]`
9. Update prd.json: set `passes: true` for completed story
10. Append learnings to progress.txt

## Progress Format

APPEND to progress.txt after each story:

```markdown
## 2026-01-XX - [Story ID]
- What was implemented
- Files changed: file1.tsx, file2.tsx
- **Learnings:**
  - Any patterns discovered
  - Gotchas encountered
---
```

## Codebase Patterns

If you discover reusable patterns, add them to the TOP of progress.txt under "## Codebase Patterns".

## Critical Rules

1. **ONE story per iteration** - do not combine stories
2. **Typecheck must pass** - run `bunx tsc --noEmit` before committing
3. **Read progress.txt first** - patterns from previous stories help you
4. **Follow CLAUDE.md** - styling, state management rules are mandatory
5. **Use @/ imports** - keep imports clean
6. **NativeWind styling** - use className with Tailwind classes, use cn() for conditional classes
7. **DO NOT install packages** - unless they're @expo-google-fonts or pure JS helpers

## Stop Condition

If ALL stories in prd.json have `passes: true`, reply with:
<promise>COMPLETE</promise>

Otherwise, end normally after completing one story.

## Key Imports Reference

```tsx
// Styling
import { cn } from '@/lib/cn';

// Routing
import { useRouter, useLocalSearchParams } from 'expo-router';

// State
import { useQuery, useMutation } from '@tanstack/react-query';

// Animations
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, withSpring } from 'react-native-reanimated';

// Gestures
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

// Icons (example)
import { Home } from 'lucide-react-native';

// Haptics
import * as Haptics from 'expo-haptics';
```
