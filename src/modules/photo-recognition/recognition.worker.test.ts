import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockComputePHash = vi.hoisted(() => vi.fn(() => 'aaaaaaaaaaaaaaaa'));
const mockHammingDistance = vi.hoisted(() =>
  vi.fn<(frameHash: string, candidateHash: string) => number>(() => 0)
);
const mockComputeAllQualityMetrics = vi.hoisted(() =>
  vi.fn(() => ({
    sharpness: 120,
    isSharp: true,
    glarePercentage: 5,
    hasGlare: false,
    averageBrightness: 120,
    hasPoorLighting: false,
    lightingType: 'ok' as const,
  }))
);
const drawImageCalls = vi.hoisted(() => [] as unknown[][]);

vi.mock('./algorithms/phash', () => ({
  computePHash: mockComputePHash,
}));

vi.mock('./algorithms/hamming', () => ({
  hammingDistance: mockHammingDistance,
}));

vi.mock('./algorithms/utils', () => ({
  computeAllQualityMetrics: mockComputeAllQualityMetrics,
}));

const baseConfig = {
  similarityThreshold: 14,
  matchMarginThreshold: 4,
  qualityGatingDistanceThreshold: 12,
  quality: {
    sharpnessThreshold: 100,
    glareThreshold: 250,
    glarePercentageThreshold: 20,
    minBrightness: 50,
    maxBrightness: 220,
  },
};

class MockOffscreenCanvas {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext() {
    return {
      drawImage: vi.fn((...args: unknown[]) => {
        drawImageCalls.push(args);
      }),
      clearRect: vi.fn(),
      putImageData: vi.fn(),
      getImageData: vi.fn((x: number, y: number, width: number, height: number) => {
        void x;
        void y;
        return new ImageData(width, height);
      }),
    } as unknown as OffscreenCanvasRenderingContext2D;
  }
}

function makeBitmap() {
  return {
    width: 64,
    height: 64,
    close: vi.fn(),
  } as unknown as ImageBitmap;
}

async function loadWorkerModule() {
  vi.resetModules();
  await import('./recognition.worker');
  return globalThis.self as unknown as {
    onmessage: ((event: MessageEvent) => void) | null;
    postMessage: ReturnType<typeof vi.fn>;
  };
}

