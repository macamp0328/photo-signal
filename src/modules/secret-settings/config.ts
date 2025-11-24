/**
 * Secret Settings Configuration
 *
 * This file defines all configuration for the secret settings module:
 * - Feature Flags: Boolean toggles for experimental features
 * - Custom Settings: Adjustable parameters (numbers, selects, etc.)
 *
 * Both types of settings are displayed in the secret settings menu,
 * which is activated by triple-tapping in the center of the screen.
 */

import type { FeatureFlag, CustomSetting } from './types';

type ConfigSettingValue = string | number | boolean;

export type ConfigProfileId =
  | 'custom'
  | 'baseline-phash'
  | 'baseline-dhash'
  | 'baseline-orb'
  | 'parallel-balanced';

export interface ConfigProfile {
  id: ConfigProfileId;
  label: string;
  description: string;
  settings: Partial<Record<string, ConfigSettingValue>>;
  featureFlags?: Partial<Record<FeatureFlag['id'], boolean>>;
}

export const CONFIG_PROFILE_SETTING_ID = 'config-profile';

export const CONFIG_PROFILES: ConfigProfile[] = [
  {
    id: 'custom',
    label: 'Custom (manual control)',
    description: 'Keep manual tweaks. Adjust any field below to automatically switch to Custom.',
    settings: {},
  },
  {
    id: 'baseline-phash',
    label: 'Baseline · pHash',
    description: 'Recommended default from the Photo Recognition Deep Dive.',
    settings: {
      'recognition-mode': 'perceptual',
      'hash-algorithm': 'phash',
      'similarity-threshold': 12,
      'recognition-delay': 1000,
      'recognition-check-interval': 250,
      'sharpness-threshold': 100,
      'glare-threshold': 250,
      'glare-percentage-threshold': 20,
      'rectangle-detection-confidence-threshold': 0.3,
      'orb-max-features': 500,
      'orb-fast-threshold': 20,
      'orb-min-match-count': 20,
      'orb-match-ratio-threshold': 0.7,
      'parallel-recognition-enabled': 'false',
    },
    featureFlags: {
      'rectangle-detection': true,
    },
  },
  {
    id: 'baseline-dhash',
    label: 'Baseline · dHash',
    description: 'Performance-first preset for controlled lighting.',
    settings: {
      'recognition-mode': 'perceptual',
      'hash-algorithm': 'dhash',
      'similarity-threshold': 24,
      'recognition-delay': 1000,
      'recognition-check-interval': 250,
      'sharpness-threshold': 100,
      'glare-threshold': 250,
      'glare-percentage-threshold': 20,
      'rectangle-detection-confidence-threshold': 0.3,
      'orb-max-features': 500,
      'orb-fast-threshold': 20,
      'orb-min-match-count': 20,
      'orb-match-ratio-threshold': 0.7,
      'parallel-recognition-enabled': 'false',
    },
    featureFlags: {
      'rectangle-detection': true,
    },
  },
  {
    id: 'baseline-orb',
    label: 'Baseline · ORB',
    description: 'Robust preset for extreme lighting, rotation, and perspective.',
    settings: {
      'recognition-mode': 'orb',
      'hash-algorithm': 'phash',
      'similarity-threshold': 0,
      'recognition-delay': 1500,
      'recognition-check-interval': 250,
      'sharpness-threshold': 80,
      'glare-threshold': 250,
      'glare-percentage-threshold': 25,
      'rectangle-detection-confidence-threshold': 0.3,
      'orb-max-features': 500,
      'orb-fast-threshold': 20,
      'orb-min-match-count': 20,
      'orb-match-ratio-threshold': 0.7,
      'parallel-recognition-enabled': 'false',
    },
    featureFlags: {
      'rectangle-detection': true,
    },
  },
  {
    id: 'parallel-balanced',
    label: 'Parallel · Balanced',
    description:
      'Multi-algorithm recognition (dHash + pHash + ORB) with weighted voting for maximum accuracy.',
    settings: {
      'recognition-mode': 'parallel',
      'hash-algorithm': 'phash',
      'similarity-threshold': 24,
      'recognition-delay': 1000,
      'recognition-check-interval': 250,
      'sharpness-threshold': 100,
      'glare-threshold': 250,
      'glare-percentage-threshold': 20,
      'rectangle-detection-confidence-threshold': 0.3,
      'orb-max-features': 1000,
      'orb-fast-threshold': 12,
      'orb-min-match-count': 20,
      'orb-match-ratio-threshold': 0.75,
      'parallel-recognition-enabled': 'true',
      'parallel-dhash-weight': 0.3,
      'parallel-phash-weight': 0.35,
      'parallel-orb-weight': 0.35,
      'parallel-min-confidence': 0.6,
    },
    featureFlags: {
      'rectangle-detection': true,
    },
  },
];

