---
name: Add Integration Tests for User Workflows
about: Add end-to-end integration tests that validate complete user journeys across multiple modules
title: 'test(integration): add integration tests for user workflows'
labels: ['testing', 'integration', 'ai-agent-ready']
assignees: ''
---

## Problem Statement

Currently, the test suite focuses on **unit tests** (testing individual modules in isolation) but lacks **integration tests** that validate how modules work together in real user workflows. While unit tests ensure each module's contract is correct, they don't catch issues that arise from module interactions, state management, or timing problems.

**Current State:**

- ✅ **296 unit tests** - All modules tested in isolation
- ✅ **3 visual regression tests** - UI components tested with Playwright
- ❌ **No integration tests** - No tests for complete user workflows
- ❌ **No cross-module tests** - No tests verifying module interactions

**Risks Without Integration Tests:**

1. **State Synchronization** - Audio playback might not sync with photo recognition
2. **Event Timing** - Motion detection might not trigger audio fade correctly
3. **Data Flow** - Concert data might not propagate correctly to info display
4. **Error Propagation** - Errors in one module might not be handled properly by others
5. **User Experience** - Complete workflows might break even if individual modules work

**Examples of Real-World Integration Issues:**

- Photo recognized, but audio doesn't play (audio-playback not receiving event)
- Motion detected, but audio doesn't fade (event handler not connected)
- Camera permission granted, but video doesn't appear (stream not passed correctly)
- Concert info displayed, but wrong song plays (data mismatch)

---

## Proposed Solution

Add integration tests that exercise complete user workflows, testing multiple modules working together. Focus on the most critical user journeys that span multiple modules.

### Integration Test Scenarios

**High Priority (User-Critical Workflows):**

1. **Photo Recognition → Audio Playback**
   - User points camera at photo
   - Photo is recognized
   - Audio starts playing
   - Verify: Correct song plays for recognized photo

2. **Motion Detection → Audio Fade**
   - Audio is playing
   - User moves camera away
   - Motion detected
   - Audio fades out
   - Verify: Audio volume decreases smoothly

3. **Camera Access → Photo Recognition**
   - User grants camera permission
   - Camera stream starts
   - Photo recognition begins analyzing frames
   - Verify: Recognition module receives video frames

4. **Photo Recognition → Concert Info Display**
   - Photo recognized
   - Concert data loaded
   - Info display shows concert details
   - Verify: Correct concert info displayed

5. **Feature Flags → Module Behavior**
   - User enables Test Mode
   - Photo recognition uses test data
   - Verify: Correct data source selected

**Medium Priority (Secondary Workflows):**

6. **Secret Settings → Feature Activation**
   - User triple-taps to open settings
   - User toggles feature flag
   - Feature activates/deactivates
   - Verify: Flag persists to localStorage

7. **Audio Playback → Crossfade**
   - Song A is playing
   - User points at different photo
   - Song B starts
   - Song A fades out, Song B fades in
   - Verify: Smooth transition

8. **Error Handling → User Feedback**
   - Camera permission denied
   - Error message displayed
   - User can retry
   - Verify: Clear error state and recovery

**Low Priority (Edge Cases):**

9. **Rapid Photo Changes**
   - User quickly points at multiple photos
   - Only latest photo triggers audio
   - Previous recognition requests cancelled
   - Verify: No audio conflicts

10. **App Lifecycle**
    - App loads
    - Camera initializes
    - Photo recognition ready
    - Audio ready
    - Verify: All modules initialized correctly

---

## Implementation Plan

### Phase 1: Create Integration Test Infrastructure

**Directory Structure:**

```
src/__tests__/
├── integration/
│   ├── photo-to-audio.test.tsx
│   ├── motion-to-fade.test.tsx
│   ├── camera-to-recognition.test.tsx
│   ├── recognition-to-info.test.tsx
│   ├── feature-flags.test.tsx
│   └── app-lifecycle.test.tsx
└── README.md (document integration test patterns)
```

**Setup File:**

Create `src/__tests__/integration/setup.ts`:

```typescript
import { beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Auto-cleanup after each test
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

// Mock global APIs
beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks();
});
```

---

### Phase 2: Photo Recognition → Audio Playback Integration

**File**: `src/__tests__/integration/photo-to-audio.test.tsx`

**Test Structure:**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { App } from '../../App';
import { Howl } from 'howler';

// Mock Howler.js
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({
    play: vi.fn(),
    stop: vi.fn(),
    fade: vi.fn(),
    volume: vi.fn(),
  })),
}));

