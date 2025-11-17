/**
 * Custom Settings Configuration
 *
 * Define all custom settings here. These allow users to adjust
 * numeric, string, or select values for advanced parameters.
 */

import type { CustomSetting } from './types';

/**
 * Custom settings configuration
 * Add new settings to this array to make them available in the UI
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
    value: 3000,
    min: 1000,
    max: 5000,
    step: 250,
    unit: 'ms',
    category: 'recognition',
  },
  {
    id: 'hash-algorithm',
    name: 'Hash Algorithm',
    description: 'Switch between dHash (fast) and pHash (more robust to lighting/angles)',
    type: 'select',
    value: 'dhash',
    options: [
      { label: 'dHash – Fast', value: 'dhash' },
      { label: 'pHash – Robust', value: 'phash' },
    ],
    category: 'recognition',
  },
  {
    id: 'similarity-threshold',
    name: 'Similarity Threshold',
    description:
      'Lower values demand closer matches (stricter). Raise to allow more variance between hashes.',
    type: 'number',
    value: 40,
    min: 10,
    max: 120,
    step: 2,
    unit: 'dist',
    category: 'recognition',
  },
  {
    id: 'recognition-check-interval',
    name: 'Frame Scan Interval',
    description: 'How often frames are hashed (lower = more responsive, higher = lower CPU use).',
    type: 'number',
    value: 1000,
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
];
