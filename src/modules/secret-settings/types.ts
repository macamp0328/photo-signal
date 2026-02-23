/**
 * Secret Settings Module - Type Definitions
 *
 * This module provides types for the hidden secret menu
 * activated by triple-tap/click gestures.
 */

/**
 * Hook for detecting triple-tap/click gestures
 */
export interface UseTripleTapOptions {
  /**
   * Timeout between taps/clicks in milliseconds
   * @default 500
   */
  tapTimeout?: number;

  /**
   * Callback when triple-tap is detected
   */
  onTripleTap: () => void;
}

/**
 * Secret Settings Page Props
 */
export interface SecretSettingsProps {
  /**
   * Whether the settings page is visible
   */
  isVisible: boolean;

  /**
   * Callback to close the settings page
   */
  onClose: () => void;
}

/**
 * Feature Flag Definition
 *
 * Example structure for future feature flags.
 * This is a placeholder for documentation purposes.
 */
export interface FeatureFlag {
  /**
   * Unique identifier for the feature flag
   */
  id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Description of what this flag controls
   */
  description: string;

  /**
   * Current state of the flag
   */
  enabled: boolean;

  /**
   * Optional category for organization
   */
  category?: 'experimental' | 'debugging' | 'ui' | 'audio' | 'camera' | 'development';
}
