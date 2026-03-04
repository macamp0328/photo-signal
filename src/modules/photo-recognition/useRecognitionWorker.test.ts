/**
 * Tests for useRecognitionWorker hook.
 *
 * Covers:
 *   - Worker not spawned when disabled or APIs unsupported
 *   - Init message sent when hashEntries are non-empty
 *   - Config-update (not init) sent when only config changes
 *   - isReady transitions on ready/error messages
 *   - onResult invoked when worker returns a result
 *   - processFrame accept/reject (busy, not ready)
 *   - isBusy transitions
 *   - Worker terminated on unmount
 *   - isSupported reflects feature detection
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecognitionWorker } from './useRecognitionWorker';
import type {
  WorkerFrameResult,
  WorkerHashEntry,
  WorkerRecognitionConfig,
} from './worker-protocol';

// ---------------------------------------------------------------------------
// Mock Worker
// ---------------------------------------------------------------------------

/**
 * Lightweight stand-in for Web Worker. Captures the onmessage/onerror
 * handlers set by the hook and exposes helpers to drive messages inward.
 */
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  /** Drive a message from the worker back to the hook. */
  simulateMessage(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }

  /** Drive an unhandled worker error. */
  simulateError(message: string): void {
    this.onerror?.({ message } as unknown as ErrorEvent);
  }
}

// Track the most-recently constructed MockWorker so tests can drive it.
let lastWorker: MockWorker | null = null;

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const sampleHashEntries: WorkerHashEntry[] = [
  { hash: 'aaaaaaaaaaaaaaaa', concertId: 1 },
  { hash: 'bbbbbbbbbbbbbbbb', concertId: 2 },
];

