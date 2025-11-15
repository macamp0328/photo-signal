---
name: Fix Triple-Tap Timing to Require Rapid Taps
about: Improve triple-tap detection to require rapid succession instead of accepting slow taps at any interval
title: 'fix(secret-settings): require rapid triple-tap instead of slow sequential taps'
labels: ['bug', 'secret-settings', 'ux', 'ai-agent-ready']
assignees: ''
---

## Problem Statement

Currently, the secret settings menu is activated by triple-tapping/clicking in the center of the screen. However, the implementation has a usability issue: **any three taps count, regardless of timing**.

**Current Behavior (Broken):**

- User taps once → tap count = 1
- User waits 10 seconds → tap count still = 1
- User taps again → tap count = 2
- User waits 30 seconds → tap count still = 2
- User taps again → tap count = 3 → **menu opens** ❌

**Expected Behavior (Should Be):**

- User taps once → tap count = 1
- Timer starts (500ms)
- If no second tap within 500ms → count resets to 0
- User must tap **three times rapidly** (within 500ms between each tap)

**Why This Is a Problem:**

1. ❌ **Accidental activation** - Random single taps can accumulate over time
2. ❌ **Confusing UX** - User thinks "I only tapped once, why did menu open?"
3. ❌ **Not discoverable** - Secret menu should require intentional gesture, not accidental slow taps
4. ❌ **Inconsistent with expectations** - "Triple-tap" implies rapid succession
5. ❌ **Poor user experience** - Menu appears unexpectedly during normal usage

**Real-World Scenario:**

```
User is browsing gallery, tapping around...
- 9:00:00 AM - Taps to focus camera (count = 1)
- 9:00:15 AM - Taps to retry permission (count = 2)
- 9:00:45 AM - Taps to close info overlay (count = 3)
→ Secret menu opens unexpectedly! 😵
```

---

## Root Cause Analysis

The current implementation in `useTripleTap.ts` has a logic error:

**Current Code (Broken):**

```typescript
// Increment tap count
tapCountRef.current += 1;

// Clear previous timeout
if (timeoutRef.current) {
  clearTimeout(timeoutRef.current);
}

// Check if triple tap detected
if (tapCountRef.current >= 3) {
  onTripleTap();
  resetTapCount();
} else {
  // Set timeout to reset count
  timeoutRef.current = setTimeout(() => {
    resetTapCount();
  }, tapTimeout);
}
```

**The Problem:**

- Timeout is **cleared and reset** on every tap
- This means each tap gets a fresh 500ms window
- Taps can be **infinitely far apart** as long as they're within 500ms of the _previous_ tap

**Example Timeline:**

```
Tap 1 (t=0ms)     → count=1, timer starts, resets at t=500ms
Tap 2 (t=10000ms) → count=2, timer RESETS, now resets at t=10500ms
Tap 3 (t=20000ms) → count=3, menu opens ❌
```

**What Should Happen:**

```
Tap 1 (t=0ms)     → count=1, timer starts, resets at t=500ms
Tap 2 (t=10000ms) → MORE THAN 500ms since first tap → count should RESET to 0 ❌
```

---

## Proposed Solution

**Change the timeout behavior**: The timeout should count from the **first tap**, not reset on each subsequent tap.

**New Logic:**

1. First tap → Start timeout (500ms from now)
2. Second tap **within 500ms** → Count continues, timeout **does NOT reset**
3. Third tap **within 500ms** → Trigger action, reset count
4. If timeout expires **at any point** → Reset count to 0

**Corrected Code:**

```typescript
const handleTap = useCallback(
  (event: MouseEvent | TouchEvent) => {
    // ... (position checking code remains the same)

    // Increment tap count
    tapCountRef.current += 1;

    // On FIRST tap, start timeout
    if (tapCountRef.current === 1) {
      timeoutRef.current = setTimeout(() => {
        resetTapCount();
      }, tapTimeout);
    }

    // Check if triple tap detected
    if (tapCountRef.current >= 3) {
      onTripleTap();
      resetTapCount();
    }
  },
  [tapTimeout, onTripleTap, resetTapCount]
);
```

