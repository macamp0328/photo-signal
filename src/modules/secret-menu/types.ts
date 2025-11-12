/**
 * Secret Menu Module Types
 *
 * Type definitions for the hidden secret menu system,
 * including feature flags and custom settings.
 */

/**
 * Feature flag definition
 * Used to enable/disable experimental features
 */
export interface FeatureFlag {
  /** Unique identifier for the feature flag */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this flag controls */
  description: string;
  /** Current enabled/disabled state */
  enabled: boolean;
  /** Optional category for grouping flags */
  category?: string;
}

/**
 * Custom setting definition
 * Used for user-configurable app settings
 */
export interface CustomSetting {
  /** Unique identifier for the setting */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what this setting controls */
  description: string;
  /** Setting type determines the UI control */
  type: 'boolean' | 'number' | 'string' | 'select';
  /** Current value */
  value: boolean | number | string;
  /** Optional: Available options for select type */
  options?: string[];
  /** Optional: Min/max for number type */
  min?: number;
  max?: number;
  /** Optional category for grouping settings */
  category?: string;
}

/**
 * Props for the SecretMenu component
 */
export interface SecretMenuProps {
  /** Whether the menu is currently visible */
  isOpen: boolean;
  /** Callback to close the menu */
  onClose: () => void;
  /** Optional: Feature flags to display */
  featureFlags?: FeatureFlag[];
  /** Optional: Custom settings to display */
  customSettings?: CustomSetting[];
  /** Optional: Callback when a feature flag is toggled */
  onFeatureFlagToggle?: (flagId: string, enabled: boolean) => void;
  /** Optional: Callback when a setting is changed */
  onSettingChange?: (settingId: string, value: boolean | number | string) => void;
}

/**
 * Return type for the useTripleTap hook
 */
export interface UseTripleTapReturn {
  /** Handler to attach to the element for click/tap detection */
  onInteraction: (event: React.MouseEvent | React.TouchEvent) => void;
  /** Number of taps in the current sequence */
  tapCount: number;
  /** Reset the tap counter */
  reset: () => void;
}

/**
 * Options for configuring triple-tap detection
 */
export interface TripleTapOptions {
  /** Maximum time (ms) between taps to count as sequence (default: 500) */
  timeout?: number;
  /** Target area as percentage of viewport (default: 0.2 = center 20%) */
  targetArea?: number;
}
