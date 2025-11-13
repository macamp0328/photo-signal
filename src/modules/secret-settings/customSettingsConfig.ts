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
];
