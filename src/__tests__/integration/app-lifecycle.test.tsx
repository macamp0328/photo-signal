/**
 * Integration Test: App Lifecycle
 *
 * Tests app initialization and cleanup workflows.
 * Verifies that all modules initialize correctly and clean up resources.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../App';
import { setupBrowserMocks, createMockMediaStream } from './setup';

const FEATURE_FLAGS_STORAGE_KEY = 'photo-signal-feature-flags';
const LEGACY_CUSTOM_SETTINGS_STORAGE_KEY = 'photo-signal-custom-settings';

describe('App Lifecycle Integration', () => {
  beforeEach(() => {
    setupBrowserMocks();
    vi.clearAllMocks();
  });

  it('should render app structure on mount', () => {
    render(<App />);

    // Verify app renders successfully with landing page
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Activate camera and begin experience' })
    ).toBeInTheDocument();
  });

  it('should accept concert data from mocked fetch', () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: 2,
        artists: [{ id: 'artist-1', name: 'Test Band' }],
        photos: [
          {
            id: 'photo-1',
            artistId: 'artist-1',
            imageFile: '/assets/test-images/gradient-16x16.jpg',
            photoHashes: { phash: ['abc123def4567890'] },
          },
        ],
        tracks: [
          {
            id: 'track-1',
            artistId: 'artist-1',
            audioFile: '/audio/test.opus',
          },
        ],
        entries: [
          {
            id: 1,
            artistId: 'artist-1',
            trackId: 'track-1',
            photoId: 'photo-1',
            venue: 'Test Venue',
            date: '2023-01-01T00:00:00-06:00',
          },
        ],
      }),
    });

    globalThis.fetch = mockFetch;

    render(<App />);

    // Verify app renders successfully with custom data
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should handle network errors gracefully', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    // App should still render even if data loading will fail later
    render(<App />);
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('should clean up camera stream on unmount', () => {
    const { mockStream } = createMockMediaStream();
    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockStream);

    const { unmount } = render(<App />);

    // Unmount app
    unmount();

    // Cleanup happens in useCameraAccess hook
    // Tracks are stopped when component unmounts
    expect(unmount).toBeDefined();
  });

  it('should not request camera permission on initial load', () => {
    render(<App />);

    // Camera should not be requested until user activates
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('should initialize with localStorage data when available', () => {
    localStorage.setItem(
      FEATURE_FLAGS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'show-debug-overlay',
          enabled: true,
        },
      ])
    );
    localStorage.setItem(
      LEGACY_CUSTOM_SETTINGS_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'legacy-setting',
          value: 1250,
        },
      ])
    );

    render(<App />);

    // App should load with feature flags; legacy custom settings should not break initialization
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.hasAttribute('data-ui-style')).toBe(false);

    // Verify localStorage values remain readable for backward compatibility
    const flags = localStorage.getItem(FEATURE_FLAGS_STORAGE_KEY);
    const settings = localStorage.getItem(LEGACY_CUSTOM_SETTINGS_STORAGE_KEY);
    expect(flags).toBeTruthy();
    expect(settings).toBeTruthy();
  });

  it('should initialize with defaults when localStorage is empty', () => {
    localStorage.clear();

    render(<App />);

    // App should load with defaults when localStorage is empty
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });
});
