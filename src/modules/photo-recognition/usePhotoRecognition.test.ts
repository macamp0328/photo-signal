import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataService } from '../../services/data-service';
import type { Concert } from '../../types';
import { usePhotoRecognition } from './usePhotoRecognition';

const mockIsEnabled = vi.fn<(flag: string) => boolean>(() => false);

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
  computePHash: vi.fn(() => 'a5b3c7d9e1f20486'),
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
});
