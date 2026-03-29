/**
 * Secret Settings Configuration
 *
 * Defines feature flags for the secret settings menu.
 * All recognition parameters are hardcoded with sensible defaults and
 * self-tune at runtime — no user adjustment needed.
 */

import type { FeatureFlag } from './types';

export const FEATURE_FLAGS: FeatureFlag[] = [
  {
    id: 'exif-visual-character',
    name: 'EXIF Visual Character',
    description:
      'Vary the visual character of each photo match based on its EXIF shooting conditions. ISO drives film grain intensity. Shutter speed drives the match reveal animation speed. Aperture is displayed in metadata but does not currently drive a CSS effect.',
    enabled: true,
    category: 'ui',
  },
  {
    id: 'rectangle-detection',
    name: 'Dynamic Rectangle Detection',
    description:
      'Use computer vision to automatically detect the rectangular boundaries of printed photos in the camera feed. When enabled, the system will dynamically crop to the detected photo edges instead of using fixed aspect ratio guides. Shows visual feedback when a rectangle is detected.',
    enabled: true,
    category: 'experimental',
  },
  {
    id: 'show-debug-overlay',
    name: 'Debug Overlay',
    description:
      'Show the real-time photo recognition debug panel. Useful for diagnosing recognition issues or running telemetry sessions.',
    enabled: false,
    category: 'development',
  },
  {
    id: 'audio-reactive-glow',
    name: 'Audio-Reactive Phosphor Glow',
    description:
      'When a photo is matched and music plays, the phosphor glow subtly breathes with the bass. Uses the Web Audio API to read low-frequency energy and modulate the text-shadow intensity. Activates only in matched state.',
    enabled: true,
    category: 'audio',
  },
  {
    id: 'song-progress-scanlines',
    name: 'Song-Progress Scan Lines',
    description:
      'As a song plays toward its end, scan lines return — the broadcast fades as the audio arc closes. Opacity increases from 0 to a max of +0.45 as progress approaches 1.',
    enabled: true,
    category: 'audio',
  },
  {
    id: 'warm-luma-phash',
    name: 'Warm-Light Luma Coefficients',
    description:
      'Use concert-stage-tuned luma coefficients (R: 0.35, G: 0.58, B: 0.07) for grayscale ' +
      'conversion during pHash computation. Reduces blue-channel noise from warm-dominant stage ' +
      'lighting. WARNING: requires regenerating the recognition hash database ' +
      '(npm run hashes:refresh) before enabling — mismatched coefficients will silently break ' +
      'recognition.',
    enabled: false,
    category: 'experimental',
  },
];
