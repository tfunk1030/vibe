# Accessibility & Visual Design Fixes Implementation Plan

## Overview

Fix 36 accessibility and visual design issues identified in the RAMS design review across 22 component files. The primary issues are missing `accessibilityLabel` on icon-only buttons, missing `accessibilityRole` on interactive elements, and stepper buttons without contextual labels.

## Current State Analysis

The codebase has good visual design with consistent dark/light mode support, but lacks proper accessibility attributes for screen reader users. The `EditToolbar` component demonstrates good accessibility practices that should be used as a template for other components.

### Key Discoveries:
- 6 critical issues: Icon-only close (X) buttons without accessible names
- 18 serious issues: Interactive elements missing labels/roles
- 12 moderate issues: Missing hints, heading roles, and color contrast concerns
- `EditToolbar.tsx` shows correct pattern with `accessibilityLabel`, `accessibilityRole`, `accessibilityState`

## Desired End State

All interactive elements have proper accessibility attributes:
- Every icon-only button has `accessibilityLabel` and `accessibilityRole="button"`
- Radio-style selectors have `accessibilityRole="radio"` and `accessibilityState`
- Stepper buttons include context (e.g., "Decrease columns from 5")
- Screen reader users can navigate and understand all UI elements

### Verification:
- Manual testing with VoiceOver (iOS) or TalkBack (Android)
- All buttons announce their purpose when focused
- Selection state is announced for toggles/radios

## What We're NOT Doing

- Adding automated accessibility testing infrastructure
- Changing visual design or layout
- Refactoring component structure
- Adding ARIA live regions for dynamic content updates
- Full WCAG 2.1 AA compliance audit beyond identified issues

## Implementation Approach

Fix issues in order of severity, grouping by component type:
1. **Phase 1**: Critical icon-only close buttons (6 components)
2. **Phase 2**: Serious interactive element labels (modals, editors)
3. **Phase 3**: Serious tray/selector components
4. **Phase 4**: Moderate improvements (hints, headings, contrast)

---

## Phase 1: Critical - Icon-Only Close Buttons

### Overview
Add `accessibilityLabel` and `accessibilityRole="button"` to all X (close) icon buttons in modal components.

### Changes Required:

#### 1. DominoEditor.tsx
**File**: `src/components/DominoEditor.tsx`
**Line**: ~221

```tsx
// Before:
<Pressable onPress={onClose} className="p-2">
  <X size={24} color={isDark ? '#888' : '#666'} />
</Pressable>

// After:
<Pressable
  onPress={onClose}
  className="p-2"
  accessibilityLabel="Close domino editor"
  accessibilityRole="button"
>
  <X size={24} color={isDark ? '#888' : '#666'} />
</Pressable>
```

#### 2. GridSizeEditor.tsx
**File**: `src/components/GridSizeEditor.tsx`
**Line**: ~194

```tsx
// After:
<Pressable
  onPress={onClose}
  className="p-2"
  accessibilityLabel="Close grid size editor"
  accessibilityRole="button"
>
  <X size={24} color={isDark ? '#888' : '#666'} />
</Pressable>
```

#### 3. RegionEditor.tsx
**File**: `src/components/RegionEditor.tsx`
**Line**: ~209

```tsx
// After:
<Pressable
  onPress={onClose}
  className="p-2"
  accessibilityLabel="Close region editor"
  accessibilityRole="button"
>
  <X size={24} color={isDark ? '#888' : '#666'} />
</Pressable>
```

#### 4. SavePuzzleModal.tsx
**File**: `src/components/SavePuzzleModal.tsx`
**Line**: ~105-114

```tsx
// After:
<Pressable
  onPress={onClose}
  style={{...}}
  accessibilityLabel="Close save dialog"
  accessibilityRole="button"
>
  <X size={20} color={isDark ? '#888' : '#666'} />
</Pressable>
```

#### 5. IslandConfigModal.tsx
**File**: `src/components/IslandConfigModal.tsx`
**Line**: ~284

```tsx
// After:
<Pressable
  onPress={onClose}
  style={{ padding: 8 }}
  accessibilityLabel="Close island configuration"
  accessibilityRole="button"
>
  <X size={24} color={isDark ? '#888' : '#666'} />
</Pressable>
```

#### 6. GridSizeHintModal.tsx
**File**: `src/components/GridSizeHintModal.tsx`
**Line**: ~236