**Key Difference:**

- ❌ Old: Timeout **resets** on every tap
- ✅ New: Timeout **starts once** on first tap, never resets

**New Timeline Example:**

```
Tap 1 (t=0ms)     → count=1, timer starts, will reset at t=500ms
Tap 2 (t=200ms)   → count=2, timer UNCHANGED, still resets at t=500ms
Tap 3 (t=400ms)   → count=3, menu opens ✅
```

**Slow Tap Example (Should Fail):**

```
Tap 1 (t=0ms)     → count=1, timer starts, will reset at t=500ms
Tap 2 (t=600ms)   → TIMEOUT EXPIRED at t=500ms → count was reset to 0
                  → This is now the FIRST tap again → count=1, timer starts
```

---

## Implementation Plan

### Phase 1: Fix the Timeout Logic

**Module**: `src/modules/secret-settings/`

**File**: `useTripleTap.ts`

**Changes Required:**

Replace the `handleTap` function:

```typescript
// Handle tap/click events
const handleTap = useCallback(
  (event: MouseEvent | TouchEvent) => {
    // Get tap/click position
    let x: number, y: number;

    if (event instanceof MouseEvent) {
      x = event.clientX;
      y = event.clientY;
    } else {
      // TouchEvent
      const touch = event.touches[0] || event.changedTouches[0];
      x = touch.clientX;
      y = touch.clientY;
    }

    // Check if tap/click is in the center region (middle third of screen)
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const centerX = viewportWidth / 2;
    const centerY = viewportHeight / 2;

    const centerRegionWidth = viewportWidth / 3;
    const centerRegionHeight = viewportHeight / 3;

    const isInCenterRegion =
      Math.abs(x - centerX) <= centerRegionWidth / 2 &&
      Math.abs(y - centerY) <= centerRegionHeight / 2;

    if (!isInCenterRegion) {
      return;
    }

    // Increment tap count
    tapCountRef.current += 1;

    // On FIRST tap only, start the timeout
    // (Do NOT reset timeout on subsequent taps)
    if (tapCountRef.current === 1) {
      timeoutRef.current = setTimeout(() => {
        resetTapCount();
      }, tapTimeout);
    }

    // Check if triple tap detected
    if (tapCountRef.current >= 3) {
      onTripleTap();
      resetTapCount();
    }
  },
  [tapTimeout, onTripleTap, resetTapCount]
);
```

**Files to Modify:**

- `src/modules/secret-settings/useTripleTap.ts`

---

### Phase 2: Update Tests

**File**: `src/modules/secret-settings/useTripleTap.test.ts`

**Add New Test Cases:**

```typescript
describe('useTripleTap - Timing Requirements', () => {
  it('should NOT trigger if taps are too slow (>500ms apart)', () => {
    const callback = vi.fn();
    render(<TestComponent onTripleTap={callback} tapTimeout={500} />);

    // Tap 1
    fireEvent.click(document, { clientX: 500, clientY: 500 });
    expect(callback).not.toHaveBeenCalled();

    // Wait 600ms (exceeds timeout)
    vi.advanceTimersByTime(600);

    // Tap 2 (should be treated as new first tap)
    fireEvent.click(document, { clientX: 500, clientY: 500 });
    expect(callback).not.toHaveBeenCalled();

    // Tap 3
    fireEvent.click(document, { clientX: 500, clientY: 500 });
    expect(callback).not.toHaveBeenCalled(); // Still only 2 rapid taps
  });

  it('should trigger if all three taps are within timeout window', () => {
    const callback = vi.fn();
    render(<TestComponent onTripleTap={callback} tapTimeout={500} />);

    // Tap 1 (t=0)
    fireEvent.click(document, { clientX: 500, clientY: 500 });

    // Tap 2 (t=200ms)
    vi.advanceTimersByTime(200);
    fireEvent.click(document, { clientX: 500, clientY: 500 });

    // Tap 3 (t=400ms total)
    vi.advanceTimersByTime(200);
    fireEvent.click(document, { clientX: 500, clientY: 500 });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should reset count if timeout expires before third tap', () => {
    const callback = vi.fn();
    render(<TestComponent onTripleTap={callback} tapTimeout={500} />);

    // Tap 1
    fireEvent.click(document, { clientX: 500, clientY: 500 });

    // Tap 2 (within timeout)
    vi.advanceTimersByTime(200);
    fireEvent.click(document, { clientX: 500, clientY: 500 });

    // Wait for timeout to expire
    vi.advanceTimersByTime(400); // Total 600ms from first tap

    // Tap 3 (after timeout expired)
    fireEvent.click(document, { clientX: 500, clientY: 500 });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle rapid taps at edge of timeout window', () => {
    const callback = vi.fn();
    render(<TestComponent onTripleTap={callback} tapTimeout={500} />);

    // Tap 1 (t=0)
    fireEvent.click(document, { clientX: 500, clientY: 500 });

    // Tap 2 (t=250ms)
    vi.advanceTimersByTime(250);
    fireEvent.click(document, { clientX: 500, clientY: 500 });

    // Tap 3 (t=499ms - just before timeout)
    vi.advanceTimersByTime(249);
    fireEvent.click(document, { clientX: 500, clientY: 500 });

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
```

