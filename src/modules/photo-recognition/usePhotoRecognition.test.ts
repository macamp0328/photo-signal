import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataService } from '../../services/data-service';
import type { Concert, CropRegionKey } from '../../types';
import { RectangleDetectionService } from '../photo-rectangle-detection';
import * as perspectiveUtils from './algorithms/perspective';
import * as qualityUtils from './algorithms/utils';
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
  let originalFetch: typeof global.fetch;

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

    originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as Response);

    vi.mocked(dataService.getConcerts).mockResolvedValue(mockConcerts);
  });

  afterEach(() => {
    global.fetch = originalFetch;
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

  it('uses recognition index hashes when available', async () => {
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
      const concertsWithoutHashes: Concert[] = [
        {
          id: 1,
          band: 'Indexed Band',
          venue: 'Indexed Venue',
          date: '2023-08-15T20:00:00-05:00',
          audioFile: '/audio/indexed.opus',
          photoHashes: {},
        },
      ];

      vi.mocked(dataService.getConcerts).mockResolvedValue(concertsWithoutHashes);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          version: 2,
          entries: [{ concertId: 1, phash: ['a5b3c7d9e1f20486'] }],
        }),
      } as Response);

      activeFrameHash = 'a5b3c7d9e1f20486';

      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, {
          enabled: true,
          recognitionDelay: 120,
          checkInterval: 50,
        })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(result.current.recognizedConcert?.id).toBe(1);
    } finally {
      createElementSpy.mockRestore();
    }
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

  it('stops processing additional matches once a concert is recognized until reset', async () => {
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
        })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(80);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });

      expect(result.current.recognizedConcert?.id).toBe(1);

      // Change frame hash to a close match for concert #2 after initial confirmation.
      activeFrameHash = 'b6c4d8e2f3a10500';

      await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
      });

      expect(result.current.recognizedConcert?.id).toBe(1);

      act(() => {
        result.current.reset();
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
      });

      expect(result.current.recognizedConcert?.id).toBe(2);
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
      expect(
        result.current.debugInfo?.telemetry.collisionStats.ambiguousCount
      ).toBeGreaterThanOrEqual(0);
      expect(result.current.debugInfo?.telemetry.collisionStats.ambiguousMarginHistogram).toEqual(
        expect.objectContaining({
          '0-1': expect.any(Number),
          '2': expect.any(Number),
          '3-4': expect.any(Number),
          '5+': expect.any(Number),
          unknown: expect.any(Number),
        })
      );
      expect(result.current.debugInfo?.telemetry.collisionStats.ambiguousPairCounts).toBeDefined();
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it('treats exact cross-concert distance ties as ambiguous and does not confirm', async () => {
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

    const qualitySpy = vi
      .spyOn(qualityUtils, 'computeAllQualityMetrics')
      .mockImplementation(() => ({
        sharpness: 180,
        isSharp: true,
        glarePercentage: 0,
        hasGlare: false,
        averageBrightness: 120,
        hasPoorLighting: false,
        lightingType: 'ok',
      }));

    try {
      const tieConcerts: Concert[] = [
        {
          id: 1,
          band: 'Tie Band 1',
          venue: 'Venue A',
          date: '2023-08-15T20:00:00-05:00',
          audioFile: '/audio/one.opus',
          photoHashes: {
            phash: ['aaaaaaaaaaaaaaaa'],
          },
        },
        {
          id: 2,
          band: 'Tie Band 2',
          venue: 'Venue B',
          date: '2023-09-20T19:30:00-05:00',
          audioFile: '/audio/two.opus',
          photoHashes: {
            phash: ['aaaaaaaaaaaaaaaa'],
          },
        },
      ];

      vi.mocked(dataService.getConcerts).mockResolvedValue(tieConcerts);
      activeFrameHash = 'aaaaaaaaaaaaaaaa';

      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, {
          enabled: true,
          recognitionDelay: 120,
          checkInterval: 50,
          similarityThreshold: 21,
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
      expect(result.current.activeGuidance).toBe('ambiguous-match');
      expect(result.current.debugInfo?.bestMatch?.concert.id).toBe(1);
      expect(result.current.debugInfo?.secondBestMatch?.concert.id).toBe(2);
      expect(result.current.debugInfo?.bestMatchMargin).toBe(0);
    } finally {
      qualitySpy.mockRestore();
      createElementSpy.mockRestore();
    }
  });

  it('requires consecutive blurry frames before counting blur rejection', async () => {
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

    const qualitySpy = vi.spyOn(qualityUtils, 'computeAllQualityMetrics');

    try {
      const qualityConcerts: Concert[] = [
        {
          id: 1,
          band: 'Quality Band',
          venue: 'Quality Venue',
          date: '2023-08-15T20:00:00-05:00',
          audioFile: '/audio/quality.opus',
          photoHashes: {
            phash: ['aaaaaaaaaaaaaaaa'],
          },
        },
      ];

      vi.mocked(dataService.getConcerts).mockResolvedValue(qualityConcerts);
      activeFrameHash = 'aaaaaaaaaaaabbbb';

      qualitySpy
        .mockImplementationOnce(() => ({
          sharpness: 40,
          isSharp: false,
          glarePercentage: 0,
          hasGlare: false,
          averageBrightness: 120,
          hasPoorLighting: false,
          lightingType: 'ok',
        }))
        .mockImplementation(() => ({
          sharpness: 180,
          isSharp: true,
          glarePercentage: 0,
          hasGlare: false,
          averageBrightness: 120,
          hasPoorLighting: false,
          lightingType: 'ok',
        }));

      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, {
          enabled: true,
          similarityThreshold: 21,
          recognitionDelay: 120,
          checkInterval: 50,
          enableDebugInfo: true,
        })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(80);
      });

      expect(result.current.debugInfo?.telemetry.blurRejections ?? 0).toBe(0);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
      });

      expect(result.current.recognizedConcert?.id).toBe(1);
    } finally {
      qualitySpy.mockRestore();
      createElementSpy.mockRestore();
    }
  });

  it('keeps using last confident rectangle crop for brief confidence dips', async () => {
    const originalCreateElement = document.createElement.bind(document);

    const mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn((_: number, __: number, width: number, height: number) => {
        return new ImageData(width, height);
      }),
      putImageData: vi.fn(),
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

    const perspectiveSpy = vi
      .spyOn(perspectiveUtils, 'getPerspectiveCroppedImageData')
      .mockReturnValue(new ImageData(64, 64));

    const rectangle = {
      topLeft: { x: 0.1, y: 0.1 },
      topRight: { x: 0.9, y: 0.1 },
      bottomRight: { x: 0.9, y: 0.9 },
      bottomLeft: { x: 0.1, y: 0.9 },
      width: 0.8,
      height: 0.8,
      aspectRatio: 1,
    };

    const detectRectangleSpy = vi
      .spyOn(RectangleDetectionService.prototype, 'detectRectangle')
      .mockImplementationOnce(() => ({
        rectangle,
        confidence: 0.9,
        detected: true,
        timestamp: Date.now(),
      }))
      .mockImplementation(() => ({
        rectangle,
        confidence: 0.2,
        detected: true,
        timestamp: Date.now(),
      }));

    try {
      activeFrameHash = 'ffffffffffffffff';

      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, {
          enabled: true,
          enableRectangleDetection: true,
          rectangleConfidenceThreshold: 0.35,
          checkInterval: 50,
        })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(80);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(120);
      });

      expect(result.current.rectangleConfidence).toBe(0.2);
      expect(vi.mocked(mockContext.putImageData).mock.calls.length).toBeGreaterThanOrEqual(2);
    } finally {
      detectRectangleSpy.mockRestore();
      perspectiveSpy.mockRestore();
      createElementSpy.mockRestore();
    }
  });

  it('bypasses quality checks for close matches (distance 12, within quality-gating threshold of 12) and confirms recognition', async () => {
    const originalCreateElement = document.createElement.bind(document);

    const mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(
        (_: number, __: number, width: number, height: number) => new ImageData(width, height)
      ),
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
          band: 'Gate Band',
          venue: 'Gate Venue',
          date: '2023-08-15T20:00:00-05:00',
          audioFile: '/audio/gate.opus',
          photoHashes: {
            phash: ['aaaaaaaaaaaaaaaa'],
          },
        },
      ];

      vi.mocked(dataService.getConcerts).mockResolvedValue(closeConcerts);
      activeFrameHash = 'aaaaaaaaaaaaabbb';

      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, {
          enabled: true,
          recognitionDelay: 120,
          checkInterval: 50,
        })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(80);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(result.current.recognizedConcert?.id).toBe(1);

      const imageDataCalls = vi.mocked(mockContext.getImageData).mock.calls;
      expect(imageDataCalls.some(([, , width, height]) => width === 128 && height === 128)).toBe(
        false
      );
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it('runs quality checks for farther matches (distance 16, above quality-gating threshold of 12), recaptures at 128, and rejects poor quality', async () => {
    const originalCreateElement = document.createElement.bind(document);

    const mockContext = {
      drawImage: vi.fn(),
      getImageData: vi.fn(
        (_: number, __: number, width: number, height: number) => new ImageData(width, height)
      ),
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
          band: 'Gate Band',
          venue: 'Gate Venue',
          date: '2023-08-15T20:00:00-05:00',
          audioFile: '/audio/gate.opus',
          photoHashes: {
            phash: ['aaaaaaaaaaaaaaaa'],
          },
        },
      ];

      vi.mocked(dataService.getConcerts).mockResolvedValue(closeConcerts);
      activeFrameHash = 'aaaaaaaaaaaabbbb';

      // similarityThreshold: 20 keeps the match within threshold (distance 16 ≤ 20) so
      // that the quality-gating path is exercised — the test verifies that frames above
      // QUALITY_GATING_DISTANCE_THRESHOLD (12) still trigger the 128×128 re-capture,
      // and that poor-quality frames are correctly rejected even when within similarity.
      const { result } = renderHook(() =>
        usePhotoRecognition(mockStream, {
          enabled: true,
          similarityThreshold: 20,
          recognitionDelay: 120,
          checkInterval: 50,
        })
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(80);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(350);
      });

      expect(result.current.recognizedConcert).toBeNull();

      const imageDataCalls = vi.mocked(mockContext.getImageData).mock.calls;
      expect(imageDataCalls.some(([, , width, height]) => width === 64 && height === 64)).toBe(
        true
      );
      expect(imageDataCalls.some(([, , width, height]) => width === 128 && height === 128)).toBe(
        true
      );
    } finally {
      createElementSpy.mockRestore();
    }
  });

  // ---------------------------------------------------------------------------
  // Crop-based partial photo recognition
  // ---------------------------------------------------------------------------
  //
  // The mocked hammingDistance counts character mismatches × 4.
  // Frame hash 'ffffffffffffffff' differs from every full-image hash in
  // mockConcerts at every character position → distance 64 (> CROP_FALLBACK_TRIGGER_DISTANCE=18).
  //
  // Concert 1's crop hashes are set to 'f5b3c7d9e1f20486' (1 char diff from
  // 'ffffffffffffffff' → distance 4, well within CROP_SIMILARITY_THRESHOLD=10).
  // Concert 2's crop hashes are set to 'aaaaaaaaaaaaaaaa' (all chars differ →
  // distance 64) so the margin check is satisfied.
  // ---------------------------------------------------------------------------

  describe('crop fallback matching', () => {
    // Frame hash that has distance 64 from all full-image hashes (triggers crop pass)
    // but distance 4 from concert 1's crop hashes (within CROP_SIMILARITY_THRESHOLD=10).
    const CROP_FRAME_HASH = 'f5b3c7d9e1f20486'; // exact match with concert-1 crop hash
    const CONCERT1_CROP_HASH = 'f5b3c7d9e1f20486'; // exact match → distance 0

    const makeConcertsWithCrops = (): Concert[] => {
      const cropKey: CropRegionKey = 'center-80';
      return [
        {
          id: 1,
          band: 'Crop Band 1',
          venue: 'Test Venue',
          date: '2023-08-15T20:00:00-05:00',
          audioFile: '/audio/test1.opus',
          photoHashes: {
            // Full-image hashes: all chars differ from CROP_FRAME_HASH → distance 64
            phash: ['aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb', 'cccccccccccccccc'],
            cropPhashes: {
              [cropKey]: [CONCERT1_CROP_HASH],
            },
          },
        },
        {
          id: 2,
          band: 'Crop Band 2',
          venue: 'Test Venue',
          date: '2023-09-20T19:30:00-05:00',
          audioFile: '/audio/test2.opus',
          photoHashes: {
            phash: ['dddddddddddddddd', 'eeeeeeeeeeeeeeee', 'ffffffffffffffff'],
            cropPhashes: {
              // All chars differ from CROP_FRAME_HASH → distance 64 (no crop match)
              [cropKey]: ['1111111111111111'],
            },
          },
        },
      ];
    };

    const setupDomMocks = () => {
      const originalCreateElement = document.createElement.bind(document);
      const mockContext = {
        drawImage: vi.fn(),
        getImageData: vi.fn(() => new ImageData(64, 64)),
      } as unknown as CanvasRenderingContext2D;

      const spy = vi.spyOn(document, 'createElement').mockImplementation(((
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

      return { spy, mockContext };
    };

    it('confirms via crop hash after recognitionDelay when full-image fails', async () => {
      vi.mocked(dataService.getConcerts).mockResolvedValue(makeConcertsWithCrops());
      activeFrameHash = CROP_FRAME_HASH;

      const { spy } = setupDomMocks();
      try {
        const { result } = renderHook(() =>
          usePhotoRecognition(mockStream, {
            enabled: true,
            checkInterval: 50,
            recognitionDelay: 200,
          })
        );

        await act(async () => {
          await vi.advanceTimersByTimeAsync(80);
        });

        // Not confirmed yet — still within recognitionDelay
        expect(result.current.recognizedConcert).toBeNull();

        await act(async () => {
          await vi.advanceTimersByTimeAsync(400);
        });

        expect(result.current.recognizedConcert?.id).toBe(1);
      } finally {
        spy.mockRestore();
      }
    });

    it('does not confirm via crop when crop distance exceeds CROP_SIMILARITY_THRESHOLD', async () => {
      // Frame hash that differs by 3 chars from concert 1's crop hash → distance 12 > threshold 10
      const FAR_FRAME_HASH = 'f5b3c7d9e1f20000'; // 3 char diff from CONCERT1_CROP_HASH
      vi.mocked(dataService.getConcerts).mockResolvedValue(makeConcertsWithCrops());
      activeFrameHash = FAR_FRAME_HASH;

      const { spy } = setupDomMocks();
      try {
        const { result } = renderHook(() =>
          usePhotoRecognition(mockStream, {
            enabled: true,
            checkInterval: 50,
            recognitionDelay: 200,
          })
        );

        await act(async () => {
          await vi.advanceTimersByTimeAsync(500);
        });

        expect(result.current.recognizedConcert).toBeNull();
      } finally {
        spy.mockRestore();
      }
    });

    it('does not run crop pass when full-image match is already strong', async () => {
      // Use standard mock concerts (full-image hashes match activeFrameHash exactly).
      // Must re-set getConcerts because vi.clearAllMocks() clears it in beforeEach.
      vi.mocked(dataService.getConcerts).mockResolvedValue(mockConcerts);
      activeFrameHash = 'a5b3c7d9e1f20486'; // exact match for mockConcerts[0].phash[0]

      const { spy } = setupDomMocks();
      try {
        const { result } = renderHook(() =>
          usePhotoRecognition(mockStream, {
            enabled: true,
            checkInterval: 50,
            recognitionDelay: 200,
          })
        );

        await act(async () => {
          await vi.advanceTimersByTimeAsync(80);
        });

        await act(async () => {
          await vi.advanceTimersByTimeAsync(400);
        });

        // Should confirm via full-image (distance 0), not crop
        expect(result.current.recognizedConcert?.id).toBe(1);
      } finally {
        spy.mockRestore();
      }
    });
  });
});
