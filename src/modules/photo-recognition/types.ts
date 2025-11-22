import type { Concert, AspectRatio as AspectRatioType } from '../../types';
import type { DetectedRectangle } from '../photo-rectangle-detection';

/**
 * Photo Recognition Module Types
 */

export type AspectRatio = AspectRatioType;

/**
 * Best match information for debugging
 */
export interface BestMatchInfo {
  concert: Concert;
  distance: number;
  similarity: number;
  algorithm?: HashAlgorithm;
  scale?: number;
}

export interface StabilityDebugInfo {
  concert: Concert;
  elapsedMs: number;
  remainingMs: number;
  requiredMs: number;
  progress: number;
}

export interface FrameSizeInfo {
  width: number;
  height: number;
}

/**
 * Frame quality metrics for motion blur and glare detection
 */
export interface FrameQualityInfo {
  /** Laplacian variance (sharpness metric) */
  sharpness: number;
  /** Whether frame is sharp enough for recognition */
  isSharp: boolean;
  /** Percentage of blown-out pixels (glare) */
  glarePercentage: number;
  /** Whether frame has significant glare */
  hasGlare: boolean;
  /** Average brightness (0-255) for lighting detection */
  averageBrightness?: number;
  /** Whether frame has poor lighting */
  hasPoorLighting?: boolean;
  /** Type of lighting issue if any */
  lightingType?: 'underexposed' | 'overexposed' | 'ok';
}

/**
 * Failure categories for recognition diagnostics
 */
export type FailureCategory =
  | 'motion-blur'
  | 'glare'
  | 'poor-quality'
  | 'no-match'
  | 'collision'
  | 'unknown';

/**
 * Failure diagnostic information
 * Note: frameHash may be 'N/A' when hash computation was skipped due to quality issues (blur/glare)
 */
export interface FailureDiagnostic {
  category: FailureCategory;
  reason: string;
  frameHash: string; // May be 'N/A' if hash not computed due to quality rejection
  timestamp: number;
}

/**
 * Telemetry metrics for tracking frame rejection reasons and guidance effectiveness
 */
export interface RecognitionTelemetry {
  /** Total frames processed */
  totalFrames: number;
  /** Frames rejected due to motion blur */
  blurRejections: number;
  /** Frames rejected due to glare */
  glareRejections: number;
  /** Frames rejected due to poor lighting */
  lightingRejections: number;
  /** Frames that passed quality checks */
  qualityFrames: number;
  /** Successful recognitions */
  successfulRecognitions: number;
  /** Failed recognition attempts (quality frame but no match) */
  failedAttempts: number;
  /** Failure history (last 10 failures) */
  failureHistory: FailureDiagnostic[];
  /** Categorized failure counts */
  failureByCategory: Record<FailureCategory, number>;
  /** Guidance tracking */
  guidanceTracking: {
    /** Number of times each guidance type was shown */
    shown: Record<GuidanceType, number>;
    /** Total time in each guidance state (ms) */
    duration: Record<GuidanceType, number>;
    /** Last time each guidance was shown (timestamp) */
    lastShown: Record<GuidanceType, number>;
  };
}

/**
 * Debug information from photo recognition
 */
export type HashAlgorithm = 'dhash' | 'phash';

export interface RecognitionDebugInfo {
  /** Last computed frame hash */
  lastFrameHash: string | null;
  /** Best match found in last check */
  bestMatch: BestMatchInfo | null;
  /** Timestamp of last frame check */
  lastCheckTime: number;
  /** Number of concerts being checked */
  concertCount: number;
  /** Total frames processed since start */
  frameCount: number;
  /** Interval between frame checks (ms) */
  checkInterval: number;
  /** Aspect ratio currently in use */
  aspectRatio: AspectRatio;
  /** Cropped frame size */
  frameSize: FrameSizeInfo | null;
  /** Stability timer info for the current candidate */
  stability: StabilityDebugInfo | null;
  /** Active similarity threshold */
  similarityThreshold: number;
  /** Active recognition delay (ms) */
  recognitionDelay: number;
  /** Frame quality metrics (sharpness, glare) */
  frameQuality: FrameQualityInfo | null;
  /** Recognition telemetry metrics */
  telemetry: RecognitionTelemetry;
  /** Hash algorithm currently in use */
  hashAlgorithm: HashAlgorithm;
}

export interface PhotoRecognitionHook {
  /** Recognized concert, null if none */
  recognizedConcert: Concert | null;
  /** True during recognition process */
  isRecognizing: boolean;
  /** Reset recognition state */
  reset: () => void;
  /** Debug information (only populated in dev mode or test mode) */
  debugInfo: RecognitionDebugInfo | null;
  /** Current frame quality status (for UI feedback) */
  frameQuality: FrameQualityInfo | null;
  /** Active guidance type (for real-time user feedback) */
  activeGuidance: GuidanceType;
  /** Detected rectangle (when rectangle detection is enabled) */
  detectedRectangle: DetectedRectangle | null;
  /** Rectangle detection confidence (0-1) */
  rectangleConfidence: number;
}

/**
 * Guidance types for user feedback
 */
export type GuidanceType =
  | 'motion-blur'
  | 'glare'
  | 'poor-lighting'
  | 'distance'
  | 'off-center'
  | 'none';

export interface PhotoRecognitionOptions {
  /** Delay before triggering recognition (ms), default 3000 */
  recognitionDelay?: number;
  /** Enable/disable recognition, default true */
  enabled?: boolean;
  /** Hamming distance threshold for matching (0-64), default 10 */
  similarityThreshold?: number;
  /** Interval for checking frames (ms), default 1000 */
  checkInterval?: number;
  /** Enable debug information output, default false */
  enableDebugInfo?: boolean;
  /** Aspect ratio for frame cropping (default 'auto' chooses based on video orientation) */
  aspectRatio?: AspectRatio;
  /** Sharpness threshold for blur detection (default 100) */
  sharpnessThreshold?: number;
  /** Glare detection threshold for blown-out pixels (default 250) */
  glareThreshold?: number;
  /** Percentage of image that must be blown out to trigger glare detection (default 20) */
  glarePercentageThreshold?: number;
  /** Minimum brightness for underexposure detection (default 50) */
  minBrightness?: number;
  /** Maximum brightness for overexposure detection (default 220) */
  maxBrightness?: number;
  /** Hash algorithm to use: 'dhash' or 'phash' (default 'dhash') */
  hashAlgorithm?: HashAlgorithm;
  /** Enable multi-scale recognition for imprecise framing (default false) */
  enableMultiScale?: boolean;
  /** Scale variants to try when multi-scale is enabled (default [0.75, 0.8, 0.85, 0.9]) */
  multiScaleVariants?: number[];
  /** Enable dynamic rectangle detection (default false) */
  enableRectangleDetection?: boolean;
  /** Minimum confidence (0-1) before using detected rectangle for cropping (default 0.6) */
  rectangleConfidenceThreshold?: number;
  /** Optional secondary hash algorithm to run as a fallback (e.g., pHash after dHash) */
  secondaryHashAlgorithm?: HashAlgorithm | null;
  /** Similarity threshold to use for the secondary algorithm (defaults to algorithm-appropriate value) */
  secondarySimilarityThreshold?: number;
}
