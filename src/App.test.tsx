import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

// Helper to render app
const renderApp = () => {
  return render(<App />);
};

describe('App', () => {
  it('renders without crashing', () => {
    const { container } = renderApp();
    // Basic smoke test - if we get here, the app rendered successfully
    expect(container).toBeDefined();
    expect(container.querySelector('div')).toBeTruthy();
  });

  it('shows landing page initially', () => {
    renderApp();
    // Check for landing page elements
    expect(screen.getByText('Photo Signal')).toBeTruthy();
    expect(screen.getByText(/Point your camera at a photograph/i)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Activate camera and begin experience' })
    ).toBeTruthy();
  });
});
