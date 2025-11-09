/**
 * Tests for Photo Recognition Module
 *
 * Validates placeholder recognition logic and state management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePhotoRecognition } from './usePhotoRecognition';
import { dataService } from '../../services/data-service';
import type { Concert } from '../../types';

// Mock the data service
vi.mock('../../services/data-service', () => ({
  dataService: {
    getConcerts: vi.fn(),
    getRandomConcert: vi.fn(),
    clearCache: vi.fn(),
  },
}));

describe('usePhotoRecognition', () => {
  // Mock concert data
  const mockConcert: Concert = {
    id: 1,
    band: 'Test Band',
    venue: 'Test Venue',
    date: '2023-08-15',
    audioFile: '/audio/test.mp3',
  };

  // Mock stream
  const mockStream = {
    getTracks: vi.fn(() => []),
    getVideoTracks: vi.fn(() => []),
    getAudioTracks: vi.fn(() => []),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaStream;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup default mock behavior
    vi.mocked(dataService.getConcerts).mockResolvedValue([mockConcert]);
    vi.mocked(dataService.getRandomConcert).mockReturnValue(mockConcert);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should have null recognizedConcert initially', () => {
      const { result } = renderHook(() => usePhotoRecognition(null));

      expect(result.current.recognizedConcert).toBeNull();
    });

    it('should have isRecognizing false initially', () => {
      const { result } = renderHook(() => usePhotoRecognition(null));

      expect(result.current.isRecognizing).toBe(false);
    });

    it('should provide reset function', () => {
      const { result } = renderHook(() => usePhotoRecognition(null));

      expect(result.current.reset).toBeDefined();
      expect(typeof result.current.reset).toBe('function');
    });
  });

  describe('Recognition Delay Timing', () => {
    it('should not trigger recognition before delay period', async () => {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, { recognitionDelay: 3000 })
      );

      // Should be recognizing immediately when stream is provided
      expect(result.current.isRecognizing).toBe(true);

      // Advance timer by 2 seconds (less than 3 second delay)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      // Should still be recognizing, concert not recognized yet
      expect(result.current.isRecognizing).toBe(true);
      expect(result.current.recognizedConcert).toBeNull();
    });

    it('should trigger recognition after delay period', async () => {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, { recognitionDelay: 3000 })
      );

      // Initially recognizing
      expect(result.current.isRecognizing).toBe(true);

      // Advance timer by 3 seconds (exactly the delay)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      // Recognition should be complete
      expect(result.current.recognizedConcert).toEqual(mockConcert);
      expect(result.current.isRecognizing).toBe(false);
    });

    it('should respect custom recognition delay', async () => {
      const customDelay = 5000;
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, { recognitionDelay: customDelay })
      );

      expect(result.current.isRecognizing).toBe(true);

      // Advance to just before custom delay
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4999);
      });
      expect(result.current.recognizedConcert).toBeNull();

      // Advance past custom delay
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
      });

      expect(result.current.recognizedConcert).toEqual(mockConcert);
      expect(result.current.isRecognizing).toBe(false);
    });
  });

  describe('Recognition Flow', () => {
    it('should set isRecognizing to true when stream is provided', () => {
      const { result } = renderHook(() => usePhotoRecognition(mockStream));

      expect(result.current.isRecognizing).toBe(true);
    });

    it('should recognize concert after delay', async () => {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, { recognitionDelay: 3000 })
      );

      expect(result.current.isRecognizing).toBe(true);

      // Advance timer past delay
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(result.current.recognizedConcert).toEqual(mockConcert);
    });

    it('should set isRecognizing to false after recognition completes', async () => {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, { recognitionDelay: 3000 })
      );

      expect(result.current.isRecognizing).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(result.current.isRecognizing).toBe(false);
    });

    it('should call dataService.getConcerts during recognition', async () => {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, { recognitionDelay: 3000 })
      );

      expect(result.current.isRecognizing).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(dataService.getConcerts).toHaveBeenCalled();
    });

    it('should call dataService.getRandomConcert to get concert', async () => {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, { recognitionDelay: 3000 })
      );

      expect(result.current.isRecognizing).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(dataService.getRandomConcert).toHaveBeenCalled();
    });

    it('should handle errors gracefully during recognition', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(dataService.getConcerts).mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, { recognitionDelay: 3000 })
      );

      expect(result.current.isRecognizing).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(result.current.isRecognizing).toBe(false);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Photo recognition error:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Reset Functionality', () => {
    it('should reset recognizedConcert to null', async () => {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, { recognitionDelay: 3000 })
      );

      // Wait for recognition
      expect(result.current.isRecognizing).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(result.current.recognizedConcert).toEqual(mockConcert);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.recognizedConcert).toBeNull();
    });

    it('should reset isRecognizing to false', async () => {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, { recognitionDelay: 3000 })
      );

      expect(result.current.isRecognizing).toBe(true);

      // Reset before recognition completes
      act(() => {
        result.current.reset();
      });

      expect(result.current.isRecognizing).toBe(false);
    });

    it('should allow recognition to happen again after reset', async () => {
      const { result, rerender } = renderHook(
        ({ stream }: { stream: MediaStream | null }) =>
          usePhotoRecognition(stream, { recognitionDelay: 3000 }),
        { initialProps: { stream: mockStream as MediaStream | null } }
      );

      // First recognition
      expect(result.current.isRecognizing).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(result.current.recognizedConcert).toEqual(mockConcert);

      // Reset
      act(() => {
        result.current.reset();
      });

      // Remove and re-add stream to trigger recognition again
      act(() => {
        rerender({ stream: null });
      });
      act(() => {
        rerender({ stream: mockStream });
      });

      expect(result.current.isRecognizing).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(result.current.recognizedConcert).toEqual(mockConcert);
    });

    it('should clear timeout when reset is called', async () => {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, { recognitionDelay: 3000 })
      );

      expect(result.current.isRecognizing).toBe(true);

      // Reset before timeout completes
      act(() => {
        result.current.reset();
      });

      // Advance timer past original delay
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      // Recognition should not have happened because timeout was cleared
      expect(result.current.recognizedConcert).toBeNull();
    });
  });

  describe('Enabled/Disabled State', () => {
    it('should not recognize when enabled is false', async () => {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, { enabled: false, recognitionDelay: 3000 })
      );

      // Should not start recognizing
      expect(result.current.isRecognizing).toBe(false);

      // Advance timer
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      // Should still not recognize
      expect(result.current.isRecognizing).toBe(false);
      expect(result.current.recognizedConcert).toBeNull();
    });

    it('should recognize when enabled is true', async () => {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, { enabled: true, recognitionDelay: 3000 })
      );

      expect(result.current.isRecognizing).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(result.current.recognizedConcert).toEqual(mockConcert);
    });

    it('should resume recognition when enabled changes from false to true', async () => {
      const { result, rerender } = renderHook(
        ({ enabled }) => usePhotoRecognition(mockStream, { enabled, recognitionDelay: 3000 }),
        { initialProps: { enabled: false } }
      );

      // Initially disabled
      expect(result.current.isRecognizing).toBe(false);

      // Enable recognition
      act(() => {
        rerender({ enabled: true });
      });

      expect(result.current.isRecognizing).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(result.current.recognizedConcert).toEqual(mockConcert);
    });

    it('should use default enabled value of true', async () => {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, { recognitionDelay: 3000 })
      );

      expect(result.current.isRecognizing).toBe(true);
    });
  });

  describe('No Stream Handling', () => {
    it('should not recognize when stream is null', async () => {
      const { result } = renderHook(() => usePhotoRecognition(null, { recognitionDelay: 3000 }));

      expect(result.current.isRecognizing).toBe(false);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(result.current.isRecognizing).toBe(false);
      expect(result.current.recognizedConcert).toBeNull();
    });

    it('should not throw errors when stream is null', () => {
      expect(() => {
        renderHook(() => usePhotoRecognition(null));
      }).not.toThrow();
    });

    it('should handle stream changing from null to valid stream', async () => {
      const { result, rerender } = renderHook(
        ({ stream }) => usePhotoRecognition(stream, { recognitionDelay: 3000 }),
        { initialProps: { stream: null as MediaStream | null } }
      );

      // Initially no stream
      expect(result.current.isRecognizing).toBe(false);

      // Provide stream
      act(() => {
        rerender({ stream: mockStream });
      });

      expect(result.current.isRecognizing).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(result.current.recognizedConcert).toEqual(mockConcert);
    });

    it('should clear timeout when stream changes from valid to null', async () => {
      const { result, rerender } = renderHook(
        ({ stream }: { stream: MediaStream | null }) =>
          usePhotoRecognition(stream, { recognitionDelay: 3000 }),
        { initialProps: { stream: mockStream as MediaStream | null } }
      );

      expect(result.current.isRecognizing).toBe(true);

      // Remove stream before recognition completes
      act(() => {
        rerender({ stream: null });
      });

      // The implementation clears the timeout but doesn't reset isRecognizing
      // This is current behavior - isRecognizing stays true until timeout fires
      // or reset() is called

      // Advancing timers should not trigger recognition because timeout was cleared
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      // No concert should be recognized
      expect(result.current.recognizedConcert).toBeNull();
      // dataService should not have been called
      expect(dataService.getRandomConcert).not.toHaveBeenCalled();
    });
  });

  describe('Concert Already Recognized', () => {
    it('should not recognize again if concert already recognized', async () => {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, { recognitionDelay: 3000 })
      );

      // First recognition
      expect(result.current.isRecognizing).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      expect(result.current.recognizedConcert).toEqual(mockConcert);

      // Clear mocks to track new calls
      vi.clearAllMocks();

      // Advance more time
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      // Should not call getRandomConcert again
      expect(dataService.getRandomConcert).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clear timeout on unmount', async () => {
      const { result, unmount } = renderHook(() =>
        usePhotoRecognition(mockStream, { recognitionDelay: 3000 })
      );

      expect(result.current.isRecognizing).toBe(true);

      // Unmount before timeout completes
      unmount();

      // Advance timer
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });

      // No recognition should happen (component is unmounted)
      // This shouldn't throw errors
      expect(dataService.getRandomConcert).not.toHaveBeenCalled();
    });
  });
});
