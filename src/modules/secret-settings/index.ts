/**
 * Secret Settings Module
 *
 * Provides a hidden menu accessible via the Settings button.
 * Designed to hold feature flags for advanced users.
 *
 * @module secret-settings
 */

export { SecretSettings } from './SecretSettings';
export { useFeatureFlags } from './useFeatureFlags';
export type { SecretSettingsProps, FeatureFlag } from './types';