```tsx
// After:
<Pressable
  onPress={onClose}
  className="p-2"
  accessibilityLabel="Close size hints"
  accessibilityRole="button"
>
  <X size={24} color={isDark ? '#888' : '#666'} />
</Pressable>
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npx tsc --noEmit`
- [ ] App builds successfully: `npx expo export --platform ios`

#### Manual Verification:
- [ ] Each close button announces its label when focused with VoiceOver
- [ ] Buttons are identified as "button" role

---

## Phase 2: Serious - Modal/Editor Interactive Elements

### Overview
Add accessibility attributes to stepper buttons, pip selectors, and other interactive elements within editor modals.

### Changes Required:

#### 1. DominoEditor.tsx - Pip Selector Buttons
**File**: `src/components/DominoEditor.tsx`
**Lines**: ~107-133

```tsx
// Before:
<Pressable key={pip} onPress={() => {...}} style={{...}}>
  <PipDots count={pip} size={40} color={...} />
</Pressable>

// After:
<Pressable
  key={pip}
  onPress={() => {...}}
  style={{...}}
  accessibilityLabel={`${pip} pips${pip === currentValue ? ', selected' : ''}`}
  accessibilityRole="radio"
  accessibilityState={{ checked: pip === currentValue }}
>
  <PipDots count={pip} size={40} color={...} />
</Pressable>
```

#### 2. GridSizeEditor.tsx - Stepper Buttons
**File**: `src/components/GridSizeEditor.tsx`
**Lines**: ~63-107 (NumberStepper component)

```tsx
// Minus button - After:
<Pressable
  onPress={() => value > min && onChange(value - 1)}
  disabled={value <= min}
  style={{...}}
  accessibilityLabel={`Decrease ${label} from ${value}`}
  accessibilityRole="button"
  accessibilityState={{ disabled: value <= min }}
>
  <Minus size={20} color={isDark ? '#fff' : '#333'} />
</Pressable>

// Plus button - After:
<Pressable
  onPress={() => value < max && onChange(value + 1)}
  disabled={value >= max}
  style={{...}}
  accessibilityLabel={`Increase ${label} from ${value}`}
  accessibilityRole="button"
  accessibilityState={{ disabled: value >= max }}
>
  <Plus size={20} color={isDark ? '#fff' : '#333'} />
</Pressable>

// Value display:
<Text
  style={{...}}
  accessibilityLabel={`${label}: ${value}`}
  accessibilityRole="text"
>
  {value}
</Text>
```

#### 3. GridSizeHintModal.tsx - Stepper Buttons
**File**: `src/components/GridSizeHintModal.tsx`
**Lines**: ~59-113

Apply same pattern as GridSizeEditor.tsx for NumberStepper component.

#### 4. IslandConfigModal.tsx - Stepper Buttons
**File**: `src/components/IslandConfigModal.tsx`
**Lines**: ~59-104

Apply same pattern as GridSizeEditor.tsx for NumberStepper component.

#### 5. PuzzleSetupWizard.tsx - Stepper Buttons
**File**: `src/components/PuzzleSetupWizard.tsx`
**Lines**: ~140-197 (NumberStepper component)

Apply same pattern as GridSizeEditor.tsx for NumberStepper component.

#### 6. RegionEditor.tsx - Constraint Type Selector
**File**: `src/components/RegionEditor.tsx`
**Lines**: ~240-250

```tsx
// Wrap constraint buttons in a group:
<View accessibilityRole="radiogroup" accessibilityLabel="Constraint type">
  {CONSTRAINT_TYPES.map((type) => (
    <Pressable
      key={type.value}
      onPress={() => setConstraintType(type.value)}
      style={{...}}
      accessibilityLabel={`${type.label}: ${type.description}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: constraintType === type.value }}
    >
      ...
    </Pressable>
  ))}
</View>
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npx tsc --noEmit`
- [ ] App builds successfully

#### Manual Verification:
- [ ] Stepper buttons announce current value and action (e.g., "Decrease columns from 5")
- [ ] Pip selectors announce selection state
- [ ] Radio groups are navigable as expected

---

## Phase 3: Serious - Tray & Selector Components

### Overview
Add accessibility to DominoTray, SolveModeSelector, EmptyPuzzleState, camera controls, and main screen header buttons.

### Changes Required:

#### 1. DominoTray.tsx
**File**: `src/components/DominoTray.tsx`
**Lines**: ~156-163, ~199-223

```tsx
// Domino tile - After:
<Pressable
  onPress={handlePress}
  accessibilityLabel={`Domino ${domino.pips[0]}-${domino.pips[1]}${isUsed ? ', already placed' : ''}`}
  accessibilityRole="button"
  accessibilityState={{ disabled: isUsed }}
