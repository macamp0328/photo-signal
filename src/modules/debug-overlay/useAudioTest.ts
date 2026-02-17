import { useCallback, useRef, useState } from 'react';
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

export function useAudioTest(): UseAudioTestReturn {
  const [isTestRunning, setIsTestRunning] = useState(false);
  const [testResult, setTestResult] = useState<AudioTestResult | null>(null);
  const testSoundRef = useRef<Howl | null>(null);
  const isMountedRef = useRef(true);

  // Track mount state
  const cleanupRef = useRef(() => {
    isMountedRef.current = false;
    if (testSoundRef.current) {
      testSoundRef.current.unload();
      testSoundRef.current = null;
    }
  });

  // Register cleanup on first render via a ref-based pattern
  // (useEffect is called later in the component, but the ref captures the intent)
  useState(() => {
    // Return cleanup on unmount — this runs synchronously once
    return () => cleanupRef.current();
  });

  const runTest = useCallback((url: string) => {
    if (!url) return;

    setIsTestRunning(true);
    setTestResult(null);

    // Clean up any leftover test sound
    if (testSoundRef.current) {
      testSoundRef.current.unload();
      testSoundRef.current = null;
    }

    const startTime = Date.now();

    diagnoseAudioUrl(url).then((diagnostic) => {
      if (!isMountedRef.current) return;

      // If the fetch itself failed, skip playback test
      if (
        diagnostic.httpStatus === null ||
        (diagnostic.httpStatus && diagnostic.httpStatus >= 400)
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

      const timeout = window.setTimeout(() => {
        if (settled) return;
        settled = true;
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
        if (settled) return;
        settled = true;
        clearTimeout(timeout);

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
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        sound.unload();
        testSoundRef.current = null;

        if (isMountedRef.current) {
          setTestResult({
            diagnostic,
            playbackOutcome: 'load-error',
            playbackDetail: `Howler load error: ${String(error)}.`,
            durationMs: Date.now() - startTime,
          });
          setIsTestRunning(false);
        }
      });

      sound.on('playerror', (_id: number, error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        sound.unload();
        testSoundRef.current = null;

        if (isMountedRef.current) {
          setTestResult({
            diagnostic,
            playbackOutcome: 'play-error',
            playbackDetail: `Howler play error: ${String(error)}.`,
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
