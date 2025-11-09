import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMotionDetection } from './useMotionDetection';

/**
 * Motion Detection Module Tests
 *
 * Tests validate the module's contract as defined in README.md:
 * - Analyzing video frames for pixel differences
 * - Determining if camera is moving based on threshold
 * - Providing movement state to other components
 */

// Helper function to create a mock MediaStream
function createMockMediaStream(): MediaStream {
  const mockTrack = {
    stop: vi.fn(),
    getSettings: vi.fn(() => ({
      width: 1280,
      height: 720,
      frameRate: 30,
    })),
  };

  return {
    getTracks: vi.fn(() => [mockTrack]),
    getVideoTracks: vi.fn(() => [mockTrack]),
    getAudioTracks: vi.fn(() => []),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaStream;
}

// Helper function to generate mock frame data
function generateMockFrameData(width: number, height: number, color: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);

  // Fill with specified color (grayscale)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = color; // R
    data[i + 1] = color; // G
    data[i + 2] = color; // B
    data[i + 3] = 255; // A
  }

  return {
    data,
    width,
    height,
    colorSpace: 'srgb',
  } as ImageData;
}

describe('useMotionDetection', () => {
  let mockVideoElement: Partial<HTMLVideoElement>;
  let mockCanvasContext: Partial<CanvasRenderingContext2D>;
  let originalCreateElement: typeof document.createElement;
  let frameDataSequence: ImageData[];
  let frameDataIndex: number;

  beforeEach(() => {
    vi.useFakeTimers();
    frameDataSequence = [];
    frameDataIndex = 0;

    // Mock video element with readyState
    mockVideoElement = {
      srcObject: null,
      autoplay: true,
      muted: true,
      playsInline: true,
      videoWidth: 320,
      videoHeight: 240,
      HAVE_ENOUGH_DATA: 4,
    };
    // Use Object.defineProperty to make readyState writable
    Object.defineProperty(mockVideoElement, 'readyState', {
      value: 4,
      writable: true,
    });

    // Mock canvas context that returns our test frame data
    mockCanvasContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => {
        if (frameDataSequence.length > 0) {
          const data = frameDataSequence[frameDataIndex % frameDataSequence.length];
          frameDataIndex++;
          return data;
        }
        return generateMockFrameData(80, 60, 128); // Default gray frame
      }),
    };

    // Save original createElement
    originalCreateElement = document.createElement;

    // Mock document.createElement to return our mocks
    document.createElement = vi.fn((tagName: string) => {
      if (tagName === 'video') {
        return mockVideoElement as HTMLVideoElement;
      }
      if (tagName === 'canvas') {
        const mockCanvas = {
          width: 0,
          height: 0,
          getContext: vi.fn(() => mockCanvasContext as CanvasRenderingContext2D),
        };
        return mockCanvas as unknown as HTMLCanvasElement;
      }
      return originalCreateElement.call(document, tagName);
    }) as typeof document.createElement;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    document.createElement = originalCreateElement;
  });

  describe('Initial State', () => {
    it('should initialize with isMoving as false', () => {
      const { result } = renderHook(() => useMotionDetection(null));

      expect(result.current.isMoving).toBe(false);
    });

    it('should initialize with default sensitivity of 50', () => {
      const { result } = renderHook(() => useMotionDetection(null));

      expect(result.current.sensitivity).toBe(50);
    });

    it('should accept custom sensitivity via options', () => {
      const { result } = renderHook(() =>
        useMotionDetection(null, { sensitivity: 75 })
      );

      expect(result.current.sensitivity).toBe(75);
    });

    it('should provide setSensitivity function', () => {
      const { result } = renderHook(() => useMotionDetection(null));

      expect(typeof result.current.setSensitivity).toBe('function');
    });
  });

  describe('Pixel Difference Calculation', () => {
    it('should detect no motion when frames are identical', async () => {
      const mockStream = createMockMediaStream();

      // Generate two identical frames (same color)
      frameDataSequence = [
        generateMockFrameData(80, 60, 128),
        generateMockFrameData(80, 60, 128),
      ];

      const { result } = renderHook(() =>
        useMotionDetection(mockStream, { checkInterval: 100 })
      );

      // Advance time to trigger motion detection twice
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(result.current.isMoving).toBe(false);
    });

    it('should detect motion when frames differ significantly', async () => {
      const mockStream = createMockMediaStream();

      // Generate two very different frames (black vs white)
      frameDataSequence = [
        generateMockFrameData(80, 60, 0),
        generateMockFrameData(80, 60, 255),
      ];

      const { result } = renderHook(() =>
        useMotionDetection(mockStream, { checkInterval: 100 })
      );

      // First check captures initial frame
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Second check compares and detects motion
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(result.current.isMoving).toBe(true);
    });

    it('should not detect motion for small pixel differences', async () => {
      const mockStream = createMockMediaStream();

      // Generate frames with minor differences (128 vs 130)
      frameDataSequence = [
        generateMockFrameData(80, 60, 128),
        generateMockFrameData(80, 60, 130),
      ];

      const { result } = renderHook(() =>
        useMotionDetection(mockStream, { checkInterval: 100 })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(result.current.isMoving).toBe(false);
    });
  });

  describe('Sensitivity Adjustment', () => {
    it('should allow changing sensitivity', () => {
      const { result } = renderHook(() => useMotionDetection(null));

      expect(result.current.sensitivity).toBe(50);

      act(() => {
        result.current.setSensitivity(80);
      });

      expect(result.current.sensitivity).toBe(80);
    });

    it('should detect motion with high sensitivity (low threshold)', async () => {
      const mockStream = createMockMediaStream();

      // Frames with moderate difference (more pixels changing)
      frameDataSequence = [
        generateMockFrameData(80, 60, 80),
        generateMockFrameData(80, 60, 200),
      ];

      const { result } = renderHook(() =>
        useMotionDetection(mockStream, { sensitivity: 80, checkInterval: 100 })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Higher sensitivity should detect this motion
      expect(result.current.isMoving).toBe(true);
    });

    it('should not detect motion with low sensitivity (high threshold)', async () => {
      const mockStream = createMockMediaStream();

      // Frames with small difference (won't trigger at low sensitivity)
      frameDataSequence = [
        generateMockFrameData(80, 60, 100),
        generateMockFrameData(80, 60, 120),
      ];

      const { result } = renderHook(() =>
        useMotionDetection(mockStream, { sensitivity: 10, checkInterval: 100 })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Lower sensitivity should not detect this motion
      expect(result.current.isMoving).toBe(false);
    });

    it('should update motion detection when sensitivity changes', async () => {
      const mockStream = createMockMediaStream();

      // Frames with medium difference
      // At low sensitivity (10): pixelThreshold=75, minDiffPixels=1400 - won't detect
      // At high sensitivity (80): pixelThreshold=40, minDiffPixels=700 - will detect
      frameDataSequence = [
        generateMockFrameData(80, 60, 100),
        generateMockFrameData(80, 60, 160), // difference of 60
        generateMockFrameData(80, 60, 100),
        generateMockFrameData(80, 60, 160),
      ];

      const { result } = renderHook(() =>
        useMotionDetection(mockStream, { sensitivity: 10, checkInterval: 100 })
      );

      // With low sensitivity, no motion detected
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(result.current.isMoving).toBe(false);

      // Increase sensitivity
      act(() => {
        result.current.setSensitivity(80);
      });

      // Now motion should be detected
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(result.current.isMoving).toBe(true);
    });
  });

  describe('Motion State Changes', () => {
    it('should toggle isMoving correctly based on frame changes', async () => {
      const mockStream = createMockMediaStream();

      // Sequence: still -> moving -> still
      frameDataSequence = [
        generateMockFrameData(80, 60, 100), // Initial
        generateMockFrameData(80, 60, 100), // Same - no motion
        generateMockFrameData(80, 60, 255), // Different - motion
        generateMockFrameData(80, 60, 255), // Same - no motion
      ];

      const { result } = renderHook(() =>
        useMotionDetection(mockStream, { checkInterval: 100 })
      );

      // Initial frame
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(result.current.isMoving).toBe(false);

      // Same frame - no motion
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(result.current.isMoving).toBe(false);

      // Different frame - motion detected
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(result.current.isMoving).toBe(true);

      // Same frame again - no motion
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(result.current.isMoving).toBe(false);
    });

    it('should respect custom check interval', async () => {
      const mockStream = createMockMediaStream();

      frameDataSequence = [
        generateMockFrameData(80, 60, 0),
        generateMockFrameData(80, 60, 255),
      ];

      renderHook(() =>
        useMotionDetection(mockStream, { checkInterval: 1000 })
      );

      // Before interval - no check should have happened
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(mockCanvasContext.getImageData).not.toHaveBeenCalled();

      // After first interval - first check
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(mockCanvasContext.getImageData).toHaveBeenCalledTimes(1);

      // After second interval - second check
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      expect(mockCanvasContext.getImageData).toHaveBeenCalledTimes(2);
    });

    it('should continuously check for motion at intervals', async () => {
      const mockStream = createMockMediaStream();

      frameDataSequence = [
        generateMockFrameData(80, 60, 100),
        generateMockFrameData(80, 60, 100),
        generateMockFrameData(80, 60, 100),
      ];

      renderHook(() => useMotionDetection(mockStream, { checkInterval: 100 }));

      // Should check every 100ms
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(mockCanvasContext.getImageData).toHaveBeenCalledTimes(3);
    });
  });

  describe('No Stream Handling', () => {
    it('should not throw error when stream is null', () => {
      expect(() => {
        renderHook(() => useMotionDetection(null));
      }).not.toThrow();
    });

    it('should keep isMoving as false when stream is null', async () => {
      const { result } = renderHook(() =>
        useMotionDetection(null, { checkInterval: 100 })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(result.current.isMoving).toBe(false);
    });

    it('should not perform motion detection when stream is null', async () => {
      renderHook(() => useMotionDetection(null, { checkInterval: 100 }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockCanvasContext.getImageData).not.toHaveBeenCalled();
    });

    it('should handle stream becoming null after initialization', async () => {
      const mockStream = createMockMediaStream();

      const { rerender, result } = renderHook(
        ({ stream }: { stream: MediaStream | null }) =>
          useMotionDetection(stream, { checkInterval: 100 }),
        { initialProps: { stream: mockStream as MediaStream | null } }
      );

      // Stream is active
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(mockCanvasContext.getImageData).toHaveBeenCalled();

      // Clear mocks
      vi.clearAllMocks();

      // Stream becomes null
      rerender({ stream: null as MediaStream | null });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should not check for motion anymore
      expect(mockCanvasContext.getImageData).not.toHaveBeenCalled();
      expect(result.current.isMoving).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle video element not ready', async () => {
      const mockStream = createMockMediaStream();

      // Set video to not ready state
      Object.defineProperty(mockVideoElement, 'readyState', {
        value: 0,
        writable: true,
      });

      renderHook(() => useMotionDetection(mockStream, { checkInterval: 100 }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      // Should not attempt to get image data when video not ready
      expect(mockCanvasContext.getImageData).not.toHaveBeenCalled();
    });

    it('should handle missing canvas context', async () => {
      const mockStream = createMockMediaStream();

      // Mock getContext to return null
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => null),
      };

      document.createElement = vi.fn((tagName: string) => {
        if (tagName === 'video') {
          return mockVideoElement as HTMLVideoElement;
        }
        if (tagName === 'canvas') {
          return mockCanvas as unknown as HTMLCanvasElement;
        }
        return originalCreateElement.call(document, tagName);
      }) as typeof document.createElement;

      const { result } = renderHook(() =>
        useMotionDetection(mockStream, { checkInterval: 100 })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      // Should not crash, isMoving should remain false
      expect(result.current.isMoving).toBe(false);
    });

    it('should handle extreme sensitivity values', () => {
      const { result: result1 } = renderHook(() =>
        useMotionDetection(null, { sensitivity: 0 })
      );
      expect(result1.current.sensitivity).toBe(0);

      const { result: result2 } = renderHook(() =>
        useMotionDetection(null, { sensitivity: 100 })
      );
      expect(result2.current.sensitivity).toBe(100);
    });

    it('should handle very small check intervals', async () => {
      const mockStream = createMockMediaStream();

      frameDataSequence = [generateMockFrameData(80, 60, 100)];

      renderHook(() => useMotionDetection(mockStream, { checkInterval: 10 }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      // Should have checked 5 times
      expect(mockCanvasContext.getImageData).toHaveBeenCalledTimes(5);
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on unmount', async () => {
      const mockStream = createMockMediaStream();

      const { unmount } = renderHook(() =>
        useMotionDetection(mockStream, { checkInterval: 100 })
      );

      // Let it run for a bit
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      const getImageData = mockCanvasContext.getImageData as ReturnType<typeof vi.fn>;
      const callCountBeforeUnmount = getImageData.mock.calls.length;

      unmount();

      // Advance time - should not make more calls
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(mockCanvasContext.getImageData).toHaveBeenCalledTimes(callCountBeforeUnmount);
    });

    it('should handle unmount with null stream gracefully', () => {
      const { unmount } = renderHook(() => useMotionDetection(null));

      expect(() => unmount()).not.toThrow();
    });

    it('should stop interval on unmount', async () => {
      const mockStream = createMockMediaStream();

      const { unmount } = renderHook(() =>
        useMotionDetection(mockStream, { checkInterval: 100 })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      unmount();

      const getImageData = mockCanvasContext.getImageData as ReturnType<typeof vi.fn>;
      const initialCalls = getImageData.mock.calls.length;

      // Time passes but no new checks
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });

      expect(mockCanvasContext.getImageData).toHaveBeenCalledTimes(initialCalls);
    });
  });

  describe('Canvas Configuration', () => {
    it('should use downscaled resolution for performance', async () => {
      const mockStream = createMockMediaStream();

      frameDataSequence = [generateMockFrameData(80, 60, 100)];

      renderHook(() => useMotionDetection(mockStream, { checkInterval: 100 }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // drawImage should be called with downscaled dimensions
      expect(mockCanvasContext.drawImage).toHaveBeenCalledWith(
        mockVideoElement,
        0,
        0,
        80, // width / 4
        60  // height / 4
      );
    });

    it('should request image data with correct dimensions', async () => {
      const mockStream = createMockMediaStream();

      frameDataSequence = [generateMockFrameData(80, 60, 100)];

      renderHook(() => useMotionDetection(mockStream, { checkInterval: 100 }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(mockCanvasContext.getImageData).toHaveBeenCalledWith(0, 0, 80, 60);
    });
  });
});