describe('recognition.worker', () => {
  beforeEach(() => {
    mockComputePHash.mockReset();
    mockComputePHash.mockReturnValue('aaaaaaaaaaaaaaaa');
    mockHammingDistance.mockReset();
    mockHammingDistance.mockReturnValue(0);
    mockComputeAllQualityMetrics.mockReset();
    mockComputeAllQualityMetrics.mockReturnValue({
      sharpness: 120,
      isSharp: true,
      glarePercentage: 5,
      hasGlare: false,
      averageBrightness: 120,
      hasPoorLighting: false,
      lightingType: 'ok',
    });
    drawImageCalls.length = 0;

    vi.stubGlobal('OffscreenCanvas', MockOffscreenCanvas);
    vi.stubGlobal('self', {
      onmessage: null,
      postMessage: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts ready after init', async () => {
    const selfRef = await loadWorkerModule();

    selfRef.onmessage?.({
      data: {
        type: 'init',
        hashEntries: [{ hash: 'aaaaaaaaaaaaaaaa', concertId: 1 }],
        config: baseConfig,
      },
    } as MessageEvent);

    expect(selfRef.postMessage).toHaveBeenCalledWith({
      type: 'ready',
      hashCount: 1,
    });
  });

  it('returns worker-not-initialized error for frame before init', async () => {
    const selfRef = await loadWorkerModule();
    const bitmap = makeBitmap();

    selfRef.onmessage?.({
      data: {
        type: 'frame',
        bitmap,
        frameId: 7,
      },
    } as MessageEvent);

    expect(selfRef.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        frameId: 7,
      })
    );
  });

  it('processes frame and skips quality when close confident match', async () => {
    const selfRef = await loadWorkerModule();
    const bitmap = makeBitmap();

    mockHammingDistance.mockImplementation((_: string, candidateHash: string) =>
      candidateHash === 'aaaaaaaaaaaaaaaa' ? 4 : 20
    );

    selfRef.onmessage?.({
      data: {
        type: 'init',
        hashEntries: [
          { hash: 'aaaaaaaaaaaaaaaa', concertId: 1 },
          { hash: 'bbbbbbbbbbbbbbbb', concertId: 2 },
        ],
        config: baseConfig,
      },
    } as MessageEvent);

    selfRef.onmessage?.({
      data: {
        type: 'frame',
        bitmap,
        frameId: 9,
      },
    } as MessageEvent);

    expect(mockComputeAllQualityMetrics).not.toHaveBeenCalled();
    expect(bitmap.close).toHaveBeenCalled();
    expect(selfRef.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'result',
        frameId: 9,
        cropVariant: 'full',
        bestMatch: { concertId: 1, distance: 4 },
        quality: null,
      })
    );
  });

  it('uses a clear bottom-trim fallback match when demo crop fallback is enabled', async () => {
    const selfRef = await loadWorkerModule();
    const bitmap = makeBitmap();

    mockComputePHash
      .mockReturnValueOnce('full-noisy')
      .mockReturnValueOnce('bottom-clear')
      .mockReturnValueOnce('center-noisy');
    mockHammingDistance.mockImplementation((frameHash: string, candidateHash: string) => {
      if (frameHash === 'bottom-clear' && candidateHash === 'aaaaaaaaaaaaaaaa') {
        return 5;
      }
      if (frameHash === 'bottom-clear' && candidateHash === 'bbbbbbbbbbbbbbbb') {
        return 24;
      }
      return candidateHash === 'aaaaaaaaaaaaaaaa' ? 19 : 23;
    });

    selfRef.onmessage?.({
      data: {
        type: 'init',
        hashEntries: [
          { hash: 'aaaaaaaaaaaaaaaa', concertId: 1 },
          { hash: 'bbbbbbbbbbbbbbbb', concertId: 2 },
        ],
        config: { ...baseConfig, demoCropFallbackEnabled: true },
      },
    } as MessageEvent);

    selfRef.onmessage?.({
      data: {
        type: 'frame',
        bitmap,
        frameId: 15,
      },
    } as MessageEvent);

    expect(mockComputePHash).toHaveBeenCalledTimes(2);
    expect(selfRef.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'result',
        frameId: 15,
        hash: 'bottom-clear',
        cropVariant: 'bottom-trim',
        bestMatch: { concertId: 1, distance: 5 },
      })
    );
  });

  it('prefers the full crop when it already produces a valid match', async () => {
    const selfRef = await loadWorkerModule();
    const bitmap = makeBitmap();

    mockComputePHash
      .mockReturnValueOnce('full-clear')
      .mockReturnValueOnce('bottom-clear')
      .mockReturnValueOnce('center-clear');
    mockHammingDistance.mockImplementation((frameHash: string, candidateHash: string) => {
      if (candidateHash !== 'aaaaaaaaaaaaaaaa') {
        return 30;
      }
      return frameHash === 'full-clear' ? 8 : 4;
    });

    selfRef.onmessage?.({
      data: {
        type: 'init',
        hashEntries: [
          { hash: 'aaaaaaaaaaaaaaaa', concertId: 1 },
          { hash: 'bbbbbbbbbbbbbbbb', concertId: 2 },
        ],
        config: { ...baseConfig, demoCropFallbackEnabled: true },
      },
    } as MessageEvent);

    selfRef.onmessage?.({
      data: {
        type: 'frame',
        bitmap,
        frameId: 16,
      },
    } as MessageEvent);

    expect(mockComputePHash).toHaveBeenCalledTimes(1);
    expect(selfRef.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'result',
        frameId: 16,
        hash: 'full-clear',
        cropVariant: 'full',
        bestMatch: { concertId: 1, distance: 8 },
      })
    );
  });

  it('uses center-trim when top and bottom chrome obscure the full crop', async () => {
    const selfRef = await loadWorkerModule();
    const bitmap = makeBitmap();

    mockComputePHash
      .mockReturnValueOnce('full-noisy')
      .mockReturnValueOnce('bottom-still-noisy')
      .mockReturnValueOnce('center-clear');
    mockHammingDistance.mockImplementation((frameHash: string, candidateHash: string) => {
      if (candidateHash === 'bbbbbbbbbbbbbbbb') {
        return 30;
      }

      if (frameHash === 'center-clear') {
        return 6;
      }

      return frameHash === 'bottom-still-noisy' ? 16 : 18;
    });

    selfRef.onmessage?.({
      data: {
        type: 'init',
        hashEntries: [
          { hash: 'aaaaaaaaaaaaaaaa', concertId: 1 },
          { hash: 'bbbbbbbbbbbbbbbb', concertId: 2 },
        ],
        config: { ...baseConfig, demoCropFallbackEnabled: true },
      },
    } as MessageEvent);

    selfRef.onmessage?.({
      data: {
        type: 'frame',
        bitmap,
        frameId: 17,
      },
    } as MessageEvent);

    expect(selfRef.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'result',
        frameId: 17,
        hash: 'center-clear',
        cropVariant: 'center-trim',
        bestMatch: { concertId: 1, distance: 6 },
      })
    );
  });

  it('does not enable crop fallback when demo crop fallback is disabled', async () => {
    const selfRef = await loadWorkerModule();
    const bitmap = makeBitmap();

    mockComputePHash.mockReturnValueOnce('full-only');
    mockHammingDistance.mockImplementation((_: string, candidateHash: string) =>
      candidateHash === 'aaaaaaaaaaaaaaaa' ? 18 : 30
    );

    selfRef.onmessage?.({
      data: {
        type: 'init',
        hashEntries: [
          { hash: 'aaaaaaaaaaaaaaaa', concertId: 1 },
          { hash: 'bbbbbbbbbbbbbbbb', concertId: 2 },
        ],
        config: { ...baseConfig, demoCropFallbackEnabled: false },
      },
    } as MessageEvent);

    selfRef.onmessage?.({
      data: {
        type: 'frame',
        bitmap,
        frameId: 18,
      },
    } as MessageEvent);

    expect(mockComputePHash).toHaveBeenCalledTimes(1);
    expect(selfRef.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'result',
        frameId: 18,
        hash: 'full-only',
        cropVariant: 'full',
        bestMatch: { concertId: 1, distance: 18 },
      })
    );
  });

  it('runs quality for ambiguous fallback matches instead of treating them as confident', async () => {
    const selfRef = await loadWorkerModule();
    const bitmap = makeBitmap();

    mockComputePHash
      .mockReturnValueOnce('full-noisy')
      .mockReturnValueOnce('bottom-ambiguous')
      .mockReturnValueOnce('center-noisy');
    mockHammingDistance.mockImplementation((frameHash: string, candidateHash: string) => {
      if (frameHash === 'bottom-ambiguous') {
        return candidateHash === 'aaaaaaaaaaaaaaaa' ? 5 : 7;
      }
      return candidateHash === 'aaaaaaaaaaaaaaaa' ? 20 : 22;
    });

    selfRef.onmessage?.({
      data: {
        type: 'init',
        hashEntries: [
          { hash: 'aaaaaaaaaaaaaaaa', concertId: 1 },
          { hash: 'bbbbbbbbbbbbbbbb', concertId: 2 },
        ],
        config: { ...baseConfig, demoCropFallbackEnabled: true },
      },
    } as MessageEvent);

    selfRef.onmessage?.({
      data: {
        type: 'frame',
        bitmap,
        frameId: 19,
      },
    } as MessageEvent);

    expect(mockComputeAllQualityMetrics).toHaveBeenCalledTimes(1);
    expect(drawImageCalls[drawImageCalls.length - 1]).toEqual([
      bitmap,
      0,
      0,
      64,
      50,
      0,
      0,
      128,
      128,
    ]);
    expect(selfRef.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'result',
        frameId: 19,
        cropVariant: 'bottom-trim',
        bestMatch: { concertId: 1, distance: 5 },
        secondBestMatch: { concertId: 2, distance: 7 },
        quality: expect.objectContaining({ isSharp: true }),
      })
    );
  });

  it('processes frame and computes quality for farther matches', async () => {
    const selfRef = await loadWorkerModule();
    const bitmap = makeBitmap();

    mockHammingDistance.mockImplementation((_: string, candidateHash: string) =>
      candidateHash === 'aaaaaaaaaaaaaaaa' ? 13 : 25
    );

    selfRef.onmessage?.({
      data: {
        type: 'init',
        hashEntries: [
          { hash: 'aaaaaaaaaaaaaaaa', concertId: 1 },
          { hash: 'bbbbbbbbbbbbbbbb', concertId: 2 },
        ],
        config: {
          ...baseConfig,
          similarityThreshold: 20,
        },
      },
    } as MessageEvent);

    selfRef.onmessage?.({
      data: {
        type: 'frame',
        bitmap,
        frameId: 10,
      },
    } as MessageEvent);

    expect(mockComputeAllQualityMetrics).toHaveBeenCalled();
    expect(selfRef.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'result',
        frameId: 10,
        quality: expect.objectContaining({
          isSharp: true,
          hasGlare: false,
          hasPoorLighting: false,
        }),
      })
    );
  });

  it('accepts perspective metadata and still returns a match result', async () => {
    const selfRef = await loadWorkerModule();
    const bitmap = makeBitmap();

    mockHammingDistance.mockImplementation((_: string, candidateHash: string) =>
      candidateHash === 'aaaaaaaaaaaaaaaa' ? 6 : 24
    );

    selfRef.onmessage?.({
      data: {
        type: 'init',
        hashEntries: [
          { hash: 'aaaaaaaaaaaaaaaa', concertId: 1 },
          { hash: 'bbbbbbbbbbbbbbbb', concertId: 2 },
        ],
        config: baseConfig,
      },
    } as MessageEvent);

    selfRef.onmessage?.({
      data: {
        type: 'frame',
        bitmap,
        frameId: 12,
        perspective: {
          corners: [
            { x: 4, y: 4 },
            { x: 60, y: 8 },
            { x: 58, y: 58 },
            { x: 6, y: 56 },
          ],
          targetAspect: '3:2',
        },
      },
    } as MessageEvent);

    expect(bitmap.close).toHaveBeenCalled();
    expect(selfRef.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'result',
        frameId: 12,
        bestMatch: { concertId: 1, distance: 6 },
      })
    );
  });

  it('measures quality on the rectified full crop when perspective metadata is active', async () => {
    const selfRef = await loadWorkerModule();
    const bitmap = makeBitmap();

    mockHammingDistance.mockImplementation((_: string, candidateHash: string) =>
      candidateHash === 'aaaaaaaaaaaaaaaa' ? 13 : 25
    );

    selfRef.onmessage?.({
      data: {
        type: 'init',
        hashEntries: [
          { hash: 'aaaaaaaaaaaaaaaa', concertId: 1 },
          { hash: 'bbbbbbbbbbbbbbbb', concertId: 2 },
        ],
        config: baseConfig,
      },
    } as MessageEvent);

    selfRef.onmessage?.({
      data: {
        type: 'frame',
        bitmap,
        frameId: 20,
        perspective: {
          corners: [
            { x: 4, y: 4 },
            { x: 60, y: 8 },
            { x: 58, y: 58 },
            { x: 6, y: 56 },
          ],
          targetAspect: '3:2',
        },
      },
    } as MessageEvent);

    expect(mockComputeAllQualityMetrics).toHaveBeenCalledTimes(1);
    expect(drawImageCalls[drawImageCalls.length - 1]?.[0]).not.toBe(bitmap);
    expect(drawImageCalls[drawImageCalls.length - 1]).toEqual([
      expect.any(MockOffscreenCanvas),
      0,
      0,
      96,
      64,
      0,
      0,
      128,
      128,
    ]);
    expect(selfRef.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'result',
        frameId: 20,
        cropVariant: 'full',
        quality: expect.objectContaining({ isSharp: true }),
      })
    );
  });

  it('direct-resizes rectified crop variants for hash matching', async () => {
    const selfRef = await loadWorkerModule();
    const bitmap = makeBitmap();

    mockComputePHash.mockReturnValueOnce('full-noisy').mockReturnValueOnce('bottom-clear');
    mockHammingDistance.mockImplementation((frameHash: string, candidateHash: string) => {
      if (frameHash === 'bottom-clear') {
        return candidateHash === 'aaaaaaaaaaaaaaaa' ? 6 : 24;
      }
      return candidateHash === 'aaaaaaaaaaaaaaaa' ? 20 : 28;
    });

    selfRef.onmessage?.({
      data: {
        type: 'init',
        hashEntries: [
          { hash: 'aaaaaaaaaaaaaaaa', concertId: 1 },
          { hash: 'bbbbbbbbbbbbbbbb', concertId: 2 },
        ],
        config: { ...baseConfig, demoCropFallbackEnabled: true },
      },
    } as MessageEvent);

    selfRef.onmessage?.({
      data: {
        type: 'frame',
        bitmap,
        frameId: 21,
        perspective: {
          corners: [
            { x: 4, y: 4 },
            { x: 60, y: 8 },
            { x: 58, y: 58 },
            { x: 6, y: 56 },
          ],
          targetAspect: '3:2',
        },
      },
    } as MessageEvent);

    expect(drawImageCalls).toEqual(
      expect.arrayContaining([[expect.any(MockOffscreenCanvas), 0, 0, 96, 50, 0, 0, 32, 32]])
    );
    expect(selfRef.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'result',
        frameId: 21,
        cropVariant: 'bottom-trim',
        bestMatch: { concertId: 1, distance: 6 },
      })
    );
  });

  it('falls back gracefully when perspective metadata is out of source bounds', async () => {
    const selfRef = await loadWorkerModule();
    const bitmap = makeBitmap();

    mockHammingDistance.mockImplementation((_: string, candidateHash: string) =>
      candidateHash === 'aaaaaaaaaaaaaaaa' ? 8 : 21
    );

    selfRef.onmessage?.({
      data: {
        type: 'init',
        hashEntries: [
          { hash: 'aaaaaaaaaaaaaaaa', concertId: 1 },
          { hash: 'bbbbbbbbbbbbbbbb', concertId: 2 },
        ],
        config: baseConfig,
      },
    } as MessageEvent);

    selfRef.onmessage?.({
      data: {
        type: 'frame',
        bitmap,
        frameId: 13,
        perspective: {
          corners: [
            { x: -5, y: 4 },
            { x: 60, y: 8 },
            { x: 58, y: 58 },
            { x: 6, y: 56 },
          ],
          targetAspect: '3:2',
        },
      },
    } as MessageEvent);

    expect(bitmap.close).toHaveBeenCalled();
    expect(selfRef.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'result',
        frameId: 13,
        bestMatch: { concertId: 1, distance: 8 },
      })
    );
  });

  it('handles portrait-aspect perspective rectification', async () => {
    const selfRef = await loadWorkerModule();
    const bitmap = makeBitmap();

    mockHammingDistance.mockImplementation((_: string, candidateHash: string) =>
      candidateHash === 'aaaaaaaaaaaaaaaa' ? 7 : 22
    );

    selfRef.onmessage?.({
      data: {
        type: 'init',
        hashEntries: [
          { hash: 'aaaaaaaaaaaaaaaa', concertId: 1 },
          { hash: 'bbbbbbbbbbbbbbbb', concertId: 2 },
        ],
        config: baseConfig,
      },
    } as MessageEvent);

    selfRef.onmessage?.({
      data: {
        type: 'frame',
        bitmap,
        frameId: 14,
        perspective: {
          corners: [
            { x: 10, y: 4 },
            { x: 36, y: 6 },
            { x: 34, y: 60 },
            { x: 8, y: 58 },
          ],
          targetAspect: '2:3',
        },
      },
    } as MessageEvent);

    expect(bitmap.close).toHaveBeenCalled();
    expect(selfRef.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'result',
        frameId: 14,
        bestMatch: { concertId: 1, distance: 7 },
      })
    );
  });

  it('posts error when frame processing throws', async () => {
    const selfRef = await loadWorkerModule();
    const bitmap = makeBitmap();

    mockComputePHash.mockImplementationOnce(() => {
      throw new Error('pHash failed');
    });

    selfRef.onmessage?.({
      data: {
        type: 'init',
        hashEntries: [{ hash: 'aaaaaaaaaaaaaaaa', concertId: 1 }],
        config: baseConfig,
      },
    } as MessageEvent);

    selfRef.onmessage?.({
      data: {
        type: 'frame',
        bitmap,
        frameId: 11,
      },
    } as MessageEvent);

    expect(selfRef.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        message: 'pHash failed',
        frameId: 11,
      })
    );
  });
});
