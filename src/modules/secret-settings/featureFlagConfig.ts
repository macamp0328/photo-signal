/**
 * Feature Flag Configuration
 *
 * Define all feature flags here. Each flag is a boolean toggle
 * that enables/disables experimental or creative features.
 */

import type { FeatureFlag } from './types';

/**
 * Feature flag configuration
 * Add new flags to this array to make them available in the UI
 */
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
    id: 'multi-scale-recognition',
    name: 'Multi-Scale Recognition (Relaxed Framing)',
    description:
      "Enable multi-scale photo recognition to support imprecise alignment. Tests multiple crop scales (75%, 80%, 85%, 90%) to match photos that don't perfectly fill the framing guide. More forgiving for handheld use and photos with small borders or background visible.",
    enabled: false,
    category: 'experimental',
  },
  {
    id: 'rectangle-detection',
    name: 'Dynamic Rectangle Detection',
    description:
      'Use computer vision to automatically detect the rectangular boundaries of printed photos in the camera feed. When enabled, the system will dynamically crop to the detected photo edges instead of using fixed aspect ratio guides. Shows visual feedback when a rectangle is detected.',
    enabled: false,
    category: 'experimental',
  },
  {
    id: 'grayscale-mode',
    name: 'Grayscale Conversion',
    description:
      'Convert camera frames to black and white before photo recognition. May improve accuracy since printed reference photos are monochrome, and can reduce noise in low-light conditions.',
    enabled: false,
    category: 'experimental',
  },
];