describe('Photo Recognition → Audio Playback Integration', () => {
  beforeEach(() => {
    // Mock camera access
    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(
      new MediaStream()
    );

    // Mock fetch for concert data
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        concerts: [
          {
            id: 1,
            band: 'Test Band',
            venue: 'Test Venue',
            date: '2023-01-01',
            audioFile: '/audio/test.opus',
            photoHashes: {
              dhash: ['abc123def456']
            }
          }
        ]
      })
    });
  });

  it('should play audio when photo is recognized', async () => {
    const { container } = render(<App />);

    // Grant camera permission
    // ... trigger camera start

    // Simulate photo recognition
    // ... mock canvas frame that matches hash 'abc123def456'

    // Wait for audio to play
    await waitFor(() => {
      expect(Howl).toHaveBeenCalled();
      const howlInstance = (Howl as any).mock.results[0].value;
      expect(howlInstance.play).toHaveBeenCalled();
    });
  });

  it('should play correct song for recognized photo', async () => {
    const { container } = render(<App />);

    // Setup: Multiple concerts in data
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        concerts: [
          { id: 1, audioFile: '/audio/song1.opus', photoHashes: { dhash: ['hash1'] } },
          { id: 2, audioFile: '/audio/song2.opus', photoHashes: { dhash: ['hash2'] } },
        ]
      })
    });

    // Recognize photo with 'hash2'
    // ... mock frame

    // Verify correct audio file loaded
    await waitFor(() => {
      expect(Howl).toHaveBeenCalledWith(
        expect.objectContaining({
          src: ['/audio/song2.opus']
        })
      );
    });
  });

  it('should handle unrecognized photo gracefully', async () => {
    const { container } = render(<App />);

    // Simulate frame that doesn't match any hash
    // ... mock frame

    // Verify no audio plays
    await waitFor(() => {
      expect(Howl).not.toHaveBeenCalled();
    });
  });

  it('should switch songs when different photo recognized', async () => {
    const { container } = render(<App />);

    // Recognize first photo
    // ... mock frame for hash1

    await waitFor(() => {
      expect(Howl).toHaveBeenCalledTimes(1);
    });

    // Recognize second photo
    // ... mock frame for hash2

    await waitFor(() => {
      expect(Howl).toHaveBeenCalledTimes(2);
      const firstSong = (Howl as any).mock.results[0].value;
      expect(firstSong.stop).toHaveBeenCalled();
    });
  });
});
```

---

### Phase 3: Motion Detection → Audio Fade Integration

**File**: `src/__tests__/integration/motion-to-fade.test.tsx`

**Test Structure:**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { App } from '../../App';

describe('Motion Detection → Audio Fade Integration', () => {
  it('should fade out audio when motion detected', async () => {
    const { container } = render(<App />);

    // Start audio playing
    // ... trigger recognition and playback

    // Simulate motion (camera movement)
    // ... mock canvas frames with differences

    // Verify audio fades out
    await waitFor(() => {
      const howlInstance = (Howl as any).mock.results[0].value;
      expect(howlInstance.fade).toHaveBeenCalledWith(
        expect.any(Number), // from volume
        0, // to volume (muted)
        expect.any(Number) // fade duration
      );
    });
  });

  it('should fade back in when motion stops', async () => {
    const { container } = render(<App />);

    // Audio is playing
    // ... setup

    // Motion detected → fade out
    // ... mock motion

    await waitFor(() => {
      const howlInstance = (Howl as any).mock.results[0].value;
      expect(howlInstance.fade).toHaveBeenCalledWith(
        expect.any(Number),
        0,
        expect.any(Number)
      );
    });

    // Motion stops → fade back in
    // ... mock stable frames

    await waitFor(() => {
      const howlInstance = (Howl as any).mock.results[0].value;
      expect(howlInstance.fade).toHaveBeenCalledWith(
        0,
        expect.any(Number), // back to original volume
        expect.any(Number)
      );
    });
  });

  it('should not fade if audio is not playing', async () => {
    const { container } = render(<App />);

    // No audio playing

    // Simulate motion
    // ... mock frames

    // Verify no fade called
    await waitFor(() => {
      if ((Howl as any).mock.results.length > 0) {
        const howlInstance = (Howl as any).mock.results[0].value;
        expect(howlInstance.fade).not.toHaveBeenCalled();
      }
    });
  });
});
```

---

### Phase 4: Camera Access → Photo Recognition Integration

**File**: `src/__tests__/integration/camera-to-recognition.test.tsx`

**Test Structure:**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { App } from '../../App';

