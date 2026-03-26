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
    id: 'power-on-intro',
    name: 'Power-On Intro',
    description:
      'After the passcode gate or first load, pressing Turn On plays the old-TV startup sequence before the Still Broadcasting landing screen appears.',
    enabled: true,
    category: 'ui',
  },
  {
    id: 'exif-visual-character',
    name: 'EXIF Visual Character',
    description:
      'Vary the visual character of each photo match based on its EXIF shooting conditions. ISO drives film grain intensity. Aperture drives the concert info backdrop blur. Shutter speed drives the match reveal animation speed.',
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
      'As a song plays toward its end, scan lines faintly return — the broadcast fades as the audio arc closes. Opacity increases from 0 to a max of +0.12 as progress approaches 1.',
    enabled: true,
    category: 'audio',
  },
];
