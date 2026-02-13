/**
 * Audio Playback Module Types
 */

export interface AudioPlaybackHook {
  /** Play audio from URL */
  play: (url: string) => void;
  /** Preload audio so it is ready to play without delay */
  preload: (url: string) => void;
  /** Pause playback */
  pause: () => void;
  /** Stop and unload audio */
  stop: () => void;
  /** Fade out over duration (ms) */
  fadeOut: (duration?: number) => void;
  /** Crossfade to new audio track */
  crossfade: (newUrl: string, duration?: number) => void;
  /** Current playback state */
  isPlaying: boolean;
  /** Current playback progress (0-1), resets when nothing is playing */
  progress: number;
  /** Current volume (0-1) */
  volume: number;
  /** Set volume (0-1) */
  setVolume: (volume: number) => void;
}

export interface AudioPlaybackOptions {
  /** Initial volume (0-1), default 0.8 */
  volume?: number;
  /** Default fade duration (ms), default 1000 */
  fadeTime?: number;
  /** Default crossfade duration (ms), default 2000 */
  crossfadeDuration?: number;
  /** Enable crossfade functionality, default true */
  crossfadeEnabled?: boolean;
}