describe('Camera Access → Photo Recognition Integration', () => {
  it('should pass camera stream to recognition module', async () => {
    const mockStream = new MediaStream();
    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockStream);

    render(<App />);

    // Click "Start Camera" button
    const startButton = screen.getByText(/start camera/i);
    await userEvent.click(startButton);

    // Wait for camera to initialize
    await waitFor(() => {
      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
      expect(video?.srcObject).toBe(mockStream);
    });

    // Verify recognition module is processing frames
    // ... check that canvas.getContext('2d') is called
    await waitFor(() => {
      expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d');
    });
  });

  it('should handle camera permission denied', async () => {
    const permissionError = new Error('Permission denied');
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(permissionError);

    render(<App />);

    const startButton = screen.getByText(/start camera/i);
    await userEvent.click(startButton);

    // Verify error message displayed
    await waitFor(() => {
      expect(screen.getByText(/permission denied/i)).toBeInTheDocument();
    });

    // Verify recognition module not started
    expect(HTMLCanvasElement.prototype.getContext).not.toHaveBeenCalled();
  });

  it('should stop recognition when camera stops', async () => {
    const mockStream = new MediaStream();
    const mockTrack = { stop: vi.fn() };
    mockStream.getTracks = vi.fn(() => [mockTrack] as any);
    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockStream);

    const { unmount } = render(<App />);

    // Start camera
    const startButton = screen.getByText(/start camera/i);
    await userEvent.click(startButton);

    await waitFor(() => {
      expect(document.querySelector('video')).toBeInTheDocument();
    });

    // Stop camera (unmount app)
    unmount();

    // Verify stream stopped
    expect(mockTrack.stop).toHaveBeenCalled();
  });
});
```

---

### Phase 5: Photo Recognition → Concert Info Integration

**File**: `src/__tests__/integration/recognition-to-info.test.tsx`

**Test Structure:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../../App';

describe('Photo Recognition → Concert Info Integration', () => {
  it('should display concert info when photo recognized', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        concerts: [
          {
            id: 1,
            band: 'The Midnight Echoes',
            venue: 'The Fillmore',
            date: '2023-08-15',
            audioFile: '/audio/test.opus',
            photoHashes: { dhash: ['abc123'] }
          }
        ]
      })
    });

    render(<App />);

    // Trigger recognition (mock frame matching hash)
    // ...

    // Verify concert info displayed
    await waitFor(() => {
      expect(screen.getByText('The Midnight Echoes')).toBeInTheDocument();
      expect(screen.getByText('The Fillmore')).toBeInTheDocument();
      expect(screen.getByText(/2023-08-15/)).toBeInTheDocument();
    });
  });

  it('should update info when different photo recognized', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        concerts: [
          {
            id: 1,
            band: 'Band A',
            venue: 'Venue A',
            photoHashes: { dhash: ['hash1'] }
          },
          {
            id: 2,
            band: 'Band B',
            venue: 'Venue B',
            photoHashes: { dhash: ['hash2'] }
          }
        ]
      })
    });

    render(<App />);

    // Recognize first photo
    // ... trigger hash1

    await waitFor(() => {
      expect(screen.getByText('Band A')).toBeInTheDocument();
    });

    // Recognize second photo
    // ... trigger hash2

    await waitFor(() => {
      expect(screen.getByText('Band B')).toBeInTheDocument();
      expect(screen.queryByText('Band A')).not.toBeInTheDocument();
    });
  });

  it('should clear info when no photo recognized', async () => {
    render(<App />);

    // Show info for recognized photo
    // ... trigger recognition

    await waitFor(() => {
      expect(screen.getByText(/concert info/i)).toBeInTheDocument();
    });

    // Point away (no match)
    // ... trigger no match

    await waitFor(() => {
      expect(screen.queryByText(/concert info/i)).not.toBeInTheDocument();
    });
  });
});
```

---

### Phase 6: Feature Flags → Module Behavior Integration

**File**: `src/__tests__/integration/feature-flags.test.tsx`

**Test Structure:**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../../App';

describe('Feature Flags → Module Behavior Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should use test data when Test Mode enabled', async () => {
    localStorage.setItem('feature-flags', JSON.stringify({
      'test-mode': true
    }));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ concerts: [] })
    });

    render(<App />);

    // Verify fetch called with test data path
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('test-data/concerts.json')
      );
    });
  });

  it('should use production data when Test Mode disabled', async () => {
    localStorage.setItem('feature-flags', JSON.stringify({
      'test-mode': false
    }));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ concerts: [] })
    });

    render(<App />);

    // Verify fetch called with production data path
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('data.json')
      );
      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining('test-data')
      );
    });
  });

  it('should enable debug overlay when flag is set', async () => {
    localStorage.setItem('feature-flags', JSON.stringify({
      'debug-overlay': true
    }));

    render(<App />);

    // Verify debug overlay rendered
    await waitFor(() => {
      expect(screen.getByText(/debug/i)).toBeInTheDocument();
    });
  });

  it('should hide debug overlay when flag is not set', async () => {
    localStorage.setItem('feature-flags', JSON.stringify({
      'debug-overlay': false
    }));

    render(<App />);

    // Verify debug overlay not rendered
    expect(screen.queryByText(/debug/i)).not.toBeInTheDocument();
  });
});
```

---

### Phase 7: App Lifecycle Integration

**File**: `src/__tests__/integration/app-lifecycle.test.tsx`

**Test Structure:**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { App } from '../../App';

describe('App Lifecycle Integration', () => {
  it('should initialize all modules on mount', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ concerts: [] })
    } as Response);

    render(<App />);

    // Verify data service loads concert data
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    // Verify camera module initialized (button visible)
    // Verify audio module initialized (Howl available)
    // Verify recognition module initialized (canvas created)
  });

  it('should clean up modules on unmount', async () => {
    const mockStream = new MediaStream();
    const mockTrack = { stop: vi.fn() };
    mockStream.getTracks = vi.fn(() => [mockTrack] as any);
    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockStream);

    const { unmount } = render(<App />);

    // Start camera
    // ... click start button

    await waitFor(() => {
      expect(mockStream.getTracks).toHaveBeenCalled();
    });

    // Unmount app
    unmount();

    // Verify cleanup
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it('should handle errors during initialization', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<App />);

    // Verify error logged
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    // Verify app still renders (graceful degradation)
    // ... check that UI is still visible

    consoleSpy.mockRestore();
  });
});
```

