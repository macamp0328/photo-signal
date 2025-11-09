# Testing Guide

This document outlines the testing strategy for the Photo Signal modular architecture.

## Current Status

⚠️ **Tests Not Yet Implemented** - See [Issue: Add Module-Level Tests](.github/ISSUE_TEMPLATE/module-level-tests.md)

## Testing Philosophy

Each module should be testable in isolation, validating its documented contract (README.md).

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

## Recommended Test Framework

**Vitest** - Fast, Vite-native, excellent ESM support

### Quick Setup

```bash
# Install dependencies
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# Add to package.json scripts
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage"
}
```

## Test File Convention

```
src/modules/{module-name}/
├── {Component}.tsx
├── {Component}.test.tsx    # Test file (same name with .test.tsx)
├── README.md               # Contract to validate in tests
└── types.ts
```

## Example Test Structure

```typescript
import { renderHook } from '@testing-library/react';
import { useModuleName } from './useModuleName';

describe('useModuleName', () => {
  it('should satisfy contract from README.md', () => {
    // Test that validates the documented API contract
  });
  
  it('should handle edge cases', () => {
    // Test error conditions, null inputs, etc.
  });
});
```

## Mocking Strategy

### Native APIs
```typescript
// Mock MediaDevices
const mockGetUserMedia = vi.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  value: { getUserMedia: mockGetUserMedia },
});
```

### External Libraries
```typescript
// Mock Howler.js
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({
    play: vi.fn(),
    stop: vi.fn(),
    fade: vi.fn(),
  })),
}));
```

## Coverage Goals

- **Target**: >70% per module
- **Priority**: High-value modules first (camera-access, motion-detection, data-service)
- **Focus**: Contract validation over implementation details

## Benefits of Module Testing

✅ **Parallel Development** - Each agent can test their module independently  
✅ **Confident Refactoring** - Change internals without breaking contracts  
✅ **Living Documentation** - Tests show real usage examples  
✅ **Fast Feedback** - Isolated tests run quickly  
✅ **Regression Prevention** - Catch bugs before deployment  

## CI/CD Integration

Add to `.github/workflows/ci.yml`:

```yaml
- name: Run Tests
  run: npm test

- name: Check Coverage
  run: npm run test:coverage
```

## Next Steps

1. See `.github/ISSUE_TEMPLATE/module-level-tests.md` for detailed implementation plan
2. Set up Vitest
3. Create tests for one module (camera-access recommended as starting point)
4. Add CI/CD test step
5. Expand to all modules

---

**Status**: 📋 Planned (not yet implemented)  
**Priority**: Medium  
**Related**: ARCHITECTURE.md, AI_AGENT_GUIDE.md
