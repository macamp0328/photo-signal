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
import type {
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
  processFrame: (bitmap: ImageBitmap, frameId: number) => boolean;
  /** True while the worker is processing a frame. */
  isBusy: boolean;
  /** True once the worker has acknowledged the init message. */
  isReady: boolean;
  /** True when the browser supports the worker pipeline. */
  isSupported: boolean;
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

  // Keep a stable ref to onResult so the message handler never goes stale.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // Always-current ref so the init effect can read the latest config without
  // including it as a dependency (which would cause unnecessary re-inits).
  const latestConfigRef = useRef(config);
  latestConfigRef.current = config;

  // Keep a stable ref to the last-sent config for dedup in the config-update effect.
  const prevConfigRef = useRef<WorkerRecognitionConfig | null>(null);

  // -----------------------------------------------------------------------
  // Worker creation / teardown
  // -----------------------------------------------------------------------

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
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
      setIsReady(false);
      busyRef.current = false;
      setIsBusy(false);
    };
  }, [enabled, supported]);

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
    (bitmap: ImageBitmap, frameId: number): boolean => {
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
      worker.postMessage({ type: 'frame', bitmap, frameId }, [bitmap]);
      return true;
    },
    [isReady]
  );

  return {
    processFrame,
    isBusy,
    isReady,
    isSupported: supported,
  };
}
