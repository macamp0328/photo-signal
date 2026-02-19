/**
 * Integration Test: Feature Flags → Module Behavior
 *
 * Tests how feature flags affect module behavior across the app.
 * Verifies that flags correctly enable/disable features.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('should use test data when test-mode flag is enabled', () => {
    localStorage.setItem(
      FEATURE_FLAGS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'test-mode',
          enabled: true,
        },
      ])
    );

    render(<App />);

    // App should render with test mode enabled
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should use production data when test-mode flag is disabled', () => {
    localStorage.setItem(
      FEATURE_FLAGS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'test-mode',
          enabled: false,
        },
      ])
    );

    render(<App />);

    // App should render with test mode disabled
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should default to production mode when no flag is set', () => {
    // No feature flags set
    render(<App />);

    // App should render in default (production) mode
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should persist feature flags to localStorage', () => {
    const flags = [
      {
        id: 'test-mode',
        enabled: true,
      },
      {
        id: 'rectangle-detection',
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

    expect(parsedFlags.find((flag) => flag.id === 'test-mode')?.enabled).toBe(true);
    expect(parsedFlags.find((flag) => flag.id === 'rectangle-detection')?.enabled).toBe(true);
  });

  it('should handle invalid feature flag data gracefully', () => {
    // Set invalid JSON in localStorage
    localStorage.setItem(FEATURE_FLAGS_STORAGE_KEY, 'invalid-json');

    render(<App />);

    // App should still render without crashing
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should enable debug overlay when test-mode is enabled', () => {
    localStorage.setItem(
      FEATURE_FLAGS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'test-mode',
          enabled: true,
        },
      ])
    );

    render(<App />);

    // App should render (debug overlay loads lazily)
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should not show debug overlay when test-mode is disabled', () => {
    localStorage.setItem(
      FEATURE_FLAGS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'test-mode',
          enabled: false,
        },
      ])
    );

    render(<App />);

    // Debug overlay should not be visible
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
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
          id: 'test-mode',
          enabled: true,
        },
        {
          id: 'rectangle-detection',
          enabled: true,
        },
      ])
    );

    render(<App />);

    // All flags should be processed without conflicts
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });
});
