import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

const env = import.meta.env as Record<string, string | undefined>;
const originalPasscode = env.VITE_ACCESS_PASSCODE;
const originalSessionHours = env.VITE_ACCESS_SESSION_HOURS;
const originalMode = env.MODE;

beforeEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [],
        getVideoTracks: () => [],
      }),
    },
  });

  window.localStorage.clear();
});

afterEach(() => {
  env.VITE_ACCESS_PASSCODE = originalPasscode;
  env.VITE_ACCESS_SESSION_HOURS = originalSessionHours;
  env.MODE = originalMode;
  window.localStorage.clear();
});

describe('App access gate', () => {
  it('is disabled in test mode even when passcode is set', () => {
    env.VITE_ACCESS_PASSCODE = '2468';
    env.MODE = 'test';

    render(<App />);

    // Should skip gate and show the app directly
    expect(screen.getByText('Photo Signal')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Private Gallery' })).toBeNull();
  });

  it('shows passcode screen when gate is enabled', () => {
    env.VITE_ACCESS_PASSCODE = '2468';
    env.MODE = 'production';

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Private Gallery' })).toBeTruthy();
    expect(screen.queryByText('Photo Signal')).toBeNull();
  });

  it('rejects invalid passcode', async () => {
    env.VITE_ACCESS_PASSCODE = '2468';
    env.MODE = 'production';

    render(<App />);

    fireEvent.change(screen.getByLabelText('Access code'), {
      target: { value: '0000' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enter' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Incorrect code. Please try again.');
    });
  });

  it('unlocks app and stores session when passcode is valid', async () => {
    env.VITE_ACCESS_PASSCODE = '2468';
    env.MODE = 'production';

    render(<App />);

    fireEvent.change(screen.getByLabelText('Access code'), {
      target: { value: '2468' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enter' }));

    await waitFor(() => {
      expect(screen.getByText('Photo Signal')).toBeTruthy();
    });

    const accessUntil = Number(window.localStorage.getItem('photo-signal-access-until'));
    expect(Number.isFinite(accessUntil)).toBe(true);
    expect(accessUntil).toBeGreaterThan(Date.now());
  });
});
