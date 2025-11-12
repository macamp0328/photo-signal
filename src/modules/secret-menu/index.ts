/**
 * Secret Menu Module
 *
 * A hidden menu activated by triple-tapping the center of the screen.
 * Provides access to feature flags and custom settings for advanced users.
 *
 * @module secret-menu
 */

export { SecretMenu } from './SecretMenu';
export { useTripleTap } from './useTripleTap';
export type {
  FeatureFlag,
  CustomSetting,
  SecretMenuProps,
  UseTripleTapReturn,
  TripleTapOptions,
} from './types';
