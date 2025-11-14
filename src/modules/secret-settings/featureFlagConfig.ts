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
      'Use test data with working photo hashes and sample audio/images. Test assets are automatically copied to public/assets/ during build. Enable this mode to test photo recognition with the provided test images in assets/test-images/.',
    enabled: false,
    category: 'development',
  },
  {
    id: 'grayscale-mode',
    name: 'Grayscale Conversion',
    description:
      'Convert camera frames to black and white before photo recognition. May improve accuracy since printed reference photos are monochrome, and can reduce noise in low-light conditions.',
    enabled: false,
    category: 'experimental',
  },
  {
    id: 'psychedelic-mode',
    name: 'Psychedelic Color Cycle Mode',
    description:
      'Enable vibrant gradient overlays and liquid light show effects for instant party vibes',
    enabled: false,
    category: 'ui',
  },
  {
    id: 'retro-sounds',
    name: 'Old-School Easter Egg Sounds',
    description:
      'Play random retro system sounds (modem noise, video-game beeps) when interacting with the app',
    enabled: false,
    category: 'ui',
  },
];