**Files to Modify:**

- `src/modules/secret-settings/useTripleTap.test.ts`

---

### Phase 3: Update Documentation

**Files to Update:**

1. **`src/modules/secret-settings/README.md`**: Clarify "rapid triple-tap" requirement
2. **`src/modules/secret-settings/useTripleTap.ts`**: Update JSDoc comments
3. **`DOCUMENTATION_INDEX.md`**: No changes needed (no new files)

**Example README Update**:

````markdown
### `useTripleTap` Hook

Detects **rapid** triple-tap/click gestures in the center of the screen.

**Timing Requirement:**

All three taps must occur **within 500ms** (configurable) from the first tap.

**Examples:**

✅ **Valid (triggers callback):**

```
Tap 1 (t=0ms)
Tap 2 (t=200ms)
Tap 3 (t=400ms)
→ Total time: 400ms ✅
```

❌ **Invalid (does NOT trigger):**

```
Tap 1 (t=0ms)
Tap 2 (t=300ms)
Tap 3 (t=600ms)
→ Timeout expired at t=500ms ❌
→ Count was reset, tap 3 is now first tap
```

**Parameters:**

- `tapTimeout` (default: 500ms): Maximum time window for all three taps
- `onTripleTap`: Callback triggered when valid triple-tap detected
````

**Update JSDoc in `useTripleTap.ts`:**

````typescript
/**
 * Hook for detecting rapid triple-tap/click gestures
 *
 * Monitors tap/click events and triggers callback when three
 * rapid taps/clicks occur in the center region of the screen.
 *
 * **Timing Requirement**: All three taps must occur within the
 * specified timeout (default 500ms) from the FIRST tap.
 *
 * @param options - Configuration options
 * @param options.tapTimeout - Maximum time window for all three taps (default: 500ms)
 * @param options.onTripleTap - Callback triggered on valid triple-tap
 * @returns void
 *
 * @example
 * ```tsx
 * // Valid sequence (within 500ms):
 * // Tap 1 (t=0), Tap 2 (t=200ms), Tap 3 (t=400ms) ✅
 *
 * // Invalid sequence (exceeds 500ms):
 * // Tap 1 (t=0), Tap 2 (t=300ms), Tap 3 (t=600ms) ❌
 *
 * function MyComponent() {
 *   useTripleTap({
 *     tapTimeout: 500,
 *     onTripleTap: () => console.log('Triple tap detected!')
 *   });
 *   // ...
 * }
 * ```
 */
````

---

## Acceptance Criteria

- [ ] Three rapid taps (within 500ms) trigger the callback ✅
- [ ] Slow taps (>500ms apart) do NOT trigger the callback ❌
- [ ] Timeout starts on FIRST tap, does NOT reset on subsequent taps
- [ ] Tap count resets to 0 when timeout expires
- [ ] All existing tests still pass
- [ ] New timing tests added and passing
- [ ] Documentation updated (README, JSDoc)
- [ ] No console errors or warnings
- [ ] Works on both desktop (mouse) and mobile (touch)
- [ ] No accidental activations during normal usage

