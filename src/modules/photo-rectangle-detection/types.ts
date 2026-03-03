/**
 * Photo Rectangle Detection Types
 *
 * Defines interfaces for rectangle detection in camera feed
 */

/**
 * Represents a detected rectangle's corner points
 * Coordinates are normalized to [0, 1] range relative to frame dimensions
 */
export interface DetectedRectangle {
  /** Top-left corner (normalized 0-1) */
  topLeft: { x: number; y: number };
  /** Top-right corner (normalized 0-1) */
  topRight: { x: number; y: number };
  /** Bottom-right corner (normalized 0-1) */
  bottomRight: { x: number; y: number };
  /** Bottom-left corner (normalized 0-1) */
  bottomLeft: { x: number; y: number };
  /** Width of detected rectangle (normalized 0-1) */
  width: number;
  /** Height of detected rectangle (normalized 0-1) */
  height: number;
  /** Aspect ratio (width / height) */
  aspectRatio: number;
}

/**
 * Result of rectangle detection operation
 */
export interface RectangleDetectionResult {
  /** Detected rectangle, or null if no rectangle found */
  rectangle: DetectedRectangle | null;
  /** Confidence score (0-1) indicating detection quality */
  confidence: number;
  /** Whether detection succeeded */
  detected: boolean;
  /** Timestamp when detection was performed */
  timestamp: number;
}

export interface RectangleRoiHint {
  /** ROI center in normalized viewport coordinates (0-1). */
  center: { x: number; y: number };
  /** Radius in normalized viewport units (0-1). */
  radius: number;
  /** Time elapsed since tap, used to decay ROI influence. */
  ageMs: number;
  /** Lock strength in range [0, 1]. */
  lockStrength?: number;
}

/**
 * Configuration options for rectangle detection
 */
export interface RectangleDetectionOptions {
  /** Minimum area threshold (normalized 0-1, default: 0.1) */
  minArea?: number;
  /** Maximum area threshold (normalized 0-1, default: 0.9) */
  maxArea?: number;
  /** Minimum aspect ratio for valid rectangles (default: 0.5) */
  minAspectRatio?: number;
  /** Maximum aspect ratio for valid rectangles (default: 2.5) */
  maxAspectRatio?: number;
  /** Canny edge detection high threshold (default: 150) */
  cannyHighThreshold?: number;
  /** Minimum confidence score to accept detection (default: 0.6) */
  minConfidence?: number;
}

/**
 * Detection state for UI feedback
 */
export type DetectionState = 'idle' | 'detecting' | 'detected' | 'error';
