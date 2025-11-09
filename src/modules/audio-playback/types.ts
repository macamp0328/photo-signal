/**
 * Audio Playback Module Types
 */

export interface AudioPlaybackHook {
  /** Play audio from URL */
  play: (url: string) => void;
  /** Pause playback */
  pause: () => void;
  /** Stop and unload audio */
  stop: () => void;
  /** Fade out over duration (ms) */
  fadeOut: (duration?: number) => void;
  /** Current playback state */
  isPlaying: boolean;
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
}
