/**
 * Demo mode detection.
 *
 * The demo script (scripts/visual/generate-demo-gif.js) sets this localStorage key
 * before page load so the app can adjust behaviour for recording:
 *  - Audio fade duration is shortened so playback starts quickly in the recorded video
 */
export function isDemoNoAudioFadeEnabled(): boolean {
  try {
    return localStorage.getItem('photo-signal-demo-no-audio-fade') === 'true';
  } catch {
    return false;
  }
}
