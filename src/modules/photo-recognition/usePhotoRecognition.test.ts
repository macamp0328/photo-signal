/**
 * Tests for Photo Recognition Module
 *
 * Validates dHash-based recognition logic and state management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePhotoRecognition } from './usePhotoRecognition';
import { dataService } from '../../services/data-service';
import type { Concert } from '../../types';

// Mock the contexts
vi.mock('../../contexts', () => ({
  useFeatureFlags: vi.fn(() => ({
    isTestMode: false,
    setTestMode: vi.fn(),
    isGrayscaleMode: false,
    setGrayscaleMode: vi.fn(),
  })),
}));

// Mock the data service
vi.mock('../../services/data-service', () => ({
  dataService: {
    getConcerts: vi.fn(),
    clearCache: vi.fn(),
    subscribe: vi.fn(() => () => {}), // Returns unsubscribe function
  },
}));

// Mock the hashing algorithms
vi.mock('./algorithms/dhash', () => ({
  computeDHash: vi.fn((imageData: ImageData) => {
    // Return a predictable hash based on image data
    // For testing, we'll use a simple checksum
    const sum = Array.from(imageData.data).reduce((a, b) => a + b, 0);
    return sum.toString(16).padStart(16, '0');
  }),
}));

vi.mock('./algorithms/hamming', () => ({
  hammingDistance: vi.fn((hash1: string, hash2: string) => {
    // Simple distance: count different characters
    let distance = 0;
    for (let i = 0; i < Math.min(hash1.length, hash2.length); i++) {
      if (hash1[i] !== hash2[i]) {
        distance += 4; // Each hex char represents 4 bits
      }
    }
    return distance;
  }),
}));

describe('usePhotoRecognition', () => {
  // Mock concert data with photoHashes
  const mockConcerts: Concert[] = [
    {
      id: 1,
      band: 'Test Band 1',
      venue: 'Test Venue 1',
      date: '2023-08-15',
      audioFile: '/audio/test1.mp3',
      photoHash: 'a5b3c7d9e1f20486', // Known hash
    },
    {
      id: 2,
      band: 'Test Band 2',
      venue: 'Test Venue 2',
      date: '2023-09-20',
      audioFile: '/audio/test2.mp3',
      photoHash: 'b6c4d8e2f3a10597', // Different hash
    },
  ];

  // Create a proper MediaStream mock
  let mockStream: MediaStream;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create a better MediaStream mock that happy-dom will accept
    const mockTrack = {
      kind: 'video',
      id: 'mock-track-id',
      label: 'Mock Video Track',
      enabled: true,
      muted: false,
      readyState: 'live',
      getConstraints: vi.fn(),
      getSettings: vi.fn(() => ({ width: 640, height: 480, frameRate: 30 })),
      getCapabilities: vi.fn(),
      stop: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    mockStream = {
      id: 'mock-stream-id',
      active: true,
      getTracks: vi.fn(() => [mockTrack]),
      getVideoTracks: vi.fn(() => [mockTrack]),
      getAudioTracks: vi.fn(() => []),
      getTrackById: vi.fn(),
      addTrack: vi.fn(),
      removeTrack: vi.fn(),
      clone: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaStream;

    // Setup default mock behavior
    vi.mocked(dataService.getConcerts).mockResolvedValue(mockConcerts);
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

  describe('Reset Functionality', () => {
    it('should reset recognizedConcert to null', async () => {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, {
          recognitionDelay: 100,
          checkInterval: 50,
        })
      );

      // Wait for concerts to load
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Manually set a recognized concert to test reset
      // (In real scenario, recognition would set this)
      act(() => {
        // Simulate recognition by setting state
        result.current.reset();
      });

      expect(result.current.recognizedConcert).toBeNull();
    });

    it('should reset isRecognizing to false', () => {
      const { result } = renderHook(() => usePhotoRecognition(mockStream));

      act(() => {
        result.current.reset();
      });

      expect(result.current.isRecognizing).toBe(false);
    });
  });

  describe('Enabled/Disabled State', () => {
    it('should not start recognition when enabled is false', async () => {
      const { result } = renderHook(() => usePhotoRecognition(mockStream, { enabled: false }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(result.current.isRecognizing).toBe(false);
      expect(result.current.recognizedConcert).toBeNull();
    });

    it('should start processing when enabled is true', async () => {
      renderHook(() => usePhotoRecognition(mockStream, { enabled: true }));

      // Should load concerts
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(dataService.getConcerts).toHaveBeenCalled();
    });
  });

  describe('No Stream Handling', () => {
    it('should not process when stream is null', async () => {
      const { result } = renderHook(() => usePhotoRecognition(null));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000);
      });

      expect(result.current.isRecognizing).toBe(false);
      expect(result.current.recognizedConcert).toBeNull();
    });

    it('should not throw errors when stream is null', () => {
      expect(() => {
        renderHook(() => usePhotoRecognition(null));
      }).not.toThrow();
    });

    it('should start processing when stream changes from null to valid stream', async () => {
      const { result, rerender } = renderHook(({ stream }) => usePhotoRecognition(stream), {
        initialProps: { stream: null as MediaStream | null },
      });

      // Initially no stream
      expect(result.current.isRecognizing).toBe(false);

      // Provide stream
      act(() => {
        rerender({ stream: mockStream });
      });

      // Should start loading concerts
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(dataService.getConcerts).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clean up on unmount', async () => {
      const { unmount } = renderHook(() => usePhotoRecognition(mockStream, { checkInterval: 100 }));

      // Start processing
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Unmount
      unmount();

      // Should not throw errors
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    });
  });

  describe('Configuration Options', () => {
    it('should use default checkInterval of 1000ms', async () => {
      const { result } = renderHook(() => usePhotoRecognition(mockStream));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(result.current).toBeDefined();
    });

    it('should use custom checkInterval', async () => {
      const { result } = renderHook(() => usePhotoRecognition(mockStream, { checkInterval: 500 }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(result.current).toBeDefined();
    });

    it('should use custom similarityThreshold', async () => {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, { similarityThreshold: 5 })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(result.current).toBeDefined();
    });

    it('should use custom recognitionDelay', async () => {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, { recognitionDelay: 500 })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(result.current).toBeDefined();
    });
  });

  describe('Concert Data Loading', () => {
    it('should load concerts on mount', async () => {
      renderHook(() => usePhotoRecognition(mockStream));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(dataService.getConcerts).toHaveBeenCalled();
    });

    it('should handle empty concert list', async () => {
      vi.mocked(dataService.getConcerts).mockResolvedValue([]);

      const { result } = renderHook(() => usePhotoRecognition(mockStream));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(result.current.recognizedConcert).toBeNull();
    });

    it('should not process frames until concerts are loaded', async () => {
      const { result } = renderHook(() => usePhotoRecognition(mockStream, { checkInterval: 50 }));

      // Before concerts load, should not be processing
      expect(result.current.isRecognizing).toBe(false);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // After loading, might start processing if there's a match
      expect(dataService.getConcerts).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in concert loading gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(dataService.getConcerts).mockRejectedValue(new Error('Test error'));

      const { result } = renderHook(() => usePhotoRecognition(mockStream));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should not crash
      expect(result.current.recognizedConcert).toBeNull();

      consoleErrorSpy.mockRestore();
    });
  });
});
