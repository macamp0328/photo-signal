/**
 * Secret Menu Module - Type Definitions
 *
 * Defines interfaces for the secret menu and triple tap detection.
 */

/**
 * Configuration for triple tap detection
 */
export interface TripleTapConfig {
  /**
   * Maximum time (ms) between taps to count as triple tap
   * @default 500
   */
  maxDelay?: number;

  /**
   * Target area for tap detection ('center' or 'anywhere')
   * @default 'center'
   */
  targetArea?: 'center' | 'anywhere';

  /**
   * Percentage of screen width/height to consider as "center"
   * Only applies when targetArea is 'center'
   * @default 0.3 (30% of screen)
   */
  centerThreshold?: number;
}

/**
 * Return type for useTripleTap hook
 */
export interface TripleTapHook {
  /**
   * Whether triple tap was detected
   */
  isTripleTap: boolean;

  /**
   * Reset the triple tap state
   */
  reset: () => void;
}

/**
 * Props for SecretMenu component
 */
export interface SecretMenuProps {
  /**
   * Whether the menu is visible
   */
  isOpen: boolean;

  /**
   * Callback when menu should be closed
   */
  onClose: () => void;
}

/**
 * Feature flag structure (for future implementation)
 * This interface defines how feature flags should be structured
 * when they are implemented in the future.
 */
export interface FeatureFlag {
  /**
   * Unique identifier for the flag
   */
  id: string;

  /**
   * Display name shown in UI
   */
  name: string;

  /**
   * Description of what this flag controls
   */
  description: string;

  /**
   * Current value of the flag
   */
  enabled: boolean;

  /**
   * Category for grouping flags
   */
  category?: string;
}

/**
 * Custom setting structure (for future implementation)
 */
export interface CustomSetting {
  /**
   * Unique identifier for the setting
   */
  id: string;

  /**
   * Display name shown in UI
   */
  name: string;

  /**
   * Description of what this setting controls
   */
  description: string;

  /**
   * Type of setting value
   */
  type: 'boolean' | 'number' | 'string' | 'select';

  /**
   * Current value of the setting
   */
  value: boolean | number | string;

  /**
   * Options for select type
   */
  options?: string[];

  /**
   * Min/max for number type
   */
  min?: number;
  max?: number;
}