const baseConfig: WorkerRecognitionConfig = {
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

function makeBitmap(): ImageBitmap {
  return { close: vi.fn() } as unknown as ImageBitmap;
}

function makeResult(overrides: Partial<WorkerFrameResult> = {}): WorkerFrameResult {
  return {
    type: 'result',
    frameId: 1,
    hash: 'aaaaaaaaaaaaaaaa',
    bestMatch: null,
    secondBestMatch: null,
    quality: null,
    processingMs: 0.5,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Supported-environment suite
// All tests here run with Worker + OffscreenCanvas + createImageBitmap +
// requestVideoFrame stubbed so isWorkerPipelineSupported() returns true.
// ---------------------------------------------------------------------------

describe('useRecognitionWorker — supported environment', () => {
  beforeEach(() => {
    lastWorker = null;

    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          lastWorker = new MockWorker();
          return lastWorker as unknown as Worker;
        }
      }
    );
    vi.stubGlobal('OffscreenCanvas', class {});
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(() => Promise.resolve({} as ImageBitmap))
    );

    // requestVideoFrame must be on the prototype for feature detection.
    if (!('requestVideoFrame' in HTMLVideoElement.prototype)) {
      Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrame', {
        value: vi.fn(),
        configurable: true,
        writable: true,
      });
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // -------------------------------------------------------------------------
  // Worker lifecycle
  // -------------------------------------------------------------------------

  it('spawns a worker when enabled=true', () => {
    renderHook(() =>
      useRecognitionWorker({
        hashEntries: sampleHashEntries,
        config: baseConfig,
        onResult: vi.fn(),
        enabled: true,
      })
    );
    expect(lastWorker).not.toBeNull();
  });

  it('does not spawn a worker when enabled=false', () => {
    renderHook(() =>
      useRecognitionWorker({
        hashEntries: sampleHashEntries,
        config: baseConfig,
        onResult: vi.fn(),
        enabled: false,
      })
    );
    expect(lastWorker).toBeNull();
  });

  it('terminates the worker on unmount', () => {
    const { unmount } = renderHook(() =>
      useRecognitionWorker({
        hashEntries: sampleHashEntries,
        config: baseConfig,
        onResult: vi.fn(),
        enabled: true,
      })
    );

    const workerBeforeUnmount = lastWorker;
    unmount();
    expect(workerBeforeUnmount?.terminate).toHaveBeenCalled();
  });

  it('terminates old worker and spawns new one when enabled toggles off then on', async () => {
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useRecognitionWorker({
          hashEntries: sampleHashEntries,
          config: baseConfig,
          onResult: vi.fn(),
          enabled,
        }),
      { initialProps: { enabled: true } }
    );

    const firstWorker = lastWorker;
    expect(firstWorker).not.toBeNull();

    await act(async () => {
      rerender({ enabled: false });
    });

    expect(firstWorker?.terminate).toHaveBeenCalled();

    await act(async () => {
      rerender({ enabled: true });
    });

    expect(lastWorker).not.toBeNull();
    expect(lastWorker).not.toBe(firstWorker);
  });

  // -------------------------------------------------------------------------
  // Init messaging
  // -------------------------------------------------------------------------

  it('sends init message when hashEntries are non-empty', async () => {
    renderHook(() =>
      useRecognitionWorker({
        hashEntries: sampleHashEntries,
        config: baseConfig,
        onResult: vi.fn(),
        enabled: true,
      })
    );

    await act(async () => {});

    expect(lastWorker?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'init',
        hashEntries: sampleHashEntries,
        config: baseConfig,
      })
    );
  });

  it('does not send init when hashEntries is empty', async () => {
    renderHook(() =>
      useRecognitionWorker({
        hashEntries: [],
        config: baseConfig,
        onResult: vi.fn(),
        enabled: true,
      })
    );

    await act(async () => {});

    const initCalls = lastWorker?.postMessage.mock.calls.filter((c) => c[0]?.type === 'init') ?? [];
    expect(initCalls).toHaveLength(0);
  });

  it('re-sends init (and resets isReady) when hashEntries change', async () => {
    const { result, rerender } = renderHook(
      ({ entries }: { entries: WorkerHashEntry[] }) =>
        useRecognitionWorker({
          hashEntries: entries,
          config: baseConfig,
          onResult: vi.fn(),
          enabled: true,
        }),
      { initialProps: { entries: sampleHashEntries } }
    );

    await act(async () => {
      lastWorker?.simulateMessage({ type: 'ready', hashCount: 2 });
    });
    expect(result.current.isReady).toBe(true);

    const newEntries: WorkerHashEntry[] = [{ hash: 'cccccccccccccccc', concertId: 3 }];
    await act(async () => {
      rerender({ entries: newEntries });
    });

    expect(result.current.isReady).toBe(false);
    const initCalls = lastWorker?.postMessage.mock.calls.filter((c) => c[0]?.type === 'init') ?? [];
    expect(initCalls).toHaveLength(2);
    expect(initCalls[1]?.[0]).toMatchObject({ type: 'init', hashEntries: newEntries });
  });

  // -------------------------------------------------------------------------
  // Config-update messaging
  // -------------------------------------------------------------------------

  it('sends config-update (not init) when only config changes', async () => {
    const { rerender } = renderHook(
      ({ config }: { config: WorkerRecognitionConfig }) =>
        useRecognitionWorker({
          hashEntries: sampleHashEntries,
          config,
          onResult: vi.fn(),
          enabled: true,
        }),
      { initialProps: { config: baseConfig } }
    );

    await act(async () => {
      lastWorker?.simulateMessage({ type: 'ready', hashCount: 2 });
    });

    const initsBefore =
      lastWorker?.postMessage.mock.calls.filter((c) => c[0]?.type === 'init').length ?? 0;

    const updatedConfig: WorkerRecognitionConfig = { ...baseConfig, similarityThreshold: 16 };
    await act(async () => {
      rerender({ config: updatedConfig });
    });

    const initsAfter =
      lastWorker?.postMessage.mock.calls.filter((c) => c[0]?.type === 'init').length ?? 0;
    const configUpdates =
      lastWorker?.postMessage.mock.calls.filter((c) => c[0]?.type === 'config-update') ?? [];

    expect(initsAfter).toBe(initsBefore); // no extra init
    expect(configUpdates).toHaveLength(1);
    expect(configUpdates[0]?.[0]).toEqual({ type: 'config-update', config: updatedConfig });
  });

  it('does not send config-update when config reference is unchanged', async () => {
    const { rerender } = renderHook(
      ({ config }: { config: WorkerRecognitionConfig }) =>
        useRecognitionWorker({
          hashEntries: sampleHashEntries,
          config,
          onResult: vi.fn(),
          enabled: true,
        }),
      { initialProps: { config: baseConfig } }
    );

    await act(async () => {
      lastWorker?.simulateMessage({ type: 'ready', hashCount: 2 });
    });

    await act(async () => {
      rerender({ config: baseConfig }); // same reference
    });

    const configUpdates =
      lastWorker?.postMessage.mock.calls.filter((c) => c[0]?.type === 'config-update') ?? [];
    expect(configUpdates).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // isReady transitions
  // -------------------------------------------------------------------------

  it('starts with isReady=false', () => {
    const { result } = renderHook(() =>
      useRecognitionWorker({
        hashEntries: sampleHashEntries,
        config: baseConfig,
        onResult: vi.fn(),
        enabled: true,
      })
    );
    expect(result.current.isReady).toBe(false);
  });

  it('becomes isReady=true after worker sends ready message', async () => {
    const { result } = renderHook(() =>
      useRecognitionWorker({
        hashEntries: sampleHashEntries,
        config: baseConfig,
        onResult: vi.fn(),
        enabled: true,
      })
    );

    await act(async () => {
      lastWorker?.simulateMessage({ type: 'ready', hashCount: 2 });
    });

    expect(result.current.isReady).toBe(true);
  });

  it('clears isReady and isBusy when worker fires an unhandled error', async () => {
    const { result } = renderHook(() =>
      useRecognitionWorker({
        hashEntries: sampleHashEntries,
        config: baseConfig,
        onResult: vi.fn(),
        enabled: true,
      })
    );

    await act(async () => {
      lastWorker?.simulateMessage({ type: 'ready', hashCount: 2 });
    });
    expect(result.current.isReady).toBe(true);

    await act(async () => {
      lastWorker?.simulateError('Worker crashed');
    });

    // An unhandled crash leaves the worker in an undefined state — both
    // isReady and isBusy must be cleared to prevent processFrame from sending
    // further frames to a broken worker.
    expect(result.current.isReady).toBe(false);
    expect(result.current.isBusy).toBe(false);
  });

  // -------------------------------------------------------------------------
  // onResult callback
  // -------------------------------------------------------------------------

  it('calls onResult when worker sends a result message', async () => {
    const onResult = vi.fn();
    renderHook(() =>
      useRecognitionWorker({
        hashEntries: sampleHashEntries,
        config: baseConfig,
        onResult,
        enabled: true,
      })
    );

    const workerResult = makeResult({ bestMatch: { concertId: 1, distance: 5 } });
    await act(async () => {
      lastWorker?.simulateMessage(workerResult);
    });

    expect(onResult).toHaveBeenCalledWith(workerResult);
  });

  it('uses the latest onResult callback without re-spawning the worker', async () => {
    const onResult1 = vi.fn();
    const onResult2 = vi.fn();

    const { rerender } = renderHook(
      ({ onResult }: { onResult: (r: WorkerFrameResult) => void }) =>
        useRecognitionWorker({
          hashEntries: sampleHashEntries,
          config: baseConfig,
          onResult,
          enabled: true,
        }),
      { initialProps: { onResult: onResult1 } }
    );

    await act(async () => {
      rerender({ onResult: onResult2 });
    });

    const workerRef = lastWorker; // still the same worker
    await act(async () => {
      workerRef?.simulateMessage(makeResult());
    });

    expect(onResult1).not.toHaveBeenCalled();
    expect(onResult2).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // processFrame
  // -------------------------------------------------------------------------

  it('processFrame returns false and closes bitmap when not ready', () => {
    const { result } = renderHook(() =>
      useRecognitionWorker({
        hashEntries: sampleHashEntries,
        config: baseConfig,
        onResult: vi.fn(),
        enabled: true,
      })
    );

    const bitmap = makeBitmap();
    expect(result.current.processFrame(bitmap, 1)).toBe(false);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('processFrame returns true and posts frame message when ready', async () => {
    const { result } = renderHook(() =>
      useRecognitionWorker({
        hashEntries: sampleHashEntries,
        config: baseConfig,
        onResult: vi.fn(),
        enabled: true,
      })
    );

    await act(async () => {
      lastWorker?.simulateMessage({ type: 'ready', hashCount: 2 });
    });

    const bitmap = makeBitmap();
    let sent = false;
    act(() => {
      sent = result.current.processFrame(bitmap, 42);
    });

    expect(sent).toBe(true);
    expect(lastWorker?.postMessage).toHaveBeenCalledWith({ type: 'frame', bitmap, frameId: 42 }, [
      bitmap,
    ]);
  });

  it('processFrame returns false and closes bitmap when worker is busy', async () => {
    const { result } = renderHook(() =>
      useRecognitionWorker({
        hashEntries: sampleHashEntries,
        config: baseConfig,
        onResult: vi.fn(),
        enabled: true,
      })
    );

    await act(async () => {
      lastWorker?.simulateMessage({ type: 'ready', hashCount: 2 });
    });

    // First frame — accepted; worker is now busy
    act(() => {
      result.current.processFrame(makeBitmap(), 1);
    });

    const bitmap2 = makeBitmap();
    let sent = false;
    act(() => {
      sent = result.current.processFrame(bitmap2, 2);
    });

    expect(sent).toBe(false);
    expect(bitmap2.close).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // isBusy transitions
  // -------------------------------------------------------------------------

  it('isBusy becomes true after processFrame and false after result', async () => {
    const { result } = renderHook(() =>
      useRecognitionWorker({
        hashEntries: sampleHashEntries,
        config: baseConfig,
        onResult: vi.fn(),
        enabled: true,
      })
    );

    await act(async () => {
      lastWorker?.simulateMessage({ type: 'ready', hashCount: 2 });
    });

    expect(result.current.isBusy).toBe(false);

    act(() => {
      result.current.processFrame(makeBitmap(), 1);
    });

    expect(result.current.isBusy).toBe(true);

    await act(async () => {
      lastWorker?.simulateMessage(makeResult());
    });

    expect(result.current.isBusy).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unsupported-environment suite
// No Worker/OffscreenCanvas/createImageBitmap stubs — isWorkerPipelineSupported → false
// ---------------------------------------------------------------------------

describe('useRecognitionWorker — unsupported environment', () => {
  beforeEach(() => {
    lastWorker = null;
  });

  it('does not spawn a worker when required APIs are absent', () => {
    renderHook(() =>
      useRecognitionWorker({
        hashEntries: sampleHashEntries,
        config: baseConfig,
        onResult: vi.fn(),
        enabled: true,
      })
    );
    expect(lastWorker).toBeNull();
  });

  it('isSupported is false', () => {
    const { result } = renderHook(() =>
      useRecognitionWorker({
        hashEntries: sampleHashEntries,
        config: baseConfig,
        onResult: vi.fn(),
        enabled: true,
      })
    );
    expect(result.current.isSupported).toBe(false);
  });

  it('isReady is always false', () => {
    const { result } = renderHook(() =>
      useRecognitionWorker({
        hashEntries: sampleHashEntries,
        config: baseConfig,
        onResult: vi.fn(),
        enabled: true,
      })
    );
    expect(result.current.isReady).toBe(false);
  });

  it('processFrame always returns false and closes bitmap', () => {
    const { result } = renderHook(() =>
      useRecognitionWorker({
        hashEntries: sampleHashEntries,
        config: baseConfig,
        onResult: vi.fn(),
        enabled: true,
      })
    );
    const bitmap = makeBitmap();
    expect(result.current.processFrame(bitmap, 1)).toBe(false);
    expect(bitmap.close).toHaveBeenCalled();
  });
});