/**
 * Feature Flags Configuration
 *
 * Boolean toggles that enable/disable experimental and creative features.
 * These appear in the "Feature Flags" section of the secret settings menu.
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
    enabled: true,
    category: 'experimental',
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
    id: 'grayscale-mode',
    name: 'Grayscale Conversion',
    description:
      'Convert camera frames to black and white before photo recognition. May improve accuracy since printed reference photos are monochrome, and can reduce noise in low-light conditions.',
    enabled: false,
    category: 'experimental',
  },
];

/**
 * Custom Settings Configuration
 *
 * Adjustable parameters that allow fine-tuning of app behavior.
 * These appear in the "Custom Settings" section of the secret settings menu.
 */
export const CUSTOM_SETTINGS: CustomSetting[] = [
  {
    id: CONFIG_PROFILE_SETTING_ID,
    name: 'Config Profile',
    description:
      'Apply the baseline presets from the Photo Recognition Deep Dive. Manual changes switch back to Custom.',
    type: 'select',
    value: 'custom',
    options: CONFIG_PROFILES.map((profile) => ({
      label: profile.label,
      value: profile.id,
    })),
    category: 'recognition',
  },
  {
    id: 'theme-mode',
    name: 'Theme Mode',
    description: 'Switch between light and dark visual themes',
    type: 'select',
    value: 'dark',
    options: [
      { label: 'Dark', value: 'dark' },
      { label: 'Light', value: 'light' },
    ],
    category: 'ui',
  },
  {
    id: 'ui-style',
    name: 'UI Style',
    description: 'Toggle between modern UI and classic retro gallery experience',
    type: 'select',
    value: 'modern',
    options: [
      { label: 'Modern', value: 'modern' },
      { label: 'Classic', value: 'classic' },
    ],
    category: 'ui',
  },
  {
    id: 'recognition-delay',
    name: 'Recognition Delay',
    description: 'Adjust how long a photo must stay steady before it is considered a match',
    type: 'number',
    value: 1000,
    min: 500,
    max: 5000,
    step: 100,
    unit: 'ms',
    category: 'recognition',
  },
  {
    id: 'similarity-threshold',
    name: 'Similarity Threshold',
    description:
      'Lower values demand closer matches (stricter). Recommended: dHash 24-28, pHash 10-14.',
    type: 'number',
    value: 24,
    min: 4,
    max: 120,
    step: 2,
    unit: 'dist',
    category: 'recognition',
  },
  {
    id: 'recognition-mode',
    name: 'Recognition Engine',
    description: 'Choose recognition algorithm: perceptual hash, ORB, or parallel multi-algorithm.',
    type: 'select',
    value: 'perceptual',
    options: [
      { label: 'Perceptual Hash (dHash + pHash)', value: 'perceptual' },
      { label: 'ORB Feature Matching', value: 'orb' },
      { label: 'Parallel (dHash + pHash + ORB)', value: 'parallel' },
    ],
    category: 'recognition',
  },
  {
    id: 'hash-algorithm',
    name: 'Perceptual Hash Algorithm',
    description: 'Controls the active hash when the recognition engine is set to Perceptual.',
    type: 'select',
    value: 'phash',
    options: [
      { label: 'pHash (robust, default)', value: 'phash' },
      { label: 'dHash (fastest)', value: 'dhash' },
    ],
    category: 'recognition',
  },
  {
    id: 'recognition-check-interval',
    name: 'Frame Scan Interval',
    description: 'How often frames are hashed (lower = more responsive, higher = lower CPU use).',
    type: 'number',
    value: 250,
    min: 250,
    max: 2000,
    step: 50,
    unit: 'ms',
    category: 'performance',
  },
  {
    id: 'sharpness-threshold',
    name: 'Sharpness Threshold',
    description:
      'Minimum Laplacian variance required to accept a frame (higher = stricter about blur).',
    type: 'number',
    value: 100,
    min: 20,
    max: 400,
    step: 10,
    unit: 'variance',
    category: 'recognition',
  },
  {
    id: 'glare-threshold',
    name: 'Glare Pixel Threshold',
    description: 'Pixel brightness above this value counts as blown-out glare.',
    type: 'number',
    value: 250,
    min: 180,
    max: 255,
    step: 5,
    unit: 'px',
    category: 'recognition',
  },
  {
    id: 'glare-percentage-threshold',
    name: 'Glare Coverage Threshold',
    description: 'Percentage of pixels that can be blown out before we skip the frame.',
    type: 'number',
    value: 20,
    min: 5,
    max: 60,
    step: 1,
    unit: '%',
    category: 'recognition',
  },
  {
    id: 'rectangle-detection-confidence-threshold',
    name: 'Rectangle Detection Confidence',
    description:
      'Minimum confidence (0-1) for rectangle detection to be considered valid. Higher = stricter.',
    type: 'number',
    value: 0.6,
    min: 0.3,
    max: 0.9,
    step: 0.05,
    unit: '',
    category: 'recognition',
  },
  {
    id: 'orb-max-features',
    name: 'ORB Max Features',
    description: 'Upper bound on FAST keypoints to keep when ORB is enabled.',
    type: 'number',
    value: 500,
    min: 100,
    max: 1000,
    step: 50,
    unit: 'pts',
    category: 'recognition',
  },
  {
    id: 'orb-fast-threshold',
    name: 'ORB FAST Threshold',
    description: 'Lower values detect more keypoints but are noisier. Default: 20.',
    type: 'number',
    value: 20,
    min: 5,
    max: 40,
    step: 1,
    unit: '',
    category: 'recognition',
  },
  {
    id: 'orb-min-match-count',
    name: 'ORB Min Matches',
    description: 'Minimum descriptor matches required before declaring success.',
    type: 'number',
    value: 20,
    min: 10,
    max: 60,
    step: 1,
    unit: '',
    category: 'recognition',
  },
  {
    id: 'orb-match-ratio-threshold',
    name: 'ORB Match Ratio',
    description: 'Lowe’s ratio threshold (0-1). Lower values are stricter comparisons.',
    type: 'number',
    value: 0.7,
    min: 0.5,
    max: 0.95,
    step: 0.05,
    unit: '',
    category: 'recognition',
  },
  {
    id: 'parallel-recognition-enabled',
    name: 'Enable Parallel Recognition',
    description:
      'Run dhash, phash, and ORB simultaneously with weighted voting for improved accuracy.',
    type: 'select',
    value: 'false',
    options: [
      { label: 'Disabled', value: 'false' },
      { label: 'Enabled', value: 'true' },
    ],
    category: 'recognition',
  },
  {
    id: 'parallel-dhash-weight',
    name: 'Parallel dHash Weight',
    description: 'Weight for dHash algorithm in parallel voting (fast but less robust).',
    type: 'number',
    value: 0.3,
    min: 0,
    max: 1,
    step: 0.05,
    unit: '',
    category: 'recognition',
  },
  {
    id: 'parallel-phash-weight',
    name: 'Parallel pHash Weight',
    description: 'Weight for pHash algorithm in parallel voting (robust to lighting/angles).',
    type: 'number',
    value: 0.35,
    min: 0,
    max: 1,
    step: 0.05,
    unit: '',
    category: 'recognition',
  },
  {
    id: 'parallel-orb-weight',
    name: 'Parallel ORB Weight',
    description: 'Weight for ORB algorithm in parallel voting (most robust but slower).',
    type: 'number',
    value: 0.35,
    min: 0,
    max: 1,
    step: 0.05,
    unit: '',
    category: 'recognition',
  },
  {
    id: 'parallel-min-confidence',
    name: 'Parallel Min Confidence',
    description: 'Minimum combined confidence (0-1) required for a match in parallel mode.',
    type: 'number',
    value: 0.6,
    min: 0.3,
    max: 0.95,
    step: 0.05,
    unit: '',
    category: 'recognition',
  },
];
