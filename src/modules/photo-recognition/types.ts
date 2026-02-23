import type { Concert, AspectRatio as AspectRatioType } from '../../types';
import type { DetectedRectangle } from '../photo-rectangle-detection';

export type AspectRatio = AspectRatioType;
export type HashAlgorithm = 'phash';

export interface BestMatchInfo {
  concert: Concert;
  distance: number;
  similarity: number;
  algorithm?: HashAlgorithm;
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

export interface FrameQualityInfo {
  sharpness: number;
  isSharp: boolean;
  glarePercentage: number;
  hasGlare: boolean;
  averageBrightness?: number;
  hasPoorLighting?: boolean;
  lightingType?: 'underexposed' | 'overexposed' | 'ok';
}

export type FailureCategory =
  | 'motion-blur'
  | 'glare'
  | 'poor-quality'
  | 'no-match'
  | 'collision'
  | 'unknown';

export interface FailureDiagnostic {
  category: FailureCategory;
  reason: string;
  frameHash: string;
  timestamp: number;
}

export interface FrameQualityStats {
  blur: { sharpnessSum: number; sampleCount: number };
  glare: { glarePercentSum: number; sampleCount: number };
  lighting: { brightnessSum: number; sampleCount: number };
}

export interface NearMissEntry {
  distance: number;
  frameHash: string;
  timestamp: number;
  thresholdUsed?: number;
  mode?: 'initial' | 'switch';
}

export interface HammingDistanceLog {
  /** Frames whose best-match distance was just above the threshold (capped at 20). */
  nearMisses: NearMissEntry[];
  matchedFrameDistances: {
    min: number | null;
    max: number | null;
    sum: number;
    count: number;
  };
}

export interface CollisionMarginHistogram {
  '0-1': number;
  '2': number;
  '3-4': number;
  '5+': number;
  unknown: number;
}

export interface CollisionStats {
  /** Collision failures caused by low best-vs-second margin while within threshold. */
  ambiguousCount: number;
  /** Collision failures caused by weak out-of-threshold best matches near the boundary. */
  nearThresholdCount: number;
  /** Margin distribution for ambiguous collisions. */
  ambiguousMarginHistogram: CollisionMarginHistogram;
  /** Frequency map for ambiguous pairings: "Best vs Second" -> count. */
  ambiguousPairCounts: Record<string, number>;
}

/**
 * A cumulative telemetry snapshot taken mid-recording for trend analysis.
 * Captured at t=10s and t=20s during a 30-second session.
 */
export interface TemporalTelemetrySnapshot {
  /** Seconds elapsed since recording started when this snapshot was taken. */
  elapsedSeconds: number;
  cumulativeCounts: {
    totalFrames: number;
    qualityFrames: number;
    blurRejections: number;
    glareRejections: number;
    lightingRejections: number;
    successfulRecognitions: number;
    failedAttempts: number;
    instantConfirmations: number;
    qualityBypassFrames: number;
  };
}

export interface RecognitionTelemetry {
  totalFrames: number;
  blurRejections: number;
  glareRejections: number;
  lightingRejections: number;
  qualityFrames: number;
  qualityBypassFrames?: number;
  successfulRecognitions: number;
  instantConfirmations?: number;
  failedAttempts: number;
  failureHistory: FailureDiagnostic[];
  failureByCategory: Record<FailureCategory, number>;
  /** Running sums and counts for quality measurements of rejected frames. */
  frameQualityStats: FrameQualityStats;
  /** Hamming distance distribution for quality-passing frames. */
  hammingDistanceLog: HammingDistanceLog;
  /** Detailed collision diagnostics to improve telemetry-driven tuning. */
  collisionStats: CollisionStats;
  /** Frames evaluated while recognition index mode is active. */
  index_mode_used?: number;
  /** Frames that fell back from bucketed candidate scan to full scan. */
  fallback_mode_used?: number;
  /** Candidate comparisons executed per frame in pass-1 matching. */
  candidate_count_per_frame?: {
    last: number;
    max: number;
    total: number;
    frames: number;
  };
}

export interface RecognitionDebugInfo {
  lastFrameHash: string | null;
  bestMatch: BestMatchInfo | null;
  secondBestMatch: BestMatchInfo | null;
  bestMatchMargin: number | null;
  lastCheckTime: number;
  concertCount: number;
  frameCount: number;
  checkInterval: number;
  aspectRatio: AspectRatio;
  frameSize: FrameSizeInfo | null;
  stability: StabilityDebugInfo | null;
  similarityThreshold: number;
  recognitionDelay: number;
  frameQuality: FrameQualityInfo | null;
  telemetry: RecognitionTelemetry;
  hashAlgorithm: HashAlgorithm;
}

export interface PhotoRecognitionHook {
  recognizedConcert: Concert | null;
  isRecognizing: boolean;
  reset: () => void;
  resetTelemetry: () => void;
  debugInfo: RecognitionDebugInfo | null;
  frameQuality: FrameQualityInfo | null;
  detectedRectangle: DetectedRectangle | null;
  rectangleConfidence: number;
}

export interface PhotoRecognitionOptions {
  /** Delay (ms) before confirming a borderline match (distance 11–14). Default: 200.
   *  Strong matches (distance ≤ 10) are confirmed instantly, bypassing this delay.
   *  See docs/PHOTO_RECOGNITION_DEEP_DIVE.md before tuning any threshold values. */
  recognitionDelay?: number;
  /** Enable/disable recognition processing. Default: true */
  enabled?: boolean;
  /** pHash Hamming distance threshold — frames at or below this are match candidates. Default: 14.
   *  Empirically tuned; changing requires re-running the field evaluation in PHOTO_RECOGNITION_DEEP_DIVE.md. */
  similarityThreshold?: number;
  /** Minimum gap between best and second-best match distance (ambiguity guard). Default: 4 */
  matchMarginThreshold?: number;
  /** Continue scanning after a confirmed match so a new target can be detected. Default: false */
  continuousRecognition?: boolean;
  /** Frame sampling interval (ms). Adaptive: ~80ms while tracking, ~120ms idle. Default: 120 */
  checkInterval?: number;
  /** Collect and return debug telemetry. Default: false.
   *  Enable only while the debug overlay is open to avoid unnecessary computation. */
  enableDebugInfo?: boolean;
  /** Expected aspect ratio of the target photo. Default: 'auto' */
  aspectRatio?: AspectRatio;
  /** Minimum Laplacian variance to accept a frame as sharp. Default: 100 */
  sharpnessThreshold?: number;
  /** Pixel brightness level above which a pixel counts toward glare. Default: 250 */
  glareThreshold?: number;
  /** Maximum percentage of glare pixels before a frame is rejected. Default: 20 */
  glarePercentageThreshold?: number;
  /** Minimum average brightness to accept a frame (rejects underexposed). Default: 50 */
  minBrightness?: number;
  /** Maximum average brightness to accept a frame (rejects overexposed). Default: 220 */
  maxBrightness?: number;
  /** Use rectangle detection to crop to the photo boundary before hashing. Default: false */
  enableRectangleDetection?: boolean;
  /** Minimum rectangle detection confidence required to use the detected crop. Default: 0.35 */
  rectangleConfidenceThreshold?: number;
  /** Aspect ratio of the display viewport, used to compute crop regions. Default: 1 */
  displayAspectRatio?: number;
}
