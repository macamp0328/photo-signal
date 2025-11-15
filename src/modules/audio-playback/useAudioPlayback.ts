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
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(initialVolume);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
      currentUrlRef.current = url;
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
      currentUrlRef.current = null;
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

  const crossfade = useCallback(
    (newUrl: string, duration: number = crossfadeDuration) => {
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
      const newSound = new Howl({
        src: [newUrl],
        html5: true,
        volume: 0,
        onplay: () => setIsPlaying(true),
        onend: () => {
          // Only set to false if this is still the current sound
          if (soundRef.current === newSound) {
            setIsPlaying(false);
          }
        },
        onstop: () => {
          // Only set to false if this is still the current sound
          if (soundRef.current === newSound) {
            setIsPlaying(false);
          }
        },
        onloaderror: (_id, error) => {
          console.error('Audio load error:', error);
          console.warn('Audio file not found:', newUrl);
          setIsPlaying(true);
        },
        onplayerror: (_id, error) => {
          console.error('Audio play error:', error);
        },
      });

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
    [crossfadeDuration, crossfadeEnabled, isPlaying, play, volume]
  );

  return {
    play,
    pause,
    stop,
    fadeOut,
    crossfade,
    isPlaying,
    volume,
    setVolume,
  };
}
