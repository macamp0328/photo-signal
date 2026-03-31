/**
 * useRecognitionWorker — React hook managing the recognition Web Worker lifecycle.
 *
 * Responsibilities:
 *   - Spawn/terminate the worker on mount/unmount
 *   - Send the hash database + config at init time
 *   - Expose `processFrame()` for the main-thread capture loop
 *   - Surface the latest worker result via a callback
 *   - Detect feature support and expose `isSupported` so the caller can
 *     fall back to the inline (main-thread) pipeline when needed
 *
 * The hook deliberately does NOT own frame scheduling (requestVideoFrame).
 * That responsibility stays in usePhotoRecognition so it can coordinate with
 * rectangle detection and other main-thread concerns.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Worker restart policy
// ---------------------------------------------------------------------------

/**
 * Maximum number of automatic restart attempts after a worker crash.
 * Each attempt uses the corresponding delay from WORKER_RESTART_DELAYS_MS.
 */
const MAX_WORKER_RESTARTS = 3;

/**
 * Exponential-backoff delays (ms) before each restart attempt.
 * Index 0 → first restart, index 1 → second, index 2 → third.
 */
const WORKER_RESTART_DELAYS_MS: readonly number[] = [50, 150, 300];
import type {
  WorkerPerspectiveFrameData,
  WorkerFrameResult,
  WorkerHashEntry,
  WorkerRecognitionConfig,
  WorkerToMainMessage,
} from './worker-protocol';

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

/**
 * Returns true when the browser supports all APIs required by the worker
 * pipeline: Web Worker, OffscreenCanvas, createImageBitmap,
 * and HTMLVideoElement.requestVideoFrame.
 */
