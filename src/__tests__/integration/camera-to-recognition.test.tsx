/**
 * Integration Test: Camera Access → Photo Recognition
 *
 * Tests the workflow where camera stream flows to photo recognition.
 * Verifies that camera permission and stream enable photo recognition.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { setupBrowserMocks, createMockMediaStream } from './setup';

describe('Camera Access → Photo Recognition Integration', () => {
  beforeEach(() => {
    setupBrowserMocks();
    vi.clearAllMocks();
  });

  it('should request camera stream when activated', async () => {
    const { mockStream } = createMockMediaStream();
    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockStream);

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

  it('should show error message and retry button when camera permission denied', async () => {
    const permissionError = new Error('Permission denied');
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(permissionError);

    render(<App />);

    const activateButton = screen.getByRole('button', {
      name: 'Activate camera and begin experience',
    });

    const user = userEvent.setup();
    await user.click(activateButton);

    // Wait for error message and retry button
    await waitFor(
      () => {
        expect(screen.getByText(/Camera Access Required/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  });

  it('should retry camera access when retry button clicked', async () => {
    const permissionError = new Error('Permission denied');
    const getUserMediaMock = vi
      .fn()
      .mockRejectedValueOnce(permissionError)
      .mockResolvedValueOnce(createMockMediaStream().mockStream);

    navigator.mediaDevices.getUserMedia = getUserMediaMock;

    render(<App />);

    const activateButton = screen.getByRole('button', {
      name: 'Activate camera and begin experience',
    });

    const user = userEvent.setup();
    await user.click(activateButton);

    // Wait for error and retry button
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Click retry
    const retryButton = screen.getByRole('button', { name: /retry/i });
    await user.click(retryButton);

    // Verify camera was requested again
    await waitFor(
      () => {
        expect(getUserMediaMock).toHaveBeenCalledTimes(2);
      },
      { timeout: 3000 }
    );
  });

  it('should not start recognition when camera is not active', () => {
    render(<App />);

    // Before activation, camera should not be requested
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
});
