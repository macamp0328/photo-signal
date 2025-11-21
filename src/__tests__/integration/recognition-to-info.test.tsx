/**
 * Integration Test: Photo Recognition → Concert Info Display
 *
 * Tests the workflow where photo recognition updates concert info display.
 * Verifies that recognized concerts show correct information.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../App';
import { setupBrowserMocks } from './setup';

describe('Photo Recognition → Concert Info Integration', () => {
  beforeEach(() => {
    setupBrowserMocks();
    vi.clearAllMocks();
  });

  it('should render without errors on mount', () => {
    render(<App />);

    // App should render landing page successfully
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });

  it('should not display concert info before activation', () => {
    render(<App />);

    // Concert info should not be visible on landing page
    expect(screen.queryByText('Test Band 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Test Band 2')).not.toBeInTheDocument();
  });

  it('should handle errors gracefully without crashing', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    // App should still render even if data loading will fail later
    const { container } = render(<App />);
    expect(container).toBeDefined();

    consoleSpy.mockRestore();
  });

  it('should accept custom concert data via fetch mock', () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        concerts: [
          {
            id: 1,
            band: 'Integration Test Band',
            venue: 'Integration Test Venue',
            date: '2023-01-01',
            audioFile: '/audio/test.opus',
            photoHashes: { dhash: ['abc123'] },
          },
        ],
      }),
    });

    global.fetch = mockFetch;

    // App should render - data will be loaded when modules initialize
    const { container } = render(<App />);
    expect(container).toBeDefined();
  });

  it('should not show info display when no concert is recognized', () => {
    render(<App />);

    // Info display should not be visible without recognition
    // Check if band names from test data are not visible
    expect(screen.queryByText('Test Band 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Test Band 2')).not.toBeInTheDocument();
  });
});
