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
];
