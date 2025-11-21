/**
 * Photo Rectangle Detection Module
 *
 * Provides computer vision-based rectangle detection for identifying
 * printed photographs in camera frames.
 *
 * @module photo-rectangle-detection
 */

export { RectangleDetectionService } from './RectangleDetectionService';
export { RectangleOverlay } from './RectangleOverlay';
export type {
  DetectedRectangle,
  RectangleDetectionResult,
  RectangleDetectionOptions,
  DetectionState,
} from './types';
