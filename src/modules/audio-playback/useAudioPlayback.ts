import { useRef, useState, useCallback, useEffect } from 'react';
import * as howlerModule from 'howler';
import type { AudioPlaybackHook, AudioPlaybackOptions } from './types';
import { diagnoseAudioUrl } from './diagnoseAudioUrl';

const { Howl } = howlerModule;

function getHowlerContext(): { state?: string; resume?: () => Promise<unknown> } | undefined {
  try {
    const howler = Reflect.get(howlerModule as object, 'Howler') as
      | { ctx?: { state?: string; resume?: () => Promise<unknown> } }
      | undefined;
    return howler?.ctx;
  } catch {
    return undefined;
  }
}

/**
 * Custom hook for audio playback
 *
 * Manages audio playback with smooth fading using Howler.js.
 * Can be easily replaced with native Audio API if needed.
 *
 * @param options - Configuration options
 * @returns Audio playback controls and state
 */
export function useAudioPlayback(options: AudioPlaybackOptions = {}): AudioPlaybackHook {
  const { volume: initialVolume = 0.8, onSongEnd } = options;

  const onSongEndRef = useRef(onSongEnd);
  useEffect(() => {
    onSongEndRef.current = onSongEnd;
  }, [onSongEnd]);

  const soundRef = useRef<Howl | null>(null);
  const fadingOutSoundRef = useRef<Howl | null>(null);
  const crossfadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const preloadCacheRef = useRef<Map<string, Howl>>(new Map());
  const progressRafRef = useRef<number | null>(null);
  const volumeRef = useRef(initialVolume);
  const playbackRequestRef = useRef(0);
  const diagnosticCacheRef = useRef<Map<string, Promise<import('./types').AudioDiagnosticResult>>>(
    new Map()
  );
  const isMountedRef = useRef(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolumeState] = useState(initialVolume);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  const unlockAudioContext = useCallback(async () => {
    const audioContext = getHowlerContext();
    if (!audioContext || audioContext.state !== 'suspended') {
      return;
    }

    try {
      await audioContext.resume?.();
    } catch (error) {
      console.warn('[Audio] Failed to resume audio context:', error);
    }
  }, []);

  const resolvePlayErrorMessage = useCallback((error: unknown) => {
    const text = String(error ?? '').toLowerCase();
    if (
      text.includes('notallowederror') ||
      text.includes('user gesture') ||
      text.includes('gesture')
    ) {
      return 'Playback blocked by browser autoplay rules. Touch screen and tap Play again.';
    }

    return 'Audio failed to start. Tap Play to retry.';
  }, []);

  const runWhenAudioContextReady = useCallback(
    (operation: () => void) => {
      const audioContext = getHowlerContext();

      if (!audioContext || audioContext.state !== 'suspended') {
        operation();
        return;
      }

      void unlockAudioContext().then(() => {
        if (isMountedRef.current) {
          operation();
        }
      });
    },
    [unlockAudioContext]
  );

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    const cache = preloadCacheRef.current;
    const diagCache = diagnosticCacheRef.current;

    const handleUserGesture = () => {
      void unlockAudioContext();
    };

    window.addEventListener('pointerdown', handleUserGesture, { passive: true });
    window.addEventListener('touchstart', handleUserGesture, { passive: true });
    window.addEventListener('click', handleUserGesture, { passive: true });

    return () => {
      isMountedRef.current = false;

      window.removeEventListener('pointerdown', handleUserGesture);
      window.removeEventListener('touchstart', handleUserGesture);
      window.removeEventListener('click', handleUserGesture);

      if (progressRafRef.current !== null) {
        cancelAnimationFrame(progressRafRef.current);
        progressRafRef.current = null;
      }

      // Cleanup preloaded sounds
      cache.forEach((sound) => sound.unload());
      cache.clear();

      // Clear diagnostic cache
      diagCache.clear();

      // Clear any pending crossfade timeout
      if (crossfadeTimeoutRef.current) {
        clearTimeout(crossfadeTimeoutRef.current);
        crossfadeTimeoutRef.current = null;
      }

      // Cleanup fading out sound
      if (fadingOutSoundRef.current) {
        fadingOutSoundRef.current.unload();
        fadingOutSoundRef.current = null;
      }

      // Cleanup current sound
      if (soundRef.current) {
        soundRef.current.unload();
        soundRef.current = null;
      }
    };
  }, [unlockAudioContext]);

  const stopProgressLoop = useCallback(() => {
    if (progressRafRef.current !== null) {
      cancelAnimationFrame(progressRafRef.current);
      progressRafRef.current = null;
    }
  }, []);

  const cleanupSound = useCallback((sound: Howl, url: string) => {
    sound.unload();
    soundRef.current = null;
    currentUrlRef.current = null;
    preloadCacheRef.current.delete(url);
  }, []);

  const getCurrentRatio = useCallback(() => {
    const sound = soundRef.current;
    if (!sound) {
      return 0;
    }

    const duration = typeof sound.duration === 'function' ? sound.duration() : 0;
    const position = typeof sound.seek === 'function' ? (sound.seek() as number) : 0;
    return duration > 0 ? Math.min(Math.max(position / duration, 0), 1) : 0;
  }, []);

  const updateProgress = useCallback(() => {
    const ratio = getCurrentRatio();
    setProgress(ratio);

    const sound = soundRef.current;
    if (sound && sound.playing()) {
      progressRafRef.current = window.requestAnimationFrame(updateProgress);
    }
  }, [getCurrentRatio]);

  const startDiagnostic = useCallback((url: string) => {
    if (!diagnosticCacheRef.current.has(url)) {
      diagnosticCacheRef.current.set(url, diagnoseAudioUrl(url));
    }
    return diagnosticCacheRef.current.get(url)!;
  }, []);

  const nextPlaybackRequest = useCallback(() => {
    playbackRequestRef.current += 1;
    return playbackRequestRef.current;
  }, []);

  const isPlaybackRequestCurrent = useCallback((requestId: number) => {
    return playbackRequestRef.current === requestId;
  }, []);

  const attachCallbacks = useCallback(
    (sound: Howl, url: string) => {
      const hasEventApi = typeof sound.on === 'function' && typeof sound.off === 'function';

      const onPlay = () => {
        setIsPlaying(true);
        setPlaybackError(null);
        stopProgressLoop();
        updateProgress();
      };

      const onEnd = () => {
        if (soundRef.current === sound) {
          stopProgressLoop();
          setIsPlaying(false);
          setProgress(0);
          onSongEndRef.current?.();
        }
      };

      const onStop = () => {
        if (soundRef.current === sound) {
          stopProgressLoop();
          setIsPlaying(false);
        }
      };

      const onLoadError = (_id: number, error: unknown) => {
        console.error('[Audio] Load error:', error);
        console.warn('[Audio] File not found:', url);
        if (soundRef.current === sound) {
          stopProgressLoop();
          setIsPlaying(false);
          setProgress(0);
          setPlaybackError('Audio failed to load. Check your connection and try again.');
          // Clear refs and unload to enable clean retry
          cleanupSound(sound, url);

          // Asynchronously replace generic message with diagnostic details.
          // Only update error state if a different URL hasn't been loaded since.
          startDiagnostic(url)
            .then((result) => {
              // If mounted and no other URL has been loaded (or same URL loaded again), update
              if (
                isMountedRef.current &&
                (currentUrlRef.current === null || currentUrlRef.current === url)
              ) {
                setPlaybackError(`Audio failed to load: ${result.message} Tap Play to retry.`);
              }
            })
            .catch((diagnosticError) => {
              // Avoid unhandled rejections if diagnoseAudioUrl throws
              console.error('[Audio] Diagnostic error:', diagnosticError);
            });
        }
      };

      const onPlayError = (_id: number, error: unknown) => {
        console.error('[Audio] Play error:', error);
        if (soundRef.current === sound) {
          stopProgressLoop();
          setIsPlaying(false);
          setProgress(0);
          setPlaybackError(resolvePlayErrorMessage(error));
          // Clear refs and unload to enable clean retry
          cleanupSound(sound, url);
        }
      };

      if (hasEventApi) {
        sound.off('play');
        sound.off('end');
        sound.off('stop');
        sound.off('loaderror');
        sound.off('playerror');

        sound.on('play', onPlay);
        sound.on('end', onEnd);
        sound.on('stop', onStop);
        sound.on('loaderror', onLoadError);
        sound.on('playerror', onPlayError);
      } else {
        const callbackHolder = sound as unknown as {
          onplay?: () => void;
          onend?: () => void;
          onstop?: () => void;
          onloaderror?: (id: number, error: unknown) => void;
          onplayerror?: (id: number, error: unknown) => void;
          _callbacks?: {
            onplay?: () => void;
            onend?: () => void;
            onstop?: () => void;
            onloaderror?: (id: number, error: unknown) => void;
            onplayerror?: (id: number, error: unknown) => void;
          };
        };

        callbackHolder.onplay = onPlay;
        callbackHolder.onend = onEnd;
        callbackHolder.onstop = onStop;
        callbackHolder.onloaderror = onLoadError;
        callbackHolder.onplayerror = onPlayError;

        if (callbackHolder._callbacks) {
          callbackHolder._callbacks.onplay = onPlay;
          callbackHolder._callbacks.onend = onEnd;
          callbackHolder._callbacks.onstop = onStop;
          callbackHolder._callbacks.onloaderror = onLoadError;
          callbackHolder._callbacks.onplayerror = onPlayError;
        }
      }
    },
    [stopProgressLoop, updateProgress, cleanupSound, startDiagnostic, resolvePlayErrorMessage]
  );

  const createSound = useCallback(
    (url: string, { initialVolume }: { initialVolume?: number } = {}) => {
      const sound = new Howl({
        src: [url],
        html5: true,
        preload: true,
        volume: initialVolume ?? volumeRef.current,
      });

      attachCallbacks(sound, url);

      return sound;
    },
    [attachCallbacks]
  );

  const getCachedOrCreateSound = useCallback(
    (url: string, options?: { initialVolume?: number }) => {
      if (preloadCacheRef.current.has(url)) {
        const cachedSound = preloadCacheRef.current.get(url)!;
        preloadCacheRef.current.delete(url);

        if (options?.initialVolume !== undefined) {
          cachedSound.volume(options.initialVolume);
        }

        attachCallbacks(cachedSound, url);

        return cachedSound;
      }

      return createSound(url, options);
    },
    [attachCallbacks, createSound]
  );

  const preload = useCallback(
    (url: string) => {
      if (!url) {
        return;
      }

      if (preloadCacheRef.current.has(url) || currentUrlRef.current === url) {
        return;
      }

      // Clear any previous cached sounds to keep memory usage low
      preloadCacheRef.current.forEach((cachedSound, cachedUrl) => {
        if (
          cachedUrl !== url &&
          cachedSound !== soundRef.current &&
          cachedSound !== fadingOutSoundRef.current
        ) {
          cachedSound.unload();
          preloadCacheRef.current.delete(cachedUrl);
        }
      });

      const preloadedSound = createSound(url);
      preloadCacheRef.current.set(url, preloadedSound);
    },
    [createSound]
  );

  const play = useCallback(
    (url: string) => {
      setPlaybackError(null);
      const requestId = nextPlaybackRequest();

      runWhenAudioContextReady(() => {
        if (!isMountedRef.current || !isPlaybackRequestCurrent(requestId)) {
          return;
        }

        // Resume if the same track is paused
        if (soundRef.current && currentUrlRef.current === url) {
          soundRef.current.play();
          return;
        }

        // Stop and unload previous sound only after we're ready to start the new one
        if (soundRef.current) {
          soundRef.current.unload();
          soundRef.current = null;
        }

        const newSound = getCachedOrCreateSound(url);

        if (!isPlaybackRequestCurrent(requestId)) {
          newSound.unload();
          return;
        }

        soundRef.current = newSound;
        currentUrlRef.current = url;
        newSound.volume(volumeRef.current);
        newSound.play();
      });
    },
    [getCachedOrCreateSound, isPlaybackRequestCurrent, nextPlaybackRequest, runWhenAudioContextReady]
  );

  const pause = useCallback(() => {
    nextPlaybackRequest();
    if (soundRef.current) {
      soundRef.current.pause();
      setIsPlaying(false);
      setProgress(getCurrentRatio());
      stopProgressLoop();
    }
  }, [getCurrentRatio, nextPlaybackRequest, stopProgressLoop]);

  const stop = useCallback(() => {
    nextPlaybackRequest();
    if (soundRef.current) {
      soundRef.current.stop();
      soundRef.current.unload();
      soundRef.current = null;
      currentUrlRef.current = null;
      setIsPlaying(false);
      stopProgressLoop();
      setProgress(0);
    }
  }, [nextPlaybackRequest, stopProgressLoop]);

  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    volumeRef.current = clampedVolume;
    setVolumeState(clampedVolume);

    if (soundRef.current) {
      soundRef.current.volume(clampedVolume);
    }
  }, []);

  const clearPlaybackError = useCallback(() => {
    setPlaybackError(null);
  }, []);

  const crossfade = useCallback(
    (newUrl: string) => {
      const duration = 300;
      setPlaybackError(null);
      const requestId = nextPlaybackRequest();

      runWhenAudioContextReady(() => {
        if (!isMountedRef.current || !isPlaybackRequestCurrent(requestId)) {
          return;
        }

        // Cancel any pending crossfade cleanup
        if (crossfadeTimeoutRef.current) {
          clearTimeout(crossfadeTimeoutRef.current);
          crossfadeTimeoutRef.current = null;
        }

        const currentSound = soundRef.current;

        // If no audio is currently playing, just play the new track
        if (!currentSound || !currentSound.playing()) {
          play(newUrl);
          return;
        }

        // Same URL: restart the current track
        if (currentUrlRef.current === newUrl) {
          currentSound.seek(0);
          if (!currentSound.playing()) {
            currentSound.play();
          }
          return;
        }

        // Clean up any existing fading-out sound before starting new crossfade
        if (fadingOutSoundRef.current) {
          fadingOutSoundRef.current.unload();
          fadingOutSoundRef.current = null;
        }

        // Move current sound to fading out ref
        fadingOutSoundRef.current = currentSound;
        soundRef.current = null;

        // Fade out old, fade in new
        fadingOutSoundRef.current.fade(currentSound.volume(), 0, duration);

        const newSound = getCachedOrCreateSound(newUrl, { initialVolume: 0 });

        if (!isPlaybackRequestCurrent(requestId)) {
          newSound.unload();
          return;
        }

        soundRef.current = newSound;
        currentUrlRef.current = newUrl;
        newSound.play();
        newSound.fade(0, volumeRef.current, duration);

        // Clean up old sound and re-assert volume after fade completes
        crossfadeTimeoutRef.current = setTimeout(() => {
          if (!isPlaybackRequestCurrent(requestId)) {
            return;
          }
          if (fadingOutSoundRef.current) {
            fadingOutSoundRef.current.unload();
            fadingOutSoundRef.current = null;
          }
          const activeSound = soundRef.current;
          if (currentUrlRef.current === newUrl && activeSound) {
            activeSound.volume(volumeRef.current);
            if (!activeSound.playing()) {
              activeSound.play();
            }
          }
          crossfadeTimeoutRef.current = null;
        }, duration);
      });
    },
    [
      getCachedOrCreateSound,
      isPlaybackRequestCurrent,
      nextPlaybackRequest,
      play,
      runWhenAudioContextReady,
    ]
  );

  return {
    play,
    preload,
    pause,
    stop,
    crossfade,
    isPlaying,
    progress,
    volume,
    playbackError,
    setVolume,
    clearPlaybackError,
  };
}