---

## Testing Checklist

### Manual Testing

- [ ] **Valid triple-tap (rapid)**:
  - Triple-tap quickly in center of screen (< 500ms)
  - Secret menu should open ✅
- [ ] **Invalid triple-tap (slow)**:
  - Tap once, wait 1 second, tap twice quickly
  - Secret menu should NOT open ❌
- [ ] **Edge case (just under timeout)**:
  - Tap 1 at t=0, Tap 2 at t=250ms, Tap 3 at t=490ms
  - Secret menu should open ✅
- [ ] **Edge case (just over timeout)**:
  - Tap 1 at t=0, Tap 2 at t=250ms, Tap 3 at t=510ms
  - Secret menu should NOT open ❌
- [ ] **Multiple rapid sequences**:
  - Triple-tap quickly to open menu
  - Close menu
  - Triple-tap quickly again to reopen
  - Both should work ✅

### Automated Testing

Run existing and new tests:

```bash
npm run test:run -- useTripleTap.test.ts
```

Expected output:

```
✓ src/modules/secret-settings/useTripleTap.test.ts (12 tests)
  ✓ useTripleTap - Basic Functionality
    ✓ should trigger callback on three rapid taps
    ✓ should not trigger on single tap
    ✓ should not trigger on double tap
  ✓ useTripleTap - Timing Requirements (NEW)
    ✓ should NOT trigger if taps are too slow
    ✓ should trigger if all three taps are within timeout
    ✓ should reset count if timeout expires before third tap
    ✓ should handle rapid taps at edge of timeout window
  ✓ useTripleTap - Center Region Detection
    ✓ should only detect taps in center third of screen
    ✓ should ignore taps outside center region
  ✓ useTripleTap - Cleanup
    ✓ should clean up event listeners on unmount
    ✓ should clean up timeout on unmount
```

### Visual Regression Testing

- [ ] No visual changes (this is a logic fix, not UI change)
- [ ] Menu still appears/disappears smoothly when activated

---

## Design Decisions

1. **Why 500ms default timeout?**
   - Industry standard for "rapid" multi-tap gestures
   - iOS triple-tap accessibility feature uses ~500ms
   - Android tap detection typically uses 300-600ms
   - Balance between "too fast" (hard to perform) and "too slow" (accidental activation)

2. **Why not increase timeout?**
   - Longer timeout = more false positives
   - Current timeout (500ms) is already generous
   - Issue is the **resetting behavior**, not the timeout value

3. **Why start timer on first tap only?**
   - Matches user mental model ("rapid succession" = clock starts ticking)
   - Prevents indefinite accumulation of slow taps
   - Aligns with platform conventions (iOS, Android)

4. **Why clear timeout on reset?**
   - Prevent memory leaks (avoid multiple active timeouts)
   - Clean slate for next detection cycle
   - Good practice for React hooks

---

## Alternative Approaches Considered

### Alternative 1: Track First Tap Timestamp

**Approach**: Instead of timeout, track timestamp of first tap and compare subsequent taps.

```typescript
const firstTapTimeRef = useRef<number | null>(null);

const handleTap = () => {
  const now = Date.now();

  if (firstTapTimeRef.current === null) {
    // First tap
    firstTapTimeRef.current = now;
    tapCountRef.current = 1;
  } else if (now - firstTapTimeRef.current <= tapTimeout) {
    // Subsequent tap within timeout
    tapCountRef.current += 1;
    if (tapCountRef.current >= 3) {
      onTripleTap();
      reset();
    }
  } else {
    // Timeout exceeded, reset
    firstTapTimeRef.current = now;
    tapCountRef.current = 1;
  }
};
```

**Pros**:

- No timeout/cleanup needed
- Simpler logic (direct timestamp comparison)

**Cons**:

- No automatic reset (must check on every tap)
- Count persists indefinitely until next tap
- Less "clean" than timeout-based approach

**Decision**: ❌ Rejected - Timeout-based approach is more idiomatic and auto-resets.

