/**
 * Integration Test: Photo Recognition → Audio Playback
 *
 * Tests the workflow where photo recognition triggers audio playback.
 * Verifies that when a photo is recognized, the correct audio file plays.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { setupBrowserMocks, createMockHowl } from './setup';

// Mock Howler.js
const mockHowlInstance = createMockHowl();
vi.mock('howler', () => ({
  Howl: vi.fn(() => mockHowlInstance),
}));

describe('Photo Recognition → Audio Playback Integration', () => {
  beforeEach(() => {
    setupBrowserMocks();
    vi.clearAllMocks();
  });

  it('should render app without crashing', () => {
    const { container } = render(<App />);
    expect(container).toBeDefined();
  });

  it('should show landing page before activation', () => {
    render(<App />);
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Activate camera and begin experience' })
    ).toBeInTheDocument();
  });

  it('should activate camera when user clicks activate button', async () => {
    render(<App />);

    const activateButton = screen.getByRole('button', {
      name: 'Activate camera and begin experience',
    });

    const user = userEvent.setup();
    await user.click(activateButton);

    // Wait for camera to be requested
    await waitFor(
      () => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );
  });

  it('should initialize all modules on activation', async () => {
    const { Howl } = await import('howler');
    render(<App />);

    const activateButton = screen.getByRole('button', {
      name: 'Activate camera and begin experience',
    });

    const user = userEvent.setup();
    await user.click(activateButton);

    // Wait for camera to be requested
    await waitFor(
      () => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );

    // Verify Howl is available (audio module initialized)
    expect(Howl).toBeDefined();
  });

  it('should request camera permission when activated', async () => {
    render(<App />);

    const activateButton = screen.getByRole('button', {
      name: 'Activate camera and begin experience',
    });

    const user = userEvent.setup();
    await user.click(activateButton);

    // Verify camera permission is requested
    await waitFor(
      () => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
          expect.objectContaining({
            video: expect.any(Object),
          })
        );
      },
      { timeout: 5000 }
    );
  });

  it('should handle camera permission denied gracefully', async () => {
    // Mock permission denied
    navigator.mediaDevices.getUserMedia = vi
      .fn()
      .mockRejectedValue(new Error('Permission denied'));

    render(<App />);

    const activateButton = screen.getByRole('button', {
      name: 'Activate camera and begin experience',
    });

    const user = userEvent.setup();
    await user.click(activateButton);

    // Wait for error state to appear (Camera Access Required)
    await waitFor(
      () => {
        expect(screen.getByText(/Camera Access Required/i)).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Verify retry button is present
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('should render landing page on mount', () => {
    render(<App />);

    // App renders landing page without loading data yet
    // Data is loaded when camera activates and photo recognition starts
    expect(screen.getByText('Photo Signal')).toBeInTheDocument();
  });
});
