/**
 * Returns true when the demo-capture localStorage flag is set.
 *
 * The flag is written by the Playwright demo-capture script
 * (`scripts/visual/generate-demo-gif.js`) via `addInitScript` so it is
 * present before the app mounts.  It causes the audio module to:
 *   - use the Web Audio API path (html5: false) so Howler exposes a real
 *     AudioContext that can be tapped by MediaRecorder
 *   - use a short 150 ms fade/crossfade instead of the normal 1 000 ms
 *   - expose the Howler global as `window.__photoSignalHowler`
 *
 * Safe to call in any environment: returns false if `window` or
 * `localStorage` are unavailable (SSR, tests without mocks, etc.).
 */
export function isDemoCaptureEnabled(): boolean {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return false;
  }

  try {
    return window.localStorage.getItem('photo-signal-demo-no-audio-fade') === 'true';
  } catch {
    return false;
  }
}
