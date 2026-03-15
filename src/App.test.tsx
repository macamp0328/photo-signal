import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  it('attempts portrait orientation lock on activation when supported', async () => {
    const user = userEvent.setup();
    const lock = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: { lock },
    });

    renderApp();

    await user.click(screen.getByRole('button', { name: 'Activate camera and begin experience' }));

    expect(lock).toHaveBeenCalledWith('portrait-primary');
  });

  it('continues activation when portrait lock rejects', async () => {
    const user = userEvent.setup();
    const lock = vi.fn().mockRejectedValue(new Error('not allowed'));

    Object.defineProperty(window.screen, 'orientation', {
      configurable: true,
      value: { lock },
    });

    renderApp();

    await expect(
      user.click(screen.getByRole('button', { name: 'Activate camera and begin experience' }))
    ).resolves.toBeUndefined();
    expect(lock).toHaveBeenCalledWith('portrait-primary');
  });

  it('renders without crashing', () => {
    const { container } = renderApp();
    // Basic smoke test - if we get here, the app rendered successfully
    expect(container).toBeDefined();
    expect(container.querySelector('div')).toBeTruthy();
  });

  it('shows landing page initially', () => {
    renderApp();
    // Check for landing page elements
    expect(screen.getByText(/Broadcasting/i)).toBeTruthy();
    expect(screen.getByText(/some photographs never stopped/i)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Activate camera and begin experience' })
    ).toBeTruthy();
  });
});
