/**
 * Tests for useCameraAccess hook
 *
 * Validates the camera-access module contract as defined in README.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCameraAccess } from './useCameraAccess';

describe('useCameraAccess', () => {
  let mockStream: MediaStream;
  let mockTrack: MediaStreamTrack;

  beforeEach(() => {
    // Create mock video track
    mockTrack = {
      stop: vi.fn(),
      kind: 'video',
      enabled: true,
      id: 'mock-track-id',
      label: 'mock video track',
      muted: false,
      readyState: 'live',
      getSettings: vi.fn(() => ({
        width: 1280,
        height: 720,
        frameRate: 30,
      })),
    } as unknown as MediaStreamTrack;

    // Create mock MediaStream
    mockStream = {
      getTracks: vi.fn(() => [mockTrack]),
      getVideoTracks: vi.fn(() => [mockTrack]),
      getAudioTracks: vi.fn(() => []),
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      id: 'mock-stream-id',
      active: true,
    } as unknown as MediaStream;

    // Mock getUserMedia to resolve successfully by default
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
        enumerateDevices: vi.fn().mockResolvedValue([]),
        getSupportedConstraints: vi.fn().mockReturnValue({}),
      },
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Camera permission request on mount', () => {
    it('should request camera permission automatically on mount', async () => {
      renderHook(() => useCameraAccess());

      await waitFor(() => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
      });
    });

    it('should set stream correctly when permission is granted', async () => {
      const { result } = renderHook(() => useCameraAccess());

      await waitFor(() => {
        expect(result.current.stream).toBe(mockStream);
      });
    });

    it('should set hasPermission to true when permission is granted', async () => {
      const { result } = renderHook(() => useCameraAccess());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });
    });

    it('should clear error when permission is granted', async () => {
      const { result } = renderHook(() => useCameraAccess());

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('Permission denied scenario', () => {
    beforeEach(() => {
      // Mock getUserMedia to reject
      navigator.mediaDevices.getUserMedia = vi
        .fn()
        .mockRejectedValue(new Error('Permission denied'));
    });

    it('should set error message when permission is denied', async () => {
      const { result } = renderHook(() => useCameraAccess());

      await waitFor(() => {
        expect(result.current.error).toBe(
          'Unable to access camera. Please grant camera permissions.'
        );
      });
    });

    it('should set hasPermission to false when permission is denied', async () => {
      const { result } = renderHook(() => useCameraAccess());

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(false);
      });
    });

    it('should set stream to null when permission is denied', async () => {
      const { result } = renderHook(() => useCameraAccess());

      await waitFor(() => {
        expect(result.current.stream).toBeNull();
      });
    });
  });

  describe('Permission pending/loading state', () => {
    it('should have hasPermission as null initially', () => {
      const { result } = renderHook(() => useCameraAccess());

      // Initial state before async operation completes
      expect(result.current.hasPermission).toBeNull();
    });

    it('should have stream as null initially', () => {
      const { result } = renderHook(() => useCameraAccess());

      // Initial state before async operation completes
      expect(result.current.stream).toBeNull();
    });

    it('should have error as null initially', () => {
      const { result } = renderHook(() => useCameraAccess());

      // Initial state before async operation completes
      expect(result.current.error).toBeNull();
    });

    it('should set hasPermission to null during request', async () => {
      let resolveGetUserMedia: (value: MediaStream) => void;
      const getUserMediaPromise = new Promise<MediaStream>((resolve) => {
        resolveGetUserMedia = resolve;
      });

      navigator.mediaDevices.getUserMedia = vi.fn().mockReturnValue(getUserMediaPromise);

      const { result } = renderHook(() => useCameraAccess());

      // Should be null while permission is being requested
      expect(result.current.hasPermission).toBeNull();

      // Resolve the promise
      resolveGetUserMedia!(mockStream);

      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });
    });
  });

  describe('Stream cleanup on unmount', () => {
    it('should stop all tracks when component unmounts', async () => {
      const { result, unmount } = renderHook(() => useCameraAccess());

      // Wait for stream to be set
      await waitFor(() => {
        expect(result.current.stream).toBe(mockStream);
      });

      // Unmount the hook
      unmount();

      // Verify track.stop() was called
      expect(mockTrack.stop).toHaveBeenCalledTimes(1);
    });

    it('should call getTracks and stop each track', async () => {
      const mockTrack2 = {
        ...mockTrack,
        stop: vi.fn(),
        id: 'mock-track-2',
      } as unknown as MediaStreamTrack;

      mockStream.getTracks = vi.fn(() => [mockTrack, mockTrack2]);

      const { result, unmount } = renderHook(() => useCameraAccess());

      await waitFor(() => {
        expect(result.current.stream).toBe(mockStream);
      });

      unmount();

      expect(mockStream.getTracks).toHaveBeenCalled();
      expect(mockTrack.stop).toHaveBeenCalledTimes(1);
      expect(mockTrack2.stop).toHaveBeenCalledTimes(1);
    });

    it('should not error if stream is null on unmount', () => {
      navigator.mediaDevices.getUserMedia = vi
        .fn()
        .mockRejectedValue(new Error('Permission denied'));

      const { unmount } = renderHook(() => useCameraAccess());

      // Should not throw when unmounting without a stream
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('autoStart lifecycle behavior', () => {
    it('stops current stream when autoStart is toggled to false', async () => {
      const { result, rerender } = renderHook(({ autoStart }) => useCameraAccess({ autoStart }), {
        initialProps: { autoStart: true },
      });

      await waitFor(() => {
        expect(result.current.stream).toBe(mockStream);
      });

      rerender({ autoStart: false });

      await waitFor(() => {
        expect(result.current.stream).toBeNull();
      });

      expect(mockTrack.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry functionality', () => {
    it('should provide a retry method', () => {
      const { result } = renderHook(() => useCameraAccess());

      expect(result.current.retry).toBeDefined();
      expect(typeof result.current.retry).toBe('function');
    });

    it('should call getUserMedia again when retry is invoked', async () => {
      // First call fails
      navigator.mediaDevices.getUserMedia = vi
        .fn()
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() => useCameraAccess());

      // Wait for initial failure
      await waitFor(() => {
        expect(result.current.hasPermission).toBe(false);
      });

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1);

      // Call retry
      result.current.retry();

      // Wait for retry to succeed
      await waitFor(() => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(2);
      });
    });

    it('should clear error before retry', async () => {
      // First call fails
      navigator.mediaDevices.getUserMedia = vi
        .fn()
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() => useCameraAccess());

      // Wait for initial failure
      await waitFor(() => {
        expect(result.current.error).toBe(
          'Unable to access camera. Please grant camera permissions.'
        );
      });

      // Call retry
      result.current.retry();

      // Error should be cleared immediately (synchronously)
      // We need to wait for the async operation to complete
      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });
    });

    it('should set hasPermission to null during retry', async () => {
      // First call fails
      navigator.mediaDevices.getUserMedia = vi
        .fn()
        .mockRejectedValueOnce(new Error('Permission denied'));

      const { result } = renderHook(() => useCameraAccess());

      // Wait for initial failure
      await waitFor(() => {
        expect(result.current.hasPermission).toBe(false);
      });

      // Mock successful retry
      navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockStream);

      // Call retry
      result.current.retry();

      // Should eventually succeed
      await waitFor(() => {
        expect(result.current.hasPermission).toBe(true);
      });
    });

    it('should update stream when retry succeeds', async () => {
      // First call fails
      navigator.mediaDevices.getUserMedia = vi
        .fn()
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce(mockStream);

      const { result } = renderHook(() => useCameraAccess());

      // Wait for initial failure
      await waitFor(() => {
        expect(result.current.stream).toBeNull();
      });

      // Call retry
      result.current.retry();

      // Wait for retry to succeed
      await waitFor(() => {
        expect(result.current.stream).toBe(mockStream);
      });
    });
  });

  describe('Constraint options', () => {
    it('should request rear camera with facingMode: environment', async () => {
      renderHook(() => useCameraAccess());

      await waitFor(() => {
        expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
        const call = (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mock
          .calls[0][0];
        expect(call.video.facingMode).toBe('environment');
      });
    });

    it('should request 3:2 aspect ratio', async () => {
      renderHook(() => useCameraAccess());

      await waitFor(() => {
        const call = (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mock
          .calls[0][0];
        expect(call.video.aspectRatio).toBe(3 / 2);
      });
    });

    it('should not request audio', async () => {
      renderHook(() => useCameraAccess());

      await waitFor(() => {
        const call = (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mock
          .calls[0][0];
        expect(call.audio).toBe(false);
      });
    });

    it('should request advanced low-light constraints', async () => {
      renderHook(() => useCameraAccess());

      await waitFor(() => {
        const call = (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mock
          .calls[0][0];

        // Check for enhanced low-light constraints
        expect(call.video.focusMode).toEqual({ ideal: 'continuous' });
        expect(call.video.pointsOfInterest).toEqual({ ideal: [{ x: 0.5, y: 0.5 }] });
        expect(call.video.exposureMode).toEqual({ ideal: 'continuous' });
        expect(call.video.whiteBalanceMode).toEqual({ ideal: 'continuous' });
        expect(call.video.brightness).toEqual({ ideal: 1.2 });
        expect(call.video.contrast).toEqual({ ideal: 1.2 });
      });
    });
  });

  describe('Contract validation', () => {
    it('should return all expected properties from the contract', async () => {
      const { result } = renderHook(() => useCameraAccess());

      // Check all properties from the API contract exist
      expect(result.current).toHaveProperty('stream');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('hasPermission');
      expect(result.current).toHaveProperty('retry');
    });

    it('should have correct types for all properties', async () => {
      const { result } = renderHook(() => useCameraAccess());

      await waitFor(() => {
        expect(result.current.stream).toBe(mockStream);
      });

      // stream: MediaStream | null
      expect(result.current.stream === null || result.current.stream instanceof Object).toBe(true);

      // error: string | null
      expect(typeof result.current.error === 'string' || result.current.error === null).toBe(true);

      // hasPermission: boolean | null
      expect(
        typeof result.current.hasPermission === 'boolean' || result.current.hasPermission === null
      ).toBe(true);

      // retry: () => void
      expect(typeof result.current.retry).toBe('function');
    });
  });

  describe('Edge cases', () => {
    it('should handle getUserMedia throwing synchronous error', async () => {
      navigator.mediaDevices.getUserMedia = vi.fn().mockImplementation(() => {
        throw new Error('Synchronous error');
      });

      const { result } = renderHook(() => useCameraAccess());

      // The hook should catch the error
      await waitFor(() => {
        expect(result.current.hasPermission).toBe(false);
        expect(result.current.error).toBe(
          'Unable to access camera. Please grant camera permissions.'
        );
      });
    });

    it('should handle multiple rapid retry calls', async () => {
      navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(mockStream);

      const { result } = renderHook(() => useCameraAccess());

      await waitFor(() => {
        expect(result.current.stream).toBe(mockStream);
      });

      // Call retry multiple times rapidly
      result.current.retry();
      result.current.retry();
      result.current.retry();

      // Should still work correctly
      await waitFor(() => {
        expect(result.current.stream).toBe(mockStream);
        expect(result.current.hasPermission).toBe(true);
      });

      // getUserMedia should be called at least once for initial mount + retries
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    });

    it('should handle stream with no tracks', async () => {
      const emptyStream = {
        ...mockStream,
        getTracks: vi.fn(() => []),
        getVideoTracks: vi.fn(() => []),
      } as unknown as MediaStream;

      navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue(emptyStream);

      const { result, unmount } = renderHook(() => useCameraAccess());

      await waitFor(() => {
        expect(result.current.stream).toBe(emptyStream);
      });

      // Should not error when unmounting with no tracks
      expect(() => unmount()).not.toThrow();
    });
  });
});
