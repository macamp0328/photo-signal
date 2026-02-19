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

export type GuidanceType =
  | 'motion-blur'
  | 'glare'
  | 'poor-lighting'
  | 'ambiguous-match'
  | 'distance'
  | 'off-center'
  | 'none';

export interface SwitchPromptSnapshot {
  activeConcertId: number | null;
  candidateConcertId: number | null;
  confidence: number | null;
  margin: number | null;
  shownAt: number | null;
}

export interface SwitchDecisionTelemetry {
  shownCount: number;
  confirmCount: number;
  dismissCount: number;
  decisionLatenciesMs: number[];
  averageDecisionLatencyMs: number | null;
  lastDecisionLatencyMs: number | null;
  lastPromptSnapshot: SwitchPromptSnapshot;
}

export interface RecognitionTelemetry {
  totalFrames: number;
  blurRejections: number;
  glareRejections: number;
  lightingRejections: number;
  qualityFrames: number;
  successfulRecognitions: number;
  failedAttempts: number;
  failureHistory: FailureDiagnostic[];
  failureByCategory: Record<FailureCategory, number>;
  guidanceTracking: {
    shown: Record<GuidanceType, number>;
    duration: Record<GuidanceType, number>;
    lastShown: Record<GuidanceType, number>;
  };
  switchDecision?: SwitchDecisionTelemetry;
  /** Running sums and counts for quality measurements of rejected frames. */
  frameQualityStats: FrameQualityStats;
  /** Hamming distance distribution for quality-passing frames. */
  hammingDistanceLog: HammingDistanceLog;
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
  activeGuidance: GuidanceType;
  detectedRectangle: DetectedRectangle | null;
  rectangleConfidence: number;
}

export interface PhotoRecognitionOptions {
  recognitionDelay?: number;
  enabled?: boolean;
  similarityThreshold?: number;
  matchMarginThreshold?: number;
  switchMatchMarginThreshold?: number;
  continuousRecognition?: boolean;
  switchRecognitionDelayMultiplier?: number;
  switchDistanceThreshold?: number;
  checkInterval?: number;
  enableDebugInfo?: boolean;
  aspectRatio?: AspectRatio;
  sharpnessThreshold?: number;
  glareThreshold?: number;
  glarePercentageThreshold?: number;
  minBrightness?: number;
  maxBrightness?: number;
  enableRectangleDetection?: boolean;
  rectangleConfidenceThreshold?: number;
  displayAspectRatio?: number;
}
