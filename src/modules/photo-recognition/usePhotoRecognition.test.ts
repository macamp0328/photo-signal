import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataService } from '../../services/data-service';
import type { Concert } from '../../types';
import { usePhotoRecognition } from './usePhotoRecognition';

const mockIsEnabled = vi.fn<(flag: string) => boolean>(() => false);
let activeFrameHash = 'a5b3c7d9e1f20486';

vi.mock('../secret-settings', () => ({
  useFeatureFlags: vi.fn(() => ({
    flags: [],
    toggleFlag: vi.fn(),
    isEnabled: mockIsEnabled,
    resetFlags: vi.fn(),
  })),
}));

vi.mock('../../services/data-service', () => ({
  dataService: {
    getConcerts: vi.fn(),
    clearCache: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock('./algorithms/phash', () => ({
  computePHash: vi.fn(() => activeFrameHash),
}));

vi.mock('./algorithms/hamming', () => ({
  hammingDistance: vi.fn((hash1: string, hash2: string) => {
    let distance = 0;
    for (let i = 0; i < Math.min(hash1.length, hash2.length); i += 1) {
      if (hash1[i] !== hash2[i]) {
        distance += 4;
      }
    }
    return distance;
  }),
}));

describe('usePhotoRecognition', () => {
  const mockConcerts: Concert[] = [
    {
      id: 1,
      band: 'Test Band 1',
      venue: 'Test Venue 1',
      date: '2023-08-15T20:00:00-05:00',
      audioFile: '/audio/test1.opus',
      photoHashes: {
        phash: ['a5b3c7d9e1f20486', 'a5b3c7d9e1f20487', 'a5b3c7d9e1f20488'],
      },
    },
    {
      id: 2,
      band: 'Test Band 2',
      venue: 'Test Venue 2',
      date: '2023-09-20T19:30:00-05:00',
      audioFile: '/audio/test2.opus',
      photoHashes: {
        phash: ['b6c4d8e2f3a10597', 'b6c4d8e2f3a10598', 'b6c4d8e2f3a10599'],
      },
    },
  ];

  let mockStream: MediaStream;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockIsEnabled.mockReturnValue(false);
    activeFrameHash = 'a5b3c7d9e1f20486';

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

    vi.mocked(dataService.getConcerts).mockResolvedValue(mockConcerts);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with null recognized concert', () => {
    const { result } = renderHook(() => usePhotoRecognition(null));
    expect(result.current.recognizedConcert).toBeNull();
    expect(result.current.isRecognizing).toBe(false);
  });

  it('provides reset function', () => {
    const { result } = renderHook(() => usePhotoRecognition(null));
    expect(typeof result.current.reset).toBe('function');
  });

  it('loads concerts when enabled and stream exists', async () => {
    renderHook(() => usePhotoRecognition(mockStream, { enabled: true }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(dataService.getConcerts).toHaveBeenCalled();
  });

  it('does not start matching when disabled', async () => {
    const { result } = renderHook(() => usePhotoRecognition(mockStream, { enabled: false }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(result.current.isRecognizing).toBe(false);
    expect(result.current.recognizedConcert).toBeNull();
  });

  it('supports rectangle detection options', () => {
    const { result } = renderHook(() =>
      usePhotoRecognition(mockStream, {
        enableRectangleDetection: true,
        rectangleConfidenceThreshold: 0.3,
      })
    );

    expect(result.current.detectedRectangle).toBeNull();
    expect(result.current.rectangleConfidence).toBe(0);
  });

  it('supports configurable thresholds', () => {
    const { result } = renderHook(() =>
      usePhotoRecognition(mockStream, {
        similarityThreshold: 10,
        recognitionDelay: 800,
        checkInterval: 200,
      })
    );

    expect(result.current).toBeDefined();
  });

  it('resets state cleanly', async () => {
    const { result } = renderHook(() => usePhotoRecognition(mockStream));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.recognizedConcert).toBeNull();
    expect(result.current.isRecognizing).toBe(false);
    expect(result.current.activeGuidance).toBe('none');
  });

  it('handles data loading errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(dataService.getConcerts).mockRejectedValueOnce(new Error('load failed'));

    const { result } = renderHook(() => usePhotoRecognition(mockStream));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.recognizedConcert).toBeNull();
    consoleSpy.mockRestore();
  });

  it('confirms a strong match within 500ms', async () => {
    const originalCreateElement = document.createElement.bind(document);

    const mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => new ImageData(64, 64)),
    } as unknown as CanvasRenderingContext2D;

    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((
      tagName: string,
      options?: ElementCreationOptions
    ) => {
      if (tagName === 'video') {
        const video = originalCreateElement('video', options) as HTMLVideoElement;
        Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true });
        Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true });
        Object.defineProperty(video, 'readyState', {
          value: HTMLMediaElement.HAVE_CURRENT_DATA,
          configurable: true,
        });
        return video;
      }

      if (tagName === 'canvas') {
        const canvas = originalCreateElement('canvas', options) as HTMLCanvasElement;
        Object.defineProperty(canvas, 'getContext', {
          value: vi.fn(() => mockContext),
          configurable: true,
        });
        return canvas;
      }

      return originalCreateElement(tagName, options);
    }) as typeof document.createElement);

    try {
      const { result } = renderHook(() => usePhotoRecognition(mockStream, { enabled: true }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(50);
      });

      const startMs = Date.now();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });

      expect(result.current.recognizedConcert?.id).toBe(1);
      expect(Date.now() - startMs).toBeLessThanOrEqual(500);
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it('switches recognized concert in continuous mode after stricter confirmation', async () => {
    const originalCreateElement = document.createElement.bind(document);

    const mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => new ImageData(64, 64)),
    } as unknown as CanvasRenderingContext2D;

    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((
      tagName: string,
      options?: ElementCreationOptions
    ) => {
      if (tagName === 'video') {
        const video = originalCreateElement('video', options) as HTMLVideoElement;
        Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true });
        Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true });
        Object.defineProperty(video, 'readyState', {
          value: HTMLMediaElement.HAVE_CURRENT_DATA,
          configurable: true,
        });
        return video;
      }

      if (tagName === 'canvas') {
        const canvas = originalCreateElement('canvas', options) as HTMLCanvasElement;
        Object.defineProperty(canvas, 'getContext', {
          value: vi.fn(() => mockContext),
          configurable: true,
        });
        return canvas;
      }

      return originalCreateElement(tagName, options);
    }) as typeof document.createElement);

    try {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, {
          enabled: true,
          recognitionDelay: 120,
          checkInterval: 50,
          continuousRecognition: true,
          switchRecognitionDelayMultiplier: 1.5,
          switchDistanceThreshold: 8,
          switchMatchMarginThreshold: 4,
        })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(80);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(result.current.recognizedConcert?.id).toBe(1);

      activeFrameHash = 'b6c4d8e2f3a10597';

      await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
      });

      expect(result.current.recognizedConcert?.id).toBe(2);
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it('does not switch in continuous mode when candidate is at distance 8 by default', async () => {
    const originalCreateElement = document.createElement.bind(document);

    const mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => new ImageData(64, 64)),
    } as unknown as CanvasRenderingContext2D;

    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((
      tagName: string,
      options?: ElementCreationOptions
    ) => {
      if (tagName === 'video') {
        const video = originalCreateElement('video', options) as HTMLVideoElement;
        Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true });
        Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true });
        Object.defineProperty(video, 'readyState', {
          value: HTMLMediaElement.HAVE_CURRENT_DATA,
          configurable: true,
        });
        return video;
      }

      if (tagName === 'canvas') {
        const canvas = originalCreateElement('canvas', options) as HTMLCanvasElement;
        Object.defineProperty(canvas, 'getContext', {
          value: vi.fn(() => mockContext),
          configurable: true,
        });
        return canvas;
      }

      return originalCreateElement(tagName, options);
    }) as typeof document.createElement);

    try {
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, {
          enabled: true,
          recognitionDelay: 120,
          checkInterval: 50,
          continuousRecognition: true,
          switchRecognitionDelayMultiplier: 1.5,
        })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(80);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(result.current.recognizedConcert?.id).toBe(1);

      // Two-nibble difference from concert #2 baseline hash => mocked distance 8.
      activeFrameHash = 'b6c4d8e2f3a10500';

      await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
      });

      expect(result.current.recognizedConcert?.id).toBe(1);
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it('rejects ambiguous close matches when margin is too small', async () => {
    const originalCreateElement = document.createElement.bind(document);

    const mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(() => new ImageData(64, 64)),
    } as unknown as CanvasRenderingContext2D;

    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(((
      tagName: string,
      options?: ElementCreationOptions
    ) => {
      if (tagName === 'video') {
        const video = originalCreateElement('video', options) as HTMLVideoElement;
        Object.defineProperty(video, 'videoWidth', { value: 640, configurable: true });
        Object.defineProperty(video, 'videoHeight', { value: 480, configurable: true });
        Object.defineProperty(video, 'readyState', {
          value: HTMLMediaElement.HAVE_CURRENT_DATA,
          configurable: true,
        });
        return video;
      }

      if (tagName === 'canvas') {
        const canvas = originalCreateElement('canvas', options) as HTMLCanvasElement;
        Object.defineProperty(canvas, 'getContext', {
          value: vi.fn(() => mockContext),
          configurable: true,
        });
        return canvas;
      }

      return originalCreateElement(tagName, options);
    }) as typeof document.createElement);

    try {
      const closeConcerts: Concert[] = [
        {
          id: 1,
          band: 'Close Band 1',
          venue: 'Venue A',
          date: '2023-08-15T20:00:00-05:00',
          audioFile: '/audio/one.opus',
          photoHashes: {
            phash: ['aaaaaaaaaaaaaaaa'],
          },
        },
        {
          id: 2,
          band: 'Close Band 2',
          venue: 'Venue B',
          date: '2023-09-20T19:30:00-05:00',
          audioFile: '/audio/two.opus',
          photoHashes: {
            phash: ['aaaaaaaaaaaaaaab'],
          },
        },
      ];

      vi.mocked(dataService.getConcerts).mockResolvedValue(closeConcerts);
      activeFrameHash = 'aaaaaaaaaaaaaaaa';

      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, {
          enabled: true,
          recognitionDelay: 120,
          checkInterval: 50,
          similarityThreshold: 12,
          matchMarginThreshold: 5,
          enableDebugInfo: true,
        })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(80);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(result.current.recognizedConcert).toBeNull();
      expect(result.current.debugInfo?.bestMatch?.concert.id).toBe(1);
      expect(result.current.debugInfo?.secondBestMatch?.concert.id).toBe(2);
      expect((result.current.debugInfo?.bestMatchMargin ?? 99) < 5).toBe(true);
    } finally {
      createElementSpy.mockRestore();
    }
  });
});
