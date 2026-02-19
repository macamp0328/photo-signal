/**
 * Secret Settings Configuration
 *
 * Defines feature flags for the secret settings menu (triple-tap to open).
 * All recognition parameters are hardcoded with sensible defaults and
 * self-tune at runtime — no user adjustment needed.
 */

import type { FeatureFlag } from './types';

export const FEATURE_FLAGS: FeatureFlag[] = [
  {
    id: 'test-mode',
    name: 'Test Data Mode',
    description:
      'Use test data with working photo hashes and sample audio/images. Test assets are automatically copied to public/assets/ during build. Enable this mode to test photo recognition with the provided gradients, high-contrast PNGs, and real photos in assets/test-images/ and assets/example-real-photos/.',
    enabled: false,
    category: 'development',
  },
  {
    id: 'rectangle-detection',
    name: 'Dynamic Rectangle Detection',
    description:
      'Use computer vision to automatically detect the rectangular boundaries of printed photos in the camera feed. When enabled, the system will dynamically crop to the detected photo edges instead of using fixed aspect ratio guides. Shows visual feedback when a rectangle is detected.',
    enabled: true,
    category: 'experimental',
  },
];
