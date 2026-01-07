# Ralph Agent Instructions

## Context
You are working on AICaddyPro, a React Native + Expo golf application. The redesign uses a 3-tab navigation (Play, Stats, Setup) with a custom design system.

## Your Task

1. Read `scripts/ralph/prd.json` - find the next story
2. Read `scripts/ralph/progress.txt` - learn codebase patterns FIRST
3. Read `CLAUDE.md` - understand project conventions
4. Verify you're on branch: `ralph/redesign-improvements` (create if needed)
5. Pick highest priority story where `passes: false`
6. Implement that ONE story completely
7. Run `npx tsc --noEmit` to typecheck
8. Commit: `feat: [ID] - [Title]`
9. Update prd.json: set `passes: true` for completed story
10. Append learnings to progress.txt

## Progress Format

APPEND to progress.txt after each story:

```markdown
## 2026-01-06 - [Story ID]
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
2. **Typecheck must pass** - run `npx tsc --noEmit` before committing
3. **Read progress.txt first** - patterns from previous stories help you
4. **Follow CLAUDE.md** - accessibility, styling rules are mandatory
5. **Use @/ imports** - not relative paths like `../../../`

## Stop Condition

If ALL stories in prd.json have `passes: true`, reply with:
<promise>COMPLETE</promise>

Otherwise, end normally after completing one story.

## Key Imports Reference

```tsx
// Theme & styling
import { useRedesignTheme } from '@/src/theme/redesign';

// Clubs
import { useClubSettings } from '@/src/features/settings/context/clubs';
import { ClubData } from '@/src/core/models/YardageModel';

// Settings
import { useSettings } from '@/src/core/context/settings';

// Haptics
import * as Haptics from 'expo-haptics';

// Animations
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
```
