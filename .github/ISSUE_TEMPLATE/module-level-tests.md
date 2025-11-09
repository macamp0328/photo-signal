---
name: Add Module-Level Tests
about: Add unit tests for each module to enable independent testing and validation
title: 'Add module-level tests'
labels: testing, enhancement
assignees: ''

---

## Objective

Add unit tests for each module to enable independent testing and validation.

## Scope

Each module should have its own test file that validates its contract and functionality:

### Modules to Test

1. **camera-access/** - Test camera permission handling and stream lifecycle
   - Mock `navigator.mediaDevices.getUserMedia()`
   - Test permission states (granted, denied, loading)
   - Test stream cleanup on unmount
   - Test retry functionality

2. **camera-view/** - Test UI rendering for different permission states
   - Test error state display
   - Test loading state display
   - Test active camera state with overlay
   - Test video element srcObject assignment

3. **motion-detection/** - Test motion detection algorithm with mock video frames
   - Mock video element and canvas context
   - Test pixel difference calculation
   - Test sensitivity adjustments
   - Test motion state changes

4. **photo-recognition/** - Test recognition logic with mock data
   - Mock data service
   - Test recognition delay timing
   - Test reset functionality
   - Test enabled/disabled state

5. **audio-playback/** - Test audio controls and fade effects
   - Mock Howler.js
   - Test play/pause/stop controls
   - Test fade out functionality
   - Test volume controls

6. **concert-info/** - Test info display component rendering
   - Test conditional rendering (visible/hidden)
   - Test concert data display
   - Test date formatting
   - Test position prop (top/bottom)

### Services to Test

1. **data-service/** - Test concert data loading and caching
   - Mock fetch API
   - Test cache behavior
   - Test error handling
   - Test search functionality
   - Test random concert selection

## Test Framework

- **Recommended**: Vitest (fast, Vite-native, ESM support)
- **Alternative**: Jest with React Testing Library
- Use React Testing Library patterns for component tests
- Mock external dependencies (MediaDevices API, Howler.js, fetch)

## Setup Steps

1. Install test dependencies:
   ```bash
   npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
   ```

2. Add test script to `package.json`:
   ```json
   "scripts": {
     "test": "vitest",
     "test:ui": "vitest --ui",
     "test:coverage": "vitest --coverage"
   }
   ```

3. Create `vitest.config.ts`:
   ```typescript
   import { defineConfig } from 'vitest/config';
   import react from '@vitejs/plugin-react';
   
   export default defineConfig({
     plugins: [react()],
     test: {
       environment: 'jsdom',
       setupFiles: './src/test/setup.ts',
     },
   });
   ```

## Test File Structure

```
src/
├── modules/
│   ├── camera-access/
│   │   ├── useCameraAccess.ts
│   │   └── useCameraAccess.test.ts      # NEW
│   ├── motion-detection/
│   │   ├── useMotionDetection.ts
│   │   └── useMotionDetection.test.ts   # NEW
│   └── ... (similar for other modules)
│
└── services/
    └── data-service/
        ├── DataService.ts
        └── DataService.test.ts           # NEW
```

## Example Test

```typescript
// src/modules/camera-access/useCameraAccess.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useCameraAccess } from './useCameraAccess';

// Mock MediaDevices API
const mockGetUserMedia = vi.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  value: { getUserMedia: mockGetUserMedia },
});

describe('useCameraAccess', () => {
  it('should request camera permissions on mount', async () => {
    const mockStream = {} as MediaStream;
    mockGetUserMedia.mockResolvedValue(mockStream);
    
    const { result } = renderHook(() => useCameraAccess());
    
    await waitFor(() => {
      expect(result.current.stream).toBe(mockStream);
      expect(result.current.hasPermission).toBe(true);
    });
  });
  
  it('should handle permission denied', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
    
    const { result } = renderHook(() => useCameraAccess());
    
    await waitFor(() => {
      expect(result.current.hasPermission).toBe(false);
      expect(result.current.error).toBeTruthy();
    });
  });
});
```

## Acceptance Criteria

- [ ] Each module has a corresponding `.test.ts` or `.test.tsx` file
- [ ] Tests validate the module's documented contract (README.md)
- [ ] All tests pass locally and in CI/CD pipeline
- [ ] Test coverage is reasonable (aim for >70% per module)
- [ ] CI/CD pipeline includes test step
- [ ] README.md updated with testing instructions

## Benefits

- ✅ Enables confident refactoring
- ✅ Validates module isolation
- ✅ Provides examples of module usage
- ✅ Supports parallel AI agent development (agents can run tests independently)
- ✅ Catches regressions early
- ✅ Documents expected behavior

## Related Documentation

- See module READMEs for API contracts to test
- See ARCHITECTURE.md for system design context
- See AI_AGENT_GUIDE.md for parallel development patterns

## Priority

**Medium** - While not blocking current functionality, tests will enable safer future development and AI agent collaboration.
