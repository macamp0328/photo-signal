# Testing Guide

📚 **See also**: [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) for a complete list of all project documentation.

This document outlines the testing strategy for the Photo Signal modular architecture.

## Current Status

✅ **Testing Framework Set Up** - Vitest and React Testing Library configured and ready to use

## Testing Philosophy

Each module should be testable in isolation, validating its documented contract (README.md).

## Test Setup

### Framework

**Vitest** - Fast, Vite-native test runner with excellent ESM support

### Dependencies

All testing dependencies are already installed:

```json
{
  "vitest": "^4.0.8",
  "@testing-library/react": "^16.3.0",
  "@testing-library/jest-dom": "^6.9.1",
  "@testing-library/user-event": "^14.6.1",
  "jsdom": "^27.1.0",
  "happy-dom": "^20.0.10",
  "@vitest/ui": "^4.0.8"
}
```

### Running Tests

```bash
# Run tests in watch mode (interactive)
npm test

# Run tests once (CI mode)
npm run test:run

# Open Vitest UI (visual test runner)
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Configuration

Tests are configured via `vitest.config.ts`:

- **Environment**: `happy-dom` (lightweight DOM implementation)
- **Setup File**: `src/test/setup.ts` (loads before all tests)
- **Coverage Provider**: `v8` (fast, accurate coverage)
- **Coverage Threshold**: 70% for lines, functions, branches, and statements

## Global Mocks

Global mocks for native browser APIs are automatically available in all tests via `src/test/mocks.ts`.

### Available Mocks

#### MediaDevices API

Mock for `navigator.mediaDevices.getUserMedia`:

```typescript
import { mockMediaDevices } from '../test/mocks';

// In your test
const mockStream = mockMediaDevices();
// mockStream.getVideoTracks() returns mock video tracks
```

#### HTMLMediaElement (Video/Audio)

Mock for video and audio element playback:

```typescript
// Automatically mocked globally
// HTMLVideoElement.prototype.play() and pause() are mocked
const video = document.createElement('video');
await video.play(); // Won't throw in tests
```

#### Canvas 2D Context

Mock for canvas drawing operations:

```typescript
import { mockCanvasRenderingContext2D } from '../test/mocks';

// In your test
const mockContext = mockCanvasRenderingContext2D();
canvas.getContext('2d'); // Returns mocked context
```

#### Fetch API

Mock for HTTP requests:

```typescript
import { mockFetch } from '../test/mocks';

// In your test
mockFetch();
const response = await fetch('/data.json');
// Returns mock response
```

#### requestAnimationFrame

Mock for animation loops:

```typescript
import { mockRequestAnimationFrame } from '../test/mocks';

// In your test
mockRequestAnimationFrame();
requestAnimationFrame(callback); // Executes immediately in tests
```

### Custom Mocks in Tests

For test-specific mocks, use Vitest's `vi.fn()` and `vi.mock()`:

```typescript
import { vi } from 'vitest';

// Mock a specific module
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({
    play: vi.fn(),
    stop: vi.fn(),
    fade: vi.fn(),
  })),
}));
```

## Modules to Test

### Core Modules

1. **camera-access/** - Camera permission and stream management
2. **camera-view/** - Video display UI component
3. **motion-detection/** - Movement detection algorithm
4. **photo-recognition/** - Photo matching service
5. **audio-playback/** - Audio control and fading
6. **concert-info/** - Info display component

### Services

1. **data-service/** - Concert data management

## Test File Convention

```
src/modules/{module-name}/
├── {Component}.tsx
├── {Component}.test.tsx    # Test file (same name with .test.tsx)
├── README.md               # Contract to validate in tests
└── types.ts
```

## Example Test Structure

### Testing a React Component

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CameraView } from './CameraView';

describe('CameraView', () => {
  it('renders video element', () => {
    const mockStream = new MediaStream();
    render(<CameraView stream={mockStream} />);
    const video = screen.getByRole('video');
    expect(video).toBeInTheDocument();
  });
});
```

### Testing a Hook

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCameraAccess } from './useCameraAccess';

