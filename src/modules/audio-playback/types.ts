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
  /** Crossfade to new audio track over 300ms. If nothing is playing, acts like play().
   *  Same URL: seeks to beginning. Crossfade already in progress: cancels the old one. */
  crossfade: (newUrl: string) => void;
  /** Current playback state */
  isPlaying: boolean;
  /** Current playback progress (0-1), resets when nothing is playing */
  progress: number;
  /** Current volume (0-1) */
  volume: number;
  /** Most recent playback/load error message */
  playbackError: string | null;
  /** Set volume (0-1) */
  setVolume: (volume: number) => void;
  /** Clear current playback error state */
  clearPlaybackError: () => void;
}

export interface AudioPlaybackOptions {
  /** Initial volume (0-1), default 0.8 */
  volume?: number;
  /** Called when a song finishes playing naturally (not on stop/pause) */
  onSongEnd?: () => void;
  /** Max playback duration in ms. When set, fades out over the last ~3s then stops. */
  maxDurationMs?: number;
}

export interface AudioDiagnosticResult {
  /** HTTP status code from HEAD request, or null if request failed */
  httpStatus: number | null;
  /** Value of Access-Control-Allow-Origin header, or null if absent */
  corsOrigin: string | null;
  /** Content-Type header value */
  contentType: string | null;
  /** Content-Length in bytes */
  contentLength: number | null;
  /** Whether a CORS issue is the likely cause of failure */
  likelyCorsIssue: boolean;
  /** Human-readable diagnostic message */
  message: string;
}
