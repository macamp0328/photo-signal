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
      drawImage: vi.fn(),
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
        bestMatch: { concertId: 1, distance: 4 },
        quality: null,
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

  it('forwards useWarmLumaPhash from config to computePHash', async () => {
    const selfRef = await loadWorkerModule();
    const bitmap = makeBitmap();

    selfRef.onmessage?.({
      data: {
        type: 'init',
        hashEntries: [{ hash: 'aaaaaaaaaaaaaaaa', concertId: 1 }],
        config: { ...baseConfig, useWarmLumaPhash: true },
      },
    } as MessageEvent);

    selfRef.onmessage?.({
      data: {
        type: 'frame',
        bitmap,
        frameId: 20,
      },
    } as MessageEvent);

    // computePHash should have been called with useWarmLuma = true
    expect(mockComputePHash).toHaveBeenCalledWith(expect.anything(), true);
  });

  it('passes useWarmLumaPhash=false to computePHash when flag is absent', async () => {
    const selfRef = await loadWorkerModule();
    const bitmap = makeBitmap();

    selfRef.onmessage?.({
      data: {
        type: 'init',
        hashEntries: [{ hash: 'aaaaaaaaaaaaaaaa', concertId: 1 }],
        config: baseConfig, // no useWarmLumaPhash field
      },
    } as MessageEvent);

    selfRef.onmessage?.({
      data: {
        type: 'frame',
        bitmap,
        frameId: 21,
      },
    } as MessageEvent);

    expect(mockComputePHash).toHaveBeenCalledWith(expect.anything(), false);
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
