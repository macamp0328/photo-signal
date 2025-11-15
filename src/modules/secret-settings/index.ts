/**
 * Secret Settings Module
 *
 * Provides a hidden menu activated by triple-tap/click gestures.
 * Designed to hold feature flags and custom settings for advanced users.
 *
 * @module secret-settings
 */

export { SecretSettings } from './SecretSettings';
export { useTripleTap } from './useTripleTap';
export { useFeatureFlags } from './useFeatureFlags';
export { useCustomSettings } from './useCustomSettings';
export { useRetroSounds } from './useRetroSounds';
export { PsychedelicEffect } from './PsychedelicEffect';
export type { UseTripleTapOptions, SecretSettingsProps, FeatureFlag, CustomSetting } from './types';
