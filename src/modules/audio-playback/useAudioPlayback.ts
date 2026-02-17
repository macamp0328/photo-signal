import { useRef, useState, useCallback, useEffect } from 'react';
import { Howl } from 'howler';
import type { AudioPlaybackHook, AudioPlaybackOptions } from './types';
import { diagnoseAudioUrl } from './diagnoseAudioUrl';

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
  const {
    volume: initialVolume = 0.8,
    fadeTime = 1000,
    crossfadeDuration = 2000,
    crossfadeEnabled = true,
  } = options;

  const soundRef = useRef<Howl | null>(null);
  const fadingOutSoundRef = useRef<Howl | null>(null);
  const crossfadeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const preloadCacheRef = useRef<Map<string, Howl>>(new Map());
  const progressRafRef = useRef<number | null>(null);
  const diagnosticCacheRef = useRef<Map<string, Promise<import('./types').AudioDiagnosticResult>>>(
    new Map()
  );
  const isMountedRef = useRef(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolumeState] = useState(initialVolume);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    const cache = preloadCacheRef.current;
    const diagCache = diagnosticCacheRef.current;
    return () => {
      isMountedRef.current = false;

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
  }, []);

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
                setPlaybackError(`Audio failed to load: ${result.message} Tap play to retry.`);
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
          setPlaybackError('Audio failed to start. Tap Play to retry.');
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
    [stopProgressLoop, updateProgress, cleanupSound, startDiagnostic]
  );

  const createSound = useCallback(
    (url: string, { initialVolume }: { initialVolume?: number } = {}) => {
      const sound = new Howl({
        src: [url],
        html5: true,
        preload: true,
        volume: initialVolume ?? volume,
      });

      attachCallbacks(sound, url);

      return sound;
    },
    [attachCallbacks, volume]
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

      // Resume if the same track is paused
      if (soundRef.current && currentUrlRef.current === url) {
        soundRef.current.play();
        return;
      }

      // Stop and unload previous sound
      if (soundRef.current) {
        soundRef.current.unload();
        soundRef.current = null;
      }

      const newSound = getCachedOrCreateSound(url);

      soundRef.current = newSound;
      currentUrlRef.current = url;
      newSound.volume(volume);
      newSound.play();
    },
    [getCachedOrCreateSound, volume]
  );

  const pause = useCallback(() => {
    if (soundRef.current) {
      soundRef.current.pause();
      setIsPlaying(false);
      setProgress(getCurrentRatio());
      stopProgressLoop();
    }
  }, [getCurrentRatio, stopProgressLoop]);

  const stop = useCallback(() => {
    if (soundRef.current) {
      soundRef.current.stop();
      soundRef.current.unload();
      soundRef.current = null;
      currentUrlRef.current = null;
      setIsPlaying(false);
      stopProgressLoop();
      setProgress(0);
    }
  }, [stopProgressLoop]);

  const fadeOut = useCallback(
    (duration: number = fadeTime) => {
      if (soundRef.current && isPlaying) {
        const currentVolume = soundRef.current.volume();
        soundRef.current.fade(currentVolume, 0, duration);

        setTimeout(() => {
          if (soundRef.current) {
            soundRef.current.stop();
            setIsPlaying(false);
            stopProgressLoop();
            setProgress(0);
          }
        }, duration);
      }
    },
    [isPlaying, fadeTime, stopProgressLoop]
  );

  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);

    if (soundRef.current) {
      soundRef.current.volume(clampedVolume);
    }
  }, []);

  const clearPlaybackError = useCallback(() => {
    setPlaybackError(null);
  }, []);

  const crossfade = useCallback(
    (newUrl: string, duration: number = crossfadeDuration) => {
      setPlaybackError(null);

      // If crossfade is disabled, just play the new track
      if (!crossfadeEnabled) {
        play(newUrl);
        return;
      }

      // Cancel any pending crossfade cleanup
      if (crossfadeTimeoutRef.current) {
        clearTimeout(crossfadeTimeoutRef.current);
        crossfadeTimeoutRef.current = null;
      }

      // If no audio is currently playing, just play the new track
      if (!soundRef.current || !isPlaying) {
        play(newUrl);
        return;
      }

      // Get current sound reference for fade out
      const currentSound = soundRef.current;
      const currentVolume = currentSound.volume();

      // Check if trying to crossfade to the same URL
      // In this case, we'll restart the track with crossfade
      const isSameUrl = currentUrlRef.current === newUrl;

      if (isSameUrl) {
        // Just restart the current track (no crossfade needed)
        currentSound.seek(0);
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

      // Start fading out the old sound
      fadingOutSoundRef.current.fade(currentVolume, 0, duration);

      // Create and start new sound at 0 volume
      const newSound = getCachedOrCreateSound(newUrl, { initialVolume: 0 });

      // Set new sound as current
      soundRef.current = newSound;
      currentUrlRef.current = newUrl;

      // Start playing and fade in
      newSound.play();
      newSound.fade(0, volume, duration);

      // Clean up old sound after fade completes
      crossfadeTimeoutRef.current = setTimeout(() => {
        if (fadingOutSoundRef.current) {
          // Don't call stop() as it would trigger onstop callback
          // Just unload since it's already faded to 0 volume
          fadingOutSoundRef.current.unload();
          fadingOutSoundRef.current = null;
        }
        crossfadeTimeoutRef.current = null;
      }, duration);
    },
    [crossfadeDuration, crossfadeEnabled, getCachedOrCreateSound, isPlaying, play, volume]
  );

  return {
    play,
    preload,
    pause,
    stop,
    fadeOut,
    crossfade,
    isPlaying,
    progress,
    volume,
    playbackError,
    setVolume,
    clearPlaybackError,
  };
}
