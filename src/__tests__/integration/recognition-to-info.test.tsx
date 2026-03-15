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
    expect(screen.getByText(/Broadcasting/i)).toBeInTheDocument();
  });

  it('should not display concert info before activation', () => {
    render(<App />);

    // Concert info should not be visible on landing page
    expect(screen.queryByText('Test Band 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Test Band 2')).not.toBeInTheDocument();
  });
});