export function isWorkerPipelineSupported(): boolean {
  try {
    return (
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      typeof createImageBitmap === 'function' &&
      typeof HTMLVideoElement !== 'undefined' &&
      'requestVideoFrame' in HTMLVideoElement.prototype
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseRecognitionWorkerOptions {
  /** Hash entries to send to the worker. Changes trigger a re-init. */
  hashEntries: WorkerHashEntry[];
  /** Recognition + quality config. Changes trigger a config-update message. */
  config: WorkerRecognitionConfig;
  /** Called on the main thread when the worker returns a frame result. */
  onResult: (result: WorkerFrameResult) => void;
  /** When false the worker is not created (e.g. recognition is disabled). */
  enabled: boolean;
}

export interface UseRecognitionWorkerReturn {
  /**
   * Send an ImageBitmap to the worker for processing.
   * The bitmap is transferred (zero-copy) and must not be used after this call.
   * Returns false if the worker is busy or not ready, so the caller can skip.
   */
  processFrame: (
    bitmap: ImageBitmap,
    frameId: number,
    perspective?: WorkerPerspectiveFrameData
  ) => boolean;
  /** True while the worker is processing a frame. */
  isBusy: boolean;
  /** True once the worker has acknowledged the init message. */
  isReady: boolean;
  /** True when the browser supports the worker pipeline. */
  isSupported: boolean;
  /**
   * True when the worker has crashed and all restart attempts (MAX_WORKER_RESTARTS)
   * have been exhausted. The caller should fall back to the inline path permanently
   * for the remainder of the session.
   */
  isFailed: boolean;
}

export function useRecognitionWorker({
  hashEntries,
  config,
  onResult,
  enabled,
}: UseRecognitionWorkerOptions): UseRecognitionWorkerReturn {
  const supported = useRef(isWorkerPipelineSupported()).current;

  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const busyRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);

  // Restart state: a monotonically-increasing key that triggers the creation
  // effect to re-run (spawning a new worker), and a ref that tracks how many
  // restarts have already been attempted (for backoff / failure threshold).
  const [restartKey, setRestartKey] = useState(0);
  const restartAttemptRef = useRef(0);
  const [isFailed, setIsFailed] = useState(false);

  // Keep a stable ref to onResult so the message handler never goes stale.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // Always-current ref so the init effect can read the latest config without
  // including it as a dependency (which would cause unnecessary re-inits).
  const latestConfigRef = useRef(config);
  latestConfigRef.current = config;

  // Always-current ref so the creation effect can send init on restart even
  // when hashEntries has not changed (the init effect wouldn't re-fire then).
  const hashEntriesRef = useRef(hashEntries);
  hashEntriesRef.current = hashEntries;

  // Keep a stable ref to the last-sent config for dedup in the config-update effect.
  const prevConfigRef = useRef<WorkerRecognitionConfig | null>(null);

  // -----------------------------------------------------------------------
  // Worker creation / teardown
  // -----------------------------------------------------------------------

  // restartKey is included so that incrementing it re-runs this effect,
  // terminating the crashed worker and spawning a fresh replacement.
  useEffect(() => {
    if (!enabled || !supported) {
      return;
    }

    // Vite handles the `new URL(…, import.meta.url)` pattern and bundles the
    // worker file automatically. The `{ type: 'module' }` option enables
    // ES module imports inside the worker.
    const worker = new Worker(new URL('./recognition.worker.ts', import.meta.url), {
      type: 'module',
      name: 'photo-recognition',
    });

    worker.onmessage = (event: MessageEvent<WorkerToMainMessage>) => {
      const msg = event.data;

      switch (msg.type) {
        case 'ready':
          setIsReady(true);
          break;

        case 'result':
          busyRef.current = false;
          setIsBusy(false);
          onResultRef.current(msg);
          break;

        case 'error':
          busyRef.current = false;
          setIsBusy(false);
          console.error('[recognition-worker]', msg.message);
          break;
      }
    };

    worker.onerror = (err) => {
      console.error('[recognition-worker] Unhandled error:', err);
      busyRef.current = false;
      setIsBusy(false);
      // Mark not-ready so processFrame won't send frames to the crashed worker.
      setIsReady(false);

      // Attempt automatic restart with exponential backoff, up to MAX_WORKER_RESTARTS.
      // Each restart increments restartKey, causing this effect to re-run and
      // spawn a fresh worker. After the limit is exhausted, set isFailed so the
      // caller can fall back to the inline path permanently.
      const attempt = restartAttemptRef.current;
      if (attempt < MAX_WORKER_RESTARTS) {
        const delayMs = WORKER_RESTART_DELAYS_MS[attempt] ?? 300;
        restartAttemptRef.current = attempt + 1;
        console.warn(
          `[recognition-worker] Scheduling restart attempt ${attempt + 1}/${MAX_WORKER_RESTARTS} in ${delayMs}ms`
        );
        setTimeout(() => {
          setRestartKey((k) => k + 1);
        }, delayMs);
      } else {
        console.error(
          '[recognition-worker] All restart attempts exhausted — falling back to inline path'
        );
        setIsFailed(true);
      }
    };

    workerRef.current = worker;

    // On restart, hash entries are already available — resend init immediately
    // so the new worker is ready without waiting for the hashEntries effect to
    // re-fire (which only happens when hashEntries changes, not on restartKey).
    if (restartKey > 0 && hashEntriesRef.current.length > 0) {
      const cfg = latestConfigRef.current;
      prevConfigRef.current = cfg;
      worker.postMessage({ type: 'init', hashEntries: hashEntriesRef.current, config: cfg });
    }

    return () => {
      worker.terminate();
      workerRef.current = null;
      setIsReady(false);
      busyRef.current = false;
      setIsBusy(false);
    };
    // restartKey intentionally included to trigger re-run on worker restart.
  }, [enabled, supported, restartKey]);

  // -----------------------------------------------------------------------
  // Send init when hash entries change (or on first mount)
  // -----------------------------------------------------------------------

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker || hashEntries.length === 0) {
      return;
    }

    setIsReady(false);
    // Read from the ref so this effect doesn't re-fire on config-only changes —
    // config changes are handled by the config-update effect below.
    const cfg = latestConfigRef.current;
    prevConfigRef.current = cfg;

    worker.postMessage({
      type: 'init',
      hashEntries,
      config: cfg,
    });
  }, [hashEntries]); // config intentionally omitted — see latestConfigRef above

  // -----------------------------------------------------------------------
  // Send config-update when config changes without a hash reload
  // -----------------------------------------------------------------------

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker || !isReady || !prevConfigRef.current) {
      return;
    }

    // Only send if config actually differs from what was last sent.
    if (prevConfigRef.current === config) {
      return;
    }
    prevConfigRef.current = config;

    worker.postMessage({
      type: 'config-update',
      config,
    });
  }, [config, isReady]);

  // -----------------------------------------------------------------------
  // processFrame
  // -----------------------------------------------------------------------

  const processFrame = useCallback(
    (bitmap: ImageBitmap, frameId: number, perspective?: WorkerPerspectiveFrameData): boolean => {
      const worker = workerRef.current;
      if (!worker || !isReady || busyRef.current) {
        // Release the bitmap since we won't use it
        bitmap.close();
        return false;
      }

      busyRef.current = true;
      setIsBusy(true);

      // Transfer the bitmap (zero-copy). After this call the bitmap is
      // neutered and must not be used on the main thread.
      worker.postMessage({ type: 'frame', bitmap, frameId, perspective }, [bitmap]);
      return true;
    },
    [isReady]
  );

  return {
    processFrame,
    isBusy,
    isReady,
    isSupported: supported,
    isFailed,
  };
}
