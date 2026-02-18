import { useCallback, useEffect, useRef, useState } from 'react';
import { Howl } from 'howler';
import { diagnoseAudioUrl } from '../audio-playback';
import type { AudioDiagnosticResult } from '../audio-playback';

export interface AudioTestResult {
  diagnostic: AudioDiagnosticResult;
  playbackOutcome: 'success' | 'load-error' | 'play-error' | 'skipped';
  playbackDetail: string | null;
  durationMs: number;
}

export interface UseAudioTestReturn {
  runTest: (url: string) => void;
  isTestRunning: boolean;
  testResult: AudioTestResult | null;
  resetTest: () => void;
}

const TEST_PLAYBACK_TIMEOUT_MS = 5000;
const TEST_VOLUME = 0.15;

function canPlayContentType(contentType: string | null): boolean | null {
  if (!contentType || typeof Audio === 'undefined') {
    return null;
  }

  try {
    const audio = new Audio();
    if (typeof audio.canPlayType !== 'function') {
      return null;
    }
    const support = audio.canPlayType(contentType);
    return support === 'probably' || support === 'maybe';
  } catch {
    return null;
  }
}

function buildPlaybackErrorDetail(
  prefix: 'Howler load error' | 'Howler play error',
  error: unknown,
  diagnostic: AudioDiagnosticResult
) {
  const baseMessage = `${prefix}: ${String(error)}.`;
  const isHttpSuccess =
    diagnostic.httpStatus !== null && diagnostic.httpStatus >= 200 && diagnostic.httpStatus < 300;

  if (isHttpSuccess && canPlayContentType(diagnostic.contentType) === false) {
    return `${baseMessage} Browser codec support issue likely (${diagnostic.contentType}).`;
  }

  return baseMessage;
}

export function useAudioTest(): UseAudioTestReturn {
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<AudioTestResult | null>(null);
  const testSoundRef = useRef<Howl | null>(null);
  const isMountedRef = useRef(true);
  const timeoutRef = useRef<number | null>(null);
  const runIdRef = useRef(0);

  // Register cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (testSoundRef.current) {
        testSoundRef.current.unload();
        testSoundRef.current = null;
      }
    };
  }, []);

  const runTest = useCallback((url: string) => {
    if (!url) return;

    // Increment runId to invalidate any in-flight previous runs
    const currentRunId = ++runIdRef.current;

    setIsTestRunning(true);
    setTestResult(null);

    // Clean up any leftover test sound
    if (testSoundRef.current) {
      testSoundRef.current.unload();
      testSoundRef.current = null;
    }

    const startTime = Date.now();

    diagnoseAudioUrl(url).then((diagnostic) => {
      // Ignore stale results from previous runs
      if (!isMountedRef.current || runIdRef.current !== currentRunId) return;

      // If the fetch itself failed, or we got an unrecoverable HTTP status, skip playback test.
      // Note: Some CDNs legitimately return 403/405 for HEAD while still allowing GET/streaming,
      // so we treat those as "probe unsupported" and still attempt playback.
      if (
        diagnostic.httpStatus === null ||
        (diagnostic.httpStatus >= 400 &&
          diagnostic.httpStatus !== 403 &&
          diagnostic.httpStatus !== 405)
      ) {
        setTestResult({
          diagnostic,
          playbackOutcome: 'skipped',
          playbackDetail: `Skipped playback: fetch returned ${diagnostic.httpStatus ?? 'network error'}.`,
          durationMs: Date.now() - startTime,
        });
        setIsTestRunning(false);
        return;
      }

      // Phase 2: attempt actual Howler playback
      let settled = false;

      timeoutRef.current = window.setTimeout(() => {
        if (settled || runIdRef.current !== currentRunId) return;
        settled = true;
        timeoutRef.current = null;
        if (testSoundRef.current) {
          testSoundRef.current.unload();
          testSoundRef.current = null;
        }
        if (isMountedRef.current) {
          setTestResult({
            diagnostic,
            playbackOutcome: 'load-error',
            playbackDetail: 'Timed out waiting for audio to load/play.',
            durationMs: Date.now() - startTime,
          });
          setIsTestRunning(false);
        }
      }, TEST_PLAYBACK_TIMEOUT_MS);

      const sound = new Howl({
        src: [url],
        html5: true,
        preload: true,
        volume: TEST_VOLUME,
      });
      testSoundRef.current = sound;

      sound.on('play', () => {
        if (settled || runIdRef.current !== currentRunId) return;
        settled = true;
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        // Stop immediately — we just wanted to confirm playback works
        sound.stop();
        sound.unload();
        testSoundRef.current = null;

        if (isMountedRef.current) {
          setTestResult({
            diagnostic,
            playbackOutcome: 'success',
            playbackDetail: 'Audio loaded and played successfully.',
            durationMs: Date.now() - startTime,
          });
          setIsTestRunning(false);
        }
      });

      sound.on('loaderror', (_id: number, error: unknown) => {
        if (settled || runIdRef.current !== currentRunId) return;
        settled = true;
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        sound.unload();
        testSoundRef.current = null;

        if (isMountedRef.current) {
          setTestResult({
            diagnostic,
            playbackOutcome: 'load-error',
            playbackDetail: buildPlaybackErrorDetail('Howler load error', error, diagnostic),
            durationMs: Date.now() - startTime,
          });
          setIsTestRunning(false);
        }
      });

      sound.on('playerror', (_id: number, error: unknown) => {
        if (settled || runIdRef.current !== currentRunId) return;
        settled = true;
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        sound.unload();
        testSoundRef.current = null;

        if (isMountedRef.current) {
          setTestResult({
            diagnostic,
            playbackOutcome: 'play-error',
            playbackDetail: buildPlaybackErrorDetail('Howler play error', error, diagnostic),
            durationMs: Date.now() - startTime,
          });
          setIsTestRunning(false);
        }
      });

      sound.play();
    });
  }, []);

  const resetTest = useCallback(() => {
    setTestResult(null);
    setIsTestRunning(false);
    if (testSoundRef.current) {
      testSoundRef.current.unload();
      testSoundRef.current = null;
    }
  }, []);

  return { runTest, isTestRunning, testResult, resetTest };
}
