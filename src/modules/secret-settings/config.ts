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
    description: 'Choose between dHash/pHash combo or ORB feature matching.',
    type: 'select',
    value: 'perceptual',
    options: [
      { label: 'Perceptual Hash (dHash + pHash)', value: 'perceptual' },
      { label: 'ORB Feature Matching', value: 'orb' },
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
];