describe('useCameraAccess', () => {
  it('requests camera permission', async () => {
    const { result } = renderHook(() => useCameraAccess());

    result.current.requestCamera();

    await waitFor(() => {
      expect(result.current.stream).toBeDefined();
    });
  });
});
```

### Testing a Service

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { DataService } from './DataService';

describe('DataService', () => {
  let service: DataService;

  beforeEach(() => {
    service = new DataService();
  });

  it('loads concert data', async () => {
    const concerts = await service.getConcerts();
    expect(Array.isArray(concerts)).toBe(true);
  });
});
```

## Coverage Goals

- **Target**: >70% per module
- **Priority**: High-value modules first (camera-access, motion-detection, data-service)
- **Focus**: Contract validation over implementation details

### Viewing Coverage

```bash
npm run test:coverage
```

Coverage reports are generated in:

- **Terminal**: Text summary
- **HTML**: `coverage/index.html` (open in browser)
- **JSON**: `coverage/coverage-final.json`
- **LCOV**: `coverage/lcov.info`

## Benefits of Module Testing

✅ **Parallel Development** - Each agent can test their module independently  
✅ **Confident Refactoring** - Change internals without breaking contracts  
✅ **Living Documentation** - Tests show real usage examples  
✅ **Fast Feedback** - Isolated tests run quickly  
✅ **Regression Prevention** - Catch bugs before deployment

## CI/CD Integration

Tests are automatically run in GitHub Actions CI pipeline (`.github/workflows/ci.yml`):

```yaml
- name: Run tests
  run: npm test -- --run
```

The CI workflow runs on:

- Every push to `main` branch
- Every pull request to `main` branch

## Troubleshooting

### Tests Timing Out

Increase timeout in test file:

```typescript
import { describe, it, expect } from 'vitest';

describe('MyModule', () => {
  it('slow operation', async () => {
    // Test code
  }, 10000); // 10 second timeout
});
```

### Mock Not Working

Ensure mocks are set up before importing the code under test:

```typescript
import { vi } from 'vitest';

// Mock BEFORE importing module
vi.mock('module-name', () => ({
  // mock implementation
}));

// THEN import
import { MyComponent } from './MyComponent';
```

### Act Warnings

Wrap state updates in `act()` or use Testing Library utilities:

```typescript
import { render, screen, waitFor } from '@testing-library/react';

// Use waitFor for async updates
await waitFor(() => {
  expect(screen.getByText('Updated')).toBeInTheDocument();
});
```

## Writing Good Tests

### Do

✅ Test the public API/contract  
✅ Test user-facing behavior  
✅ Use meaningful test descriptions  
✅ Arrange-Act-Assert pattern  
✅ One assertion per test (when possible)  
✅ Mock external dependencies  
✅ Clean up after tests

### Don't

❌ Test implementation details  
❌ Test internal state  
❌ Write brittle tests  
❌ Skip edge cases  
❌ Ignore warnings/errors  
❌ Leave commented-out tests

## Example: Complete Test File

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCameraAccess } from './useCameraAccess';

describe('useCameraAccess', () => {
  beforeEach(() => {
    // Reset mocks between tests
    vi.clearAllMocks();
  });

  it('should initialize with no stream', () => {
    const { result } = renderHook(() => useCameraAccess());

    expect(result.current.stream).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.hasPermission).toBe(false);
  });

  it('should request camera access', async () => {
    const { result } = renderHook(() => useCameraAccess());

    result.current.requestCamera();

    await waitFor(() => {
      expect(result.current.hasPermission).toBe(true);
      expect(result.current.stream).toBeDefined();
    });
  });

  it('should handle permission denied', async () => {
    const mockError = new Error('Permission denied');
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(mockError);

    const { result } = renderHook(() => useCameraAccess());

    result.current.requestCamera();

    await waitFor(() => {
      expect(result.current.error).toBe(mockError);
      expect(result.current.hasPermission).toBe(false);
    });
  });

  it('should stop camera stream', async () => {
    const { result } = renderHook(() => useCameraAccess());

    result.current.requestCamera();

    await waitFor(() => {
      expect(result.current.stream).toBeDefined();
    });

    result.current.stopCamera();

    expect(result.current.stream).toBeNull();
  });
});
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Queries](https://testing-library.com/docs/queries/about/)
- [Vitest API Reference](https://vitest.dev/api/)
- [React Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

---

**Status**: ✅ Set Up and Ready  
**Priority**: High  
**Related**: ARCHITECTURE.md, AI_AGENT_GUIDE.md, .github/workflows/ci.yml
