/**
 * Integration Test: Feature Flags → Module Behavior
 *
 * Tests how feature flags affect module behavior across the app.
 * Verifies that flags correctly enable/disable features.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from '../../App';
import { setupBrowserMocks } from './setup';

const FEATURE_FLAGS_STORAGE_KEY = 'photo-signal-feature-flags';

describe('Feature Flags → Module Behavior Integration', () => {
  beforeEach(() => {
    setupBrowserMocks();
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should initialize when rectangle-detection flag is enabled', () => {
    localStorage.setItem(
      FEATURE_FLAGS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'rectangle-detection',
          enabled: true,
        },
      ])
    );

    render(<App />);

    // App should render with supported feature flags enabled
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should initialize when rectangle-detection flag is disabled', () => {
    localStorage.setItem(
      FEATURE_FLAGS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'rectangle-detection',
          enabled: false,
        },
      ])
    );

    render(<App />);

    // App should render with supported feature flags disabled
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should initialize with default feature flags when no flag is set', () => {
    // No feature flags set
    render(<App />);

    // App should render with default feature-flag state
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should persist feature flags to localStorage', () => {
    const flags = [
      {
        id: 'rectangle-detection',
        enabled: true,
      },
      {
        id: 'show-debug-overlay',
        enabled: true,
      },
    ];

    localStorage.setItem(FEATURE_FLAGS_STORAGE_KEY, JSON.stringify(flags));

    render(<App />);

    // Verify flags are persisted
    const storedFlags = localStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);
    const parsedFlags = storedFlags
      ? (JSON.parse(storedFlags) as Array<{ id: string; enabled: boolean }>)
      : [];

    expect(parsedFlags.find((flag) => flag.id === 'rectangle-detection')?.enabled).toBe(true);
    expect(parsedFlags.find((flag) => flag.id === 'show-debug-overlay')?.enabled).toBe(true);
  });

  it('should handle invalid feature flag data gracefully', () => {
    // Set invalid JSON in localStorage
    localStorage.setItem(FEATURE_FLAGS_STORAGE_KEY, 'invalid-json');

    render(<App />);

    // App should still render without crashing
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should render debug overlay when debug overlay flag is enabled', async () => {
    localStorage.setItem(
      FEATURE_FLAGS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'show-debug-overlay',
          enabled: true,
        },
      ])
    );

    render(<App />);

    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
    expect(await screen.findByText(/🐛 Debug Info/i)).toBeInTheDocument();
  });

  it('should not render debug overlay when debug overlay flag is disabled', async () => {
    localStorage.setItem(
      FEATURE_FLAGS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'show-debug-overlay',
          enabled: false,
        },
      ])
    );

    render(<App />);

    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText(/🐛 Debug Info/i)).not.toBeInTheDocument();
    });
  });

  it('should remove legacy unsupported flags from storage during initialization', () => {
    localStorage.setItem(
      FEATURE_FLAGS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'test-mode',
          enabled: true,
        },
        {
          id: 'show-debug-overlay',
          enabled: true,
        },
      ])
    );

    render(<App />);

    const storedFlags = localStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);
    expect(storedFlags).toBeTruthy();
    const parsedFlags = storedFlags
      ? (JSON.parse(storedFlags) as Array<{ id: string; enabled: boolean }>)
      : [];

    expect(parsedFlags.some((flag) => flag.id === 'test-mode')).toBe(false);
    expect(parsedFlags.some((flag) => flag.id === 'show-debug-overlay')).toBe(true);
  });

  it('should enforce curated dark theme mode', () => {
    render(<App />);

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.hasAttribute('data-ui-style')).toBe(false);
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should handle multiple feature flags simultaneously', () => {
    localStorage.setItem(
      FEATURE_FLAGS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'rectangle-detection',
          enabled: true,
        },
        {
          id: 'show-debug-overlay',
          enabled: true,
        },
      ])
    );

    render(<App />);

    // All flags should be processed without conflicts
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });
});
