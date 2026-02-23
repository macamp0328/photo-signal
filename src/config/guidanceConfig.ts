/**
 * Guidance Configuration
 *
 * Centralized configuration for real-time user guidance messages.
 * All guidance thresholds, messages, and behaviors are defined here.
 *
 * Historical guidance assumptions based on earlier recognition experiments.
 * Current runtime behavior and thresholds are documented in docs/PHOTO_RECOGNITION_DEEP_DIVE.md.
 * - Motion blur affects ~25% of recognition attempts
 * - Extreme angles affect ~20% of attempts
 * - Poor lighting affects ~15% of attempts
 * - Glare affects ~15% of attempts
 */

export type GuidanceType =
  | 'motion-blur'
  | 'glare'
  | 'poor-lighting'
  | 'ambiguous-match'
  | 'distance'
  | 'off-center'
  | 'none';

export interface GuidanceMessage {
  /** Icon to display (emoji or symbol) */
  icon: string;
  /** Short guidance text */
  text: string;
  /** Optional longer explanation */
  detail?: string;
  /** Priority level (higher = more important to show) */
  priority: number;
}

export interface GuidanceThresholds {
  /** Sharpness threshold for motion blur detection (Laplacian variance) */
  sharpness: number;
  /** Brightness threshold for blown-out pixels (glare detection) */
  glarePixelThreshold: number;
  /** Percentage of pixels that must be blown out to trigger glare warning */
  glarePercentageThreshold: number;
  /** Minimum average brightness (0-255) for underexposure */
  minBrightness: number;
  /** Maximum average brightness (0-255) for overexposure */
  maxBrightness: number;
  /** Minimum percentage of frame that photo should fill */
  minFrameFillPercentage: number;
  /** Maximum percentage of frame that photo should fill */
  maxFrameFillPercentage: number;
  /** Maximum horizontal offset from center as percentage of frame width */
  maxHorizontalOffsetPercentage: number;
  /** Maximum vertical offset from center as percentage of frame height */
  maxVerticalOffsetPercentage: number;
}

export interface GuidanceConfig {
  /** Whether guidance is enabled globally */
  enabled: boolean;
  /** Guidance messages for each type */
  messages: Record<GuidanceType, GuidanceMessage>;
  /** Detection thresholds */
  thresholds: GuidanceThresholds;
  /** How long to show each guidance message (ms) */
  displayDuration: number;
  /** Minimum time between showing same guidance message (ms) */
  cooldownDuration: number;
  /** Enable haptic feedback on mobile */
  enableHaptics: boolean;
  /** Enable audio cues */
  enableAudioCues: boolean;
  /** Show guidance in production (false = Test Mode only) */
  showInProduction: boolean;
}

/**
 * Default guidance configuration
 *
 * Thresholds are legacy guidance defaults kept for compatibility with GuidanceMessage.
 */
export const defaultGuidanceConfig: GuidanceConfig = {
  enabled: true,

  messages: {
    'motion-blur': {
      icon: '📹',
      text: 'Hold steady',
      detail: 'Keep the camera still for better recognition',
      priority: 5,
    },
    glare: {
      icon: '✨',
      text: 'Tilt to avoid glare',
      detail: 'Adjust the angle to reduce reflections',
      priority: 4,
    },
    'poor-lighting': {
      icon: '💡',
      text: 'Improve lighting',
      detail: 'Move to better lighting or adjust exposure',
      priority: 3,
    },
    'ambiguous-match': {
      icon: '🖼️',
      text: 'Center one photo',
      detail: 'Multiple nearby photos look similar. Fill the frame with one print.',
      priority: 3,
    },
    distance: {
      icon: '🔍',
      text: 'Move closer',
      detail: 'Fill the frame guide with the photo',
      priority: 3,
    },
    'off-center': {
      icon: '🎯',
      text: 'Center the photo',
      detail: 'Position the photo in the center of the frame guide',
      priority: 2,
    },
    none: {
      icon: '✓',
      text: '',
      detail: '',
      priority: 0,
    },
  },

  thresholds: {
    // Motion blur: Laplacian variance threshold (default 100)
    // Values below this indicate motion blur
    sharpness: 100,

    // Glare: Pixel brightness threshold for detecting blown-out areas
    glarePixelThreshold: 250,

    // Glare: Percentage of frame that must be blown out (default 20%)
    glarePercentageThreshold: 20,

    // Poor lighting: Minimum average brightness (underexposed)
    // Average pixel brightness below this indicates underexposure
    minBrightness: 50,

    // Poor lighting: Maximum average brightness (overexposed)
    // Average pixel brightness above this indicates overexposure
    maxBrightness: 220,

    // Distance: Photo should fill 40-90% of the frame guide
    minFrameFillPercentage: 40,
    maxFrameFillPercentage: 90,

    // Centering: Photo should be within 20% of frame center
    maxHorizontalOffsetPercentage: 20,
    maxVerticalOffsetPercentage: 20,
  },

  // Display guidance for 3 seconds
  displayDuration: 3000,

  // Wait 5 seconds before showing same guidance again
  cooldownDuration: 5000,

  // Haptic feedback disabled by default
  enableHaptics: false,

  // Audio cues disabled by default
  enableAudioCues: false,

  // Show guidance in both production and Test Mode
  showInProduction: true,
};

/**
 * Get guidance message priority
 */
export function getGuidancePriority(type: GuidanceType, config: GuidanceConfig): number {
  return config.messages[type].priority;
}

/**
 * Determine which guidance to show based on priority
 * Returns the highest priority guidance type from the given array
 */
export function selectGuidanceToShow(
  activeGuidanceTypes: GuidanceType[],
  config: GuidanceConfig
): GuidanceType {
  if (activeGuidanceTypes.length === 0) {
    return 'none';
  }

  // Sort by priority (highest first)
  const sorted = activeGuidanceTypes.sort((a, b) => {
    return getGuidancePriority(b, config) - getGuidancePriority(a, config);
  });

  return sorted[0];
}
