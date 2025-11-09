import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import App from './App';

// Mock browser APIs
beforeEach(() => {
  // Mock MediaDevices API
  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [],
        getVideoTracks: () => [],
      }),
    },
  });
});

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = render(<App />);
    // Basic smoke test - if we get here, the app rendered successfully
    expect(container).toBeDefined();
    expect(container.querySelector('div')).toBeTruthy();
  });

  it('has a root div with proper styling', () => {
    const { container } = render(<App />);
    const rootDiv = container.querySelector('div');
    expect(rootDiv).toHaveClass('w-full', 'h-full');
  });
});
