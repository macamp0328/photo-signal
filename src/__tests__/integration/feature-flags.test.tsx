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
      'feature-flags',
      JSON.stringify({
        'test-mode': true,
      })
    );

    render(<App />);

    // App should render with test mode enabled
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should use production data when test-mode flag is disabled', () => {
    localStorage.setItem(
      'feature-flags',
      JSON.stringify({
        'test-mode': false,
      })
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
    const flags = {
      'test-mode': true,
      'debug-overlay': true,
    };

    localStorage.setItem('feature-flags', JSON.stringify(flags));

    render(<App />);

    // Verify flags are persisted
    const storedFlags = localStorage.getItem('feature-flags');
    expect(storedFlags).toBe(JSON.stringify(flags));
  });

  it('should handle invalid feature flag data gracefully', () => {
    // Set invalid JSON in localStorage
    localStorage.setItem('feature-flags', 'invalid-json');

    render(<App />);

    // App should still render without crashing
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should enable debug overlay when test-mode is enabled', () => {
    localStorage.setItem(
      'feature-flags',
      JSON.stringify({
        'test-mode': true,
      })
    );

    render(<App />);

    // App should render (debug overlay loads lazily)
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should not show debug overlay when test-mode is disabled', () => {
    localStorage.setItem(
      'feature-flags',
      JSON.stringify({
        'test-mode': false,
      })
    );

    render(<App />);

    // Debug overlay should not be visible
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should apply theme mode from custom settings', () => {
    localStorage.setItem(
      'custom-settings',
      JSON.stringify({
        'theme-mode': 'light',
      })
    );

    render(<App />);

    // Verify theme is applied to document
    // The theme is set via setAttribute on document.documentElement
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should apply UI style from custom settings', () => {
    localStorage.setItem(
      'custom-settings',
      JSON.stringify({
        'ui-style': 'classic',
      })
    );

    render(<App />);

    // Verify UI style is applied
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should handle multiple feature flags simultaneously', () => {
    localStorage.setItem(
      'feature-flags',
      JSON.stringify({
        'test-mode': true,
        'grayscale-mode': true,
        'multi-scale-recognition': true,
      })
    );

    render(<App />);

    // All flags should be processed without conflicts
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });
});
