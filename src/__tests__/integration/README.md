# Integration Tests

This directory contains integration tests that validate how multiple modules work together in real user workflows.

## Purpose

While unit tests verify that individual modules work correctly in isolation, integration tests ensure that:

1. **Modules communicate correctly** - Events and data flow between modules
2. **State synchronization works** - Multiple modules stay in sync
3. **User workflows function** - Complete user journeys work end-to-end
4. **Timing is correct** - Async operations happen in the right order
5. **Error handling propagates** - Errors in one module are handled by others

## Test Structure

Integration tests follow this pattern:

1. **Import the App component** - Start with the full application, not isolated modules
2. **Setup browser mocks** - Mock external APIs (camera, fetch, Howler.js)
3. **Simulate user actions** - Click buttons, grant permissions, etc.
4. **Wait for effects** - Use `waitFor` for async state changes
5. **Verify cross-module behavior** - Check that Module A affects Module B
6. **Clean up** - Use `afterEach` to reset state

## Test Files

### High Priority Workflows

- **`photo-to-audio.test.tsx`** - Photo recognition triggers audio playback
- **`motion-to-fade.test.tsx`** - Motion detection triggers audio fade
- **`camera-to-recognition.test.tsx`** - Camera stream flows to recognition module

### Medium Priority Workflows

- **`recognition-to-info.test.tsx`** - Recognition updates info display
- **`feature-flags.test.tsx`** - Feature flags change module behavior
- **`app-lifecycle.test.tsx`** - App initialization and cleanup

## Running Integration Tests

```bash
# Run only integration tests
npm run test:run -- src/__tests__/integration

# Run a specific integration test
npm run test:run -- src/__tests__/integration/photo-to-audio.test.tsx

# Run all tests (unit + integration)
npm run test:run

# Run in watch mode
npm test -- src/__tests__/integration
```

## Example Integration Test

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { setupBrowserMocks, mockConcertData } from './setup';
import { Howl } from 'howler';

// Mock Howler.js
vi.mock('howler', () => ({
  Howl: vi.fn(() => ({
    play: vi.fn(),
    stop: vi.fn(),
    fade: vi.fn(),
  })),
}));

describe('Photo Recognition → Audio Playback Integration', () => {
  beforeEach(() => {
    setupBrowserMocks();
  });

  it('should play audio when photo is recognized', async () => {
    render(<App />);

    // Activate camera
    const activateButton = screen.getByRole('button', {
      name: 'Activate camera and begin experience',
    });
    await userEvent.click(activateButton);

    // Simulate photo recognition
    // ... trigger recognition

    // Verify audio plays
    await waitFor(() => {
      expect(Howl).toHaveBeenCalled();
      const howlInstance = (Howl as any).mock.results[0].value;
      expect(howlInstance.play).toHaveBeenCalled();
    });
  });
});
```

## Common Patterns

### Waiting for Async Effects

```typescript
await waitFor(() => {
  expect(screen.getByText('Expected Text')).toBeInTheDocument();
});
```

### Simulating User Interactions

```typescript
import userEvent from '@testing-library/user-event';

const user = userEvent.setup();
await user.click(button);
await user.type(input, 'text');
```

### Verifying Module Interactions

```typescript
// Check that Module A triggered Module B
await waitFor(() => {
  expect(mockModuleBFunction).toHaveBeenCalledWith(expectedData);
});
```

### Testing Error Scenarios

```typescript
// Mock API failure
global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

render(<App />);

// Verify error handling
await waitFor(() => {
  expect(screen.getByText(/error/i)).toBeInTheDocument();
});
```

## Best Practices

### Do

✅ Test complete user workflows  
✅ Mock external APIs (camera, fetch, audio)  
✅ Use `waitFor` for async operations  
✅ Clean up after each test  
✅ Test error scenarios  
✅ Verify cross-module state changes

### Don't

❌ Test implementation details  
❌ Mock internal modules  
❌ Use arbitrary timeouts (`setTimeout`)  
❌ Skip error handling tests  
❌ Leave state between tests  
❌ Test units in integration tests

## Debugging Tips

### Test Failing Intermittently

- Check for race conditions in async operations
- Increase `waitFor` timeout if needed
- Ensure proper cleanup in `afterEach`

### State Leaking Between Tests

- Verify `cleanup()` is called in `afterEach`
- Check localStorage/sessionStorage is cleared
- Reset all mocks with `vi.clearAllMocks()`

### Mock Not Working

- Ensure mocks are set up in `beforeEach`
- Check mock is defined before importing component
- Use `vi.resetAllMocks()` to reset state

## Coverage Goals

Integration tests complement unit tests:

- **Unit Tests**: 70%+ coverage per module
- **Integration Tests**: Critical user workflows covered
- **Combined**: Confidence in both isolation and integration

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Project TESTING.md](../../TESTING.md)

---

**Status**: ✅ Active Development  
**Last Updated**: November 2024  
**Related**: `src/test/setup.ts`, `TESTING.md`, `ARCHITECTURE.md`
