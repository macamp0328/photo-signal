import { useRef, useState, useCallback, useEffect } from 'react';
import { Howl } from 'howler';
import type { AudioPlaybackHook, AudioPlaybackOptions } from './types';

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
  const { volume: initialVolume = 0.8, fadeTime = 1000 } = options;

  const soundRef = useRef<Howl | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(initialVolume);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unload();
        soundRef.current = null;
      }
    };
  }, []);

  const play = useCallback(
    (url: string) => {
      // Stop and unload previous sound
      if (soundRef.current) {
        soundRef.current.unload();
        soundRef.current = null;
      }

      // Create new sound
      soundRef.current = new Howl({
        src: [url],
        html5: true,
        volume: volume,
        onplay: () => setIsPlaying(true),
        onend: () => setIsPlaying(false),
        onstop: () => setIsPlaying(false),
        onloaderror: (_id, error) => {
          console.error('Audio load error:', error);
          console.warn('Audio file not found:', url);
          // Still mark as "playing" to allow state management
          setIsPlaying(true);
        },
        onplayerror: (_id, error) => {
          console.error('Audio play error:', error);
        },
      });

      soundRef.current.play();
    },
    [volume]
  );

  const pause = useCallback(() => {
    if (soundRef.current) {
      soundRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (soundRef.current) {
      soundRef.current.stop();
      soundRef.current.unload();
      soundRef.current = null;
      setIsPlaying(false);
    }
  }, []);

  const fadeOut = useCallback(
    (duration: number = fadeTime) => {
      if (soundRef.current && isPlaying) {
        const currentVolume = soundRef.current.volume();
        soundRef.current.fade(currentVolume, 0, duration);

        setTimeout(() => {
          if (soundRef.current) {
            soundRef.current.stop();
            setIsPlaying(false);
          }
        }, duration);
      }
    },
    [isPlaying, fadeTime]
  );

  const setVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolumeState(clampedVolume);

    if (soundRef.current) {
      soundRef.current.volume(clampedVolume);
    }
  }, []);

  return {
    play,
    pause,
    stop,
    fadeOut,
    isPlaying,
    volume,
    setVolume,
  };
}