---

### Alternative 2: Debounce/Throttle Approach

**Approach**: Use debounce to detect "burst" of taps.

**Pros**:

- Libraries exist (e.g., Lodash debounce)

**Cons**:

- Adds dependency
- Overcomplicated for simple tap counting
- Harder to reason about timing

**Decision**: ❌ Rejected - Custom implementation is simpler and more maintainable.

---

## Code Quality Requirements

- [ ] **Type Safety**: All functions properly typed (no changes needed)
- [ ] **No `any` Types**: No new `any` types introduced
- [ ] **ESLint Pass**: `npm run lint` passes with zero errors
- [ ] **Prettier Format**: `npm run format` applied
- [ ] **Type Check**: `npm run type-check` passes
- [ ] **Build Success**: `npm run build` completes
- [ ] **Tests Pass**: `npm run test:run` exits with code 0
- [ ] **No Console Errors**: No errors in browser console

---

## Security Considerations

- **No New Attack Surface**: Same gesture detection, just better timing
- **No External Input**: Still only monitors browser events
- **No Data Storage**: No localStorage or state changes
- **Same Privacy Guarantees**: Client-side only, no tracking

---

## Performance Considerations

- **Same Performance**: One timeout instead of multiple (actually slightly better)
- **No Memory Leaks**: Timeout is properly cleared on reset and unmount
- **Minimal CPU**: Timeout-based approach is more efficient than timestamp polling
- **No Event Spam**: Only monitors click/touchend, not mousemove/touchmove

---

## Accessibility

- **No Impact**: Gesture detection is unchanged (still center region)
- **Still Keyboard Accessible**: Secret menu can be opened via other means (if needed)
- **No Visual Change**: Purely timing logic, no UI changes
- **Still Works for Motor Impairments**: 500ms timeout is generous for rapid tapping

---

## User Impact

**Before (Broken):**

- ❌ Menu opens unexpectedly during normal usage
- ❌ Single taps accumulate over time
- ❌ Confusing and frustrating UX

**After (Fixed):**

- ✅ Menu only opens with intentional rapid triple-tap
- ✅ No accidental activations
- ✅ Clear, predictable gesture requirement

---

## References

- **Triple Tap Hook**: `src/modules/secret-settings/useTripleTap.ts`
- **Secret Settings Module**: `src/modules/secret-settings/README.md`
- **iOS Triple-Tap Gesture**: [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/gestures)
- **Android Tap Detection**: [Android Input Events](https://developer.android.com/develop/ui/views/touch-and-input/gestures)

---

## AI Agent Guidelines

This issue is **AI agent-ready** and follows the project's modular architecture principles.

### Module Isolation

- ✅ Changes are isolated to 1 module: `secret-settings`
- ✅ No coupling with other modules
- ✅ Single file change: `useTripleTap.ts`
- ✅ Clear fix with minimal code changes

### Development Workflow

1. **Read module README first** to understand current behavior
2. **Make surgical change** in `useTripleTap.ts` (only timeout logic)
3. **Update tests** to cover new timing requirements
4. **Update documentation** to clarify "rapid" requirement
5. **Run quality checks** before committing:
   ```bash
   npm run lint:fix
   npm run format
   npm run type-check
   npm run test:run
   npm run build
   ```

### Testing Requirements

- Add new test cases for timing requirements
- Test slow taps do NOT trigger callback
- Test rapid taps DO trigger callback
- Test edge cases (just under/over timeout)
- Ensure existing tests still pass

### Commit Messages

Use conventional commits format:

```
fix(secret-settings): require rapid triple-tap instead of slow sequential taps
test(secret-settings): add timing requirement tests for triple-tap
docs(secret-settings): clarify rapid triple-tap requirement in README
```

---

## Questions?

If you have questions about this implementation:

1. Check `src/modules/secret-settings/README.md` for API contract
2. Review existing tests in `useTripleTap.test.ts`
3. See `CONTRIBUTING.md` for code quality standards
4. Check `ARCHITECTURE.md` for module structure

---

**Last Updated**: 2025-11-14
