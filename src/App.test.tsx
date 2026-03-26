import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App, { AppErrorBoundary } from './App';
import { dataService } from './services/data-service';

// Mock browser APIs
beforeEach(() => {
  // Reset DataService cache so each test gets a fresh fetch
  dataService.clearCache();

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

    await user.click(
      screen.getByRole('button', { name: 'Tune in — activate camera and begin experience' })
    );

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
      user.click(
        screen.getByRole('button', { name: 'Tune in — activate camera and begin experience' })
      )
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
      screen.getByRole('button', { name: 'Tune in — activate camera and begin experience' })
    ).toBeTruthy();
  });

  it('shows data error banner when gallery data fails to load', async () => {
    vi.spyOn(dataService, 'getConcerts').mockRejectedValueOnce(new Error('network error'));
    renderApp();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(screen.getByText(/Unable to load gallery data/i)).toBeTruthy();
  });

  it('acquires wake lock when camera is activated', async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValue({ release });

    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request },
    });

    const user = userEvent.setup();
    renderApp();

    await user.click(
      screen.getByRole('button', { name: 'Tune in — activate camera and begin experience' })
    );

    expect(request).toHaveBeenCalledWith('screen');
  });

  it('continues activation when wake lock is unavailable', async () => {
    // Simulate browsers that don't support wake lock
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: undefined,
    });

    const user = userEvent.setup();
    renderApp();

    await expect(
      user.click(
        screen.getByRole('button', { name: 'Tune in — activate camera and begin experience' })
      )
    ).resolves.toBeUndefined();
  });
});

describe('AppErrorBoundary', () => {
  it('renders children normally when there is no error', () => {
    render(
      <AppErrorBoundary>
        <p>All good</p>
      </AppErrorBoundary>
    );
    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('shows fallback UI when a child throws a render error', () => {
    // Suppress React's error boundary console output during this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function Thrower(): never {
      throw new Error('test render error');
    }

    render(
      <AppErrorBoundary>
        <Thrower />
      </AppErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeTruthy();

    consoleSpy.mockRestore();
  });
});
