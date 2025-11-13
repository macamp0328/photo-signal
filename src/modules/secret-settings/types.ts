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
  category?: 'experimental' | 'debugging' | 'ui' | 'audio' | 'camera';
}

/**
 * Custom Setting Definition
 *
 * Example structure for future custom settings.
 * This is a placeholder for documentation purposes.
 */
export interface CustomSetting {
  /**
   * Unique identifier for the setting
   */
  id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Description of what this setting controls
   */
  description: string;

  /**
   * Type of the setting value
   */
  type: 'boolean' | 'number' | 'string' | 'select';

  /**
   * Current value
   */
  value: string | number | boolean;

  /**
   * Optional options for select type
   */
  options?: Array<{ label: string; value: string | number }>;

  /**
   * Optional min/max for number type
   */
  min?: number;
  max?: number;

  /**
   * Optional category for organization
   */
  category?: string;
}