---

## Acceptance Criteria

- [ ] 6+ integration test files created
- [ ] Tests cover critical user workflows (photo→audio, motion→fade, etc.)
- [ ] Tests span multiple modules (not isolated)
- [ ] All tests pass: `npm run test:run` exits with code 0
- [ ] Tests use realistic scenarios (not mocked end-to-end)
- [ ] Tests verify state propagation across modules
- [ ] Tests verify event handling across modules
- [ ] Tests handle timing/async correctly (waitFor, proper timeouts)
- [ ] Tests clean up after themselves (no state leakage)
- [ ] TESTING.md updated with integration test section
- [ ] README.md created in `src/__tests__/integration/` explaining patterns
- [ ] All quality checks pass:
  - `npm run lint:fix`
  - `npm run format`
  - `npm run type-check`
  - `npm run test:run`

---

## Code Quality Requirements

- [ ] **Realistic Scenarios**: Test real user workflows, not artificial cases
- [ ] **Proper Mocking**: Mock external APIs (camera, fetch), not internal modules
- [ ] **Async Handling**: Use `waitFor` for async state changes
- [ ] **Cleanup**: Use `afterEach` to reset state
- [ ] **Descriptive Names**: Test names explain the workflow being tested
- [ ] **No Flakiness**: Tests are deterministic (no random timeouts)
- [ ] **Fast Execution**: Tests complete in <5 seconds total

---

## Testing Checklist

### Manual Verification

- [ ] Run integration tests: `npm run test:run -- src/__tests__/integration`
- [ ] Run all tests together: `npm run test:run`
- [ ] Verify no test interference (run tests multiple times)
- [ ] Verify tests are fast (<5 seconds for all integration tests)

### Workflows Covered

- [ ] Photo recognition triggers audio playback
- [ ] Motion detection triggers audio fade
- [ ] Camera stream flows to recognition module
- [ ] Recognition updates info display
- [ ] Feature flags change module behavior
- [ ] App initializes all modules correctly
- [ ] App cleans up resources on unmount
- [ ] Errors are handled gracefully

---

## Future Enhancements

- [ ] Add visual regression tests for workflows (Playwright)
- [ ] Add performance benchmarks for workflows
- [ ] Add stress tests (rapid photo changes, long sessions)
- [ ] Add accessibility tests for workflows (keyboard navigation)
- [ ] Add mobile-specific workflow tests

---

## References

- **Existing Unit Tests**: `src/modules/*/` (for patterns)
- **App Component**: `src/App.tsx` (integration point)
- **Testing Library**: https://testing-library.com/docs/react-testing-library/intro
- **Vitest**: https://vitest.dev/
- **Testing Guide**: `TESTING.md`

---

## AI Agent Guidelines

This issue is **AI agent-ready** and follows the project's testing standards.

### Integration Test Patterns

1. **Render the App** - Start with the full app, not isolated modules
2. **Simulate User Actions** - Click buttons, grant permissions, etc.
3. **Wait for Effects** - Use `waitFor` for async state changes
4. **Verify Cross-Module Behavior** - Check that Module A affects Module B
5. **Clean Up** - Use `afterEach` to reset state

### Testing Workflow

1. Create `src/__tests__/integration/` directory
2. Create test files for each workflow
3. Import `App` component (not individual modules)
4. Mock external APIs (camera, fetch, Howler)
5. Simulate user interactions
6. Verify state changes across modules
7. Run tests: `npm run test:run`

### Commit Messages

```
test(integration): add photo-to-audio workflow tests
test(integration): add motion-to-fade workflow tests
test(integration): add camera-to-recognition workflow tests
test(integration): add feature-flags integration tests
docs(testing): update TESTING.md with integration tests section
```

---

**Last Updated**: 2025-11-21
