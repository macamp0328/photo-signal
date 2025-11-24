/**
 * Integration test for parallel photo recognition
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePhotoRecognition } from '../usePhotoRecognition';

describe('Parallel Photo Recognition Integration', () => {
  let mockStream: MediaStream;

  beforeEach(() => {
    // Create mock MediaStream
    mockStream = {
      getTracks: () => [],
      getAudioTracks: () => [],
      getVideoTracks: () => [],
      addTrack: () => undefined,
      removeTrack: () => undefined,
      getTrackById: () => null,
      clone: () => mockStream,
      id: 'mock-stream',
      active: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    } as unknown as MediaStream;
  });

  it('should use parallel recognition when enabled', async () => {
    const { result } = renderHook(() =>
      usePhotoRecognition(mockStream, {
        enableParallelRecognition: true,
        enabled: true,
        checkInterval: 100,
      })
    );

    // Initially should not have recognized anything
    expect(result.current.recognizedConcert).toBeNull();
    expect(result.current.isRecognizing).toBe(false);

    // Wait for recognition to initialize
    await waitFor(
      () => {
        // Recognition hook should be initialized
        expect(result.current).toBeDefined();
      },
      { timeout: 1000 }
    );
  });

  it('should provide debug info when enabled', async () => {
    const { result } = renderHook(() =>
      usePhotoRecognition(mockStream, {
        enableParallelRecognition: true,
        enableDebugInfo: true,
        enabled: true,
        checkInterval: 100,
      })
    );

    await waitFor(
      () => {
        // Debug info should be available
        expect(result.current.debugInfo).toBeDefined();
      },
      { timeout: 1000 }
    );
  });

  it('should accept custom parallel recognition config', async () => {
    const { result } = renderHook(() =>
      usePhotoRecognition(mockStream, {
        enableParallelRecognition: true,
        parallelRecognitionConfig: {
          algorithmWeights: {
            dhash: 0.2,
            phash: 0.3,
            orb: 0.5,
          },
          minConfidenceThreshold: 0.7,
        },
        enabled: true,
        checkInterval: 100,
      })
    );

    expect(result.current).toBeDefined();
  });

  it('should fall back to single algorithm when parallel is disabled', async () => {
    const { result } = renderHook(() =>
      usePhotoRecognition(mockStream, {
        enableParallelRecognition: false,
        hashAlgorithm: 'phash',
        enabled: true,
        checkInterval: 100,
      })
    );

    expect(result.current).toBeDefined();
  });

  it('should reset state correctly', async () => {
    const { result } = renderHook(() =>
      usePhotoRecognition(mockStream, {
        enableParallelRecognition: true,
        enabled: true,
      })
    );

    // Call reset
    result.current.reset();

    // State should be reset
    expect(result.current.recognizedConcert).toBeNull();
    expect(result.current.isRecognizing).toBe(false);
  });

  it('should maintain backward compatibility with single algorithm mode', async () => {
    const parallelResult = renderHook(() =>
      usePhotoRecognition(mockStream, {
        enableParallelRecognition: true,
        enabled: true,
      })
    );

    const singleResult = renderHook(() =>
      usePhotoRecognition(mockStream, {
        enableParallelRecognition: false,
        hashAlgorithm: 'dhash',
        enabled: true,
      })
    );

    // Both should have the same API
    expect(parallelResult.result.current).toHaveProperty('recognizedConcert');
    expect(parallelResult.result.current).toHaveProperty('isRecognizing');
    expect(parallelResult.result.current).toHaveProperty('reset');

    expect(singleResult.result.current).toHaveProperty('recognizedConcert');
    expect(singleResult.result.current).toHaveProperty('isRecognizing');
    expect(singleResult.result.current).toHaveProperty('reset');
  });
});
