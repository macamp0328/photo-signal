import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App, { AppErrorBoundary } from './App';
import { dataService } from './services/data-service';

const FEATURE_FLAGS_STORAGE_KEY = 'photo-signal-feature-flags';
const env = import.meta.env as Record<string, string | undefined>;
const originalMode = env.MODE;

const disablePowerOnIntro = () => {
  window.localStorage.setItem(
    FEATURE_FLAGS_STORAGE_KEY,
    JSON.stringify([{ id: 'power-on-intro', enabled: false }])
  );
};

// Mock browser APIs
beforeEach(() => {
  // Reset DataService cache so each test gets a fresh fetch
  dataService.clearCache();
  window.localStorage.clear();

  const mockStream = new MediaStream();

  // Mock MediaDevices API
  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue(mockStream),
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  env.MODE = originalMode;
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
    expect(screen.getByText(/Broadcasting/i)).toBeTruthy();
  });

  it('shows the power gate initially in production mode', () => {
    env.MODE = 'production';
    renderApp();

    expect(screen.getByRole('button', { name: 'Turn On' })).toBeTruthy();
    expect(screen.queryByText(/Broadcasting/i)).toBeNull();
  });

  it('skips the intro when the power-on intro flag is disabled', async () => {
    env.MODE = 'production';
    disablePowerOnIntro();
    const user = userEvent.setup();

    renderApp();

    await user.click(screen.getByRole('button', { name: 'Turn On' }));

    expect(screen.getByText(/Broadcasting/i)).toBeTruthy();
    expect(screen.queryByLabelText('Power-on intro')).toBeNull();
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