>
  {content}
</Pressable>

// Add domino button - After:
<Pressable
  onPress={onAddDomino}
  style={{...}}
  accessibilityLabel="Add new domino"
  accessibilityRole="button"
>
  <Plus size={24} color="#4CAF50" />
</Pressable>
```

#### 2. SolveModeSelector.tsx
**File**: `src/components/SolveModeSelector.tsx`
**Lines**: ~58-82

```tsx
// Mode buttons - After:
<View accessibilityRole="radiogroup" accessibilityLabel="Solve mode">
  {modes.map((mode) => (
    <Pressable
      key={mode.id}
      onPress={() => onModeChange(mode.id)}
      style={{...}}
      accessibilityLabel={`${mode.label}: ${mode.description}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: currentMode === mode.id }}
    >
      ...
    </Pressable>
  ))}
</View>
```

#### 3. EmptyPuzzleState.tsx
**File**: `src/components/EmptyPuzzleState.tsx`
**Lines**: ~67-84

```tsx
// Sample puzzle link - After:
<Pressable
  onPress={onSample}
  accessibilityLabel="Try with sample puzzle"
  accessibilityRole="link"
>
  <Text className="text-blue-500">Try with sample puzzle</Text>
</Pressable>

// L-shaped puzzle link - After:
<Pressable
  onPress={onLShapedPuzzle}
  accessibilityLabel="Try L-shaped puzzle"
  accessibilityRole="link"
>
  <Text className="text-blue-500">Try L-shaped puzzle</Text>
</Pressable>
```

#### 4. camera.tsx - IconButton & Capture
**File**: `src/app/camera.tsx`
**Lines**: ~49-68 (IconButton), ~235-249 (capture button)

```tsx
// IconButton component - add accessibilityLabel prop:
function IconButton({
  icon,
  onPress,
  size = 50,
  disabled,
  accessibilityLabel
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{...}}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      {icon}
    </Pressable>
  );
}

// Capture button - After:
<Pressable
  onPress={handleCapture}
  style={{...}}
  accessibilityLabel="Take photo"
  accessibilityRole="button"
>
  ...
</Pressable>
```

#### 5. index.tsx - Header Buttons
**File**: `src/app/index.tsx`
**Lines**: ~784-857

```tsx
// Home button:
<Pressable
  onPress={() => reset()}
  style={{...}}
  accessibilityLabel="Return to home screen"
  accessibilityRole="button"
>
  <Home size={22} color={isDark ? '#fff' : '#666'} />
</Pressable>

// Saved puzzles button:
<Pressable
  onPress={handleOpenSavedPuzzles}
  style={{...}}
  accessibilityLabel="Open saved puzzles"
  accessibilityRole="button"
>
  <FolderOpen size={24} color={isDark ? '#fff' : '#666'} />
</Pressable>

// Save button:
<Pressable
  onPress={() => setShowSaveModal(true)}
  style={{...}}
  accessibilityLabel={currentSavedPuzzleId ? "Update saved puzzle" : "Save puzzle"}
  accessibilityRole="button"
>
  <Save size={24} color="#fff" />
</Pressable>

// Edit button:
<Pressable
  onPress={handleToggleEditMode}
  style={{...}}
  accessibilityLabel={isEditMode ? "Finish editing" : "Edit puzzle"}
  accessibilityRole="button"
>
  {isEditMode ? <Check size={24} color="#fff" /> : <Pencil size={24} color={...} />}
</Pressable>
```

#### 6. saved.tsx - Back Button
**File**: `src/app/saved.tsx`
**Lines**: ~501-510

```tsx
// Back button - After:
<Pressable
  onPress={() => router.back()}
  style={{...}}
  accessibilityLabel="Go back"
  accessibilityRole="button"
>
  <ChevronLeft size={24} color={isDark ? '#fff' : '#333'} />
</Pressable>
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npx tsc --noEmit`
- [ ] App builds successfully

#### Manual Verification:
- [ ] All header buttons announce their purpose
- [ ] Mode selector announces selection state
- [ ] Domino tiles announce their pip values

---

## Phase 4: Moderate - Hints, Headings & Polish

### Overview
Add accessibility hints for complex gestures, heading roles for titles, and fix minor visual issues.

### Changes Required:

#### 1. DualImageCropper.tsx - Gesture Hints
**File**: `src/components/DualImageCropper.tsx`
**Lines**: ~159-216

```tsx
// Crop box move gesture area:
<GestureDetector gesture={moveGesture}>
  <Animated.View
    style={boxStyle}
    accessibilityLabel="Crop area"
    accessibilityHint="Drag to move the crop area. Drag the corner handle to resize."
  >
    ...
  </Animated.View>
</GestureDetector>
```

#### 2. PuzzleGrid.tsx - Cell Hints
**File**: `src/components/PuzzleGrid.tsx`
**Lines**: ~164-272

```tsx
// GridCell - add hint for edit mode:
<Pressable
  onPress={() => onCellPress?.(cell)}
  onLongPress={() => onRegionPress?.(cell.regionId)}
  style={{...}}
  accessibilityLabel={`Cell at row ${cell.row}, column ${cell.col}${cell.value !== null ? `, value ${cell.value}` : ''}`}
  accessibilityHint={isEditMode ? "Tap to assign to selected region. Long press to edit region." : undefined}
  accessibilityRole="button"
>
  ...
</Pressable>
```

#### 3. ExtractionProgress.tsx - Progress Bar
**File**: `src/components/ExtractionProgress.tsx`

```tsx
// Progress bar view:
<View
  style={{...}}
  accessibilityRole="progressbar"
  accessibilityValue={{ min: 0, max: 100, now: progressPercent }}
  accessibilityLabel={`Extraction progress: ${stageLabel}`}
>
  ...
</View>
```

#### 4. Main Screen Headings
**File**: `src/app/index.tsx`
**Lines**: ~801-814

```tsx
// App title:
<Text
  className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}
  accessibilityRole="header"
>
  Pips Solver
</Text>
```

#### 5. Modal Backdrop Hints
**File**: Multiple modals (DominoEditor, RegionEditor, SavePuzzleModal, etc.)

```tsx
// Modal backdrop Pressable:
<Pressable
  onPress={onClose}
  style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
  accessibilityLabel="Close modal"
  accessibilityHint="Tap anywhere outside the dialog to close"
>
  ...
</Pressable>
```

#### 6. index.tsx - Remove Dead Tap Zone
**File**: `src/app/index.tsx`
**Line**: ~1162

```tsx
// Before:
<Pressable onPress={() => {}}>

// After - prevent event propagation without empty handler:
<View onStartShouldSetResponder={() => true}>
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npx tsc --noEmit`
- [ ] App builds successfully

#### Manual Verification:
- [ ] Crop gestures have helpful hints announced
- [ ] Progress bar announces current progress
- [ ] Headers are recognized as headings by screen readers
- [ ] Modal backdrops announce dismiss behavior

---

## Testing Strategy

### Manual Testing Steps:
1. Enable VoiceOver on iOS device/simulator
2. Navigate through each screen using swipe gestures
3. Verify all interactive elements are announced with:
   - Clear label describing purpose
   - Correct role (button, radio, link, etc.)
   - Current state where applicable (selected, disabled)
4. Test modal dialogs can be closed via backdrop tap
5. Test edit mode with proper announcements

### Key Flows to Test:
1. **Home Screen**: Header buttons, empty state links
2. **Puzzle View**: Grid cells, domino tray, mode selector, action buttons
3. **Edit Mode**: Toolbar, region selection, cell editing
4. **Camera**: All icon buttons, capture button
5. **Modals**: Close buttons, form inputs, steppers
6. **Saved Puzzles**: Back button, puzzle list items

## Implementation Notes

- Use `EditToolbar.tsx` as the gold standard for accessibility patterns
- All Pressable components should have at minimum:
  - `accessibilityLabel` (what it is/does)
  - `accessibilityRole` (button, radio, link, etc.)
- Dynamic content should include state in label or use `accessibilityState`
- Steppers should announce current value and action direction

## References

- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
- React Native Accessibility: https://reactnative.dev/docs/accessibility
- EditToolbar.tsx pattern: `src/components/EditToolbar.tsx:243-279`
