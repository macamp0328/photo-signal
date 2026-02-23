/**
 * Photo Recognition Module
 *
 * Identifies printed photos from a camera stream using pHash (perceptual hashing)
 * and maps matches to concert entries. See docs/PHOTO_RECOGNITION_DEEP_DIVE.md.
 */

export { usePhotoRecognition, calculateFramedRegion } from './usePhotoRecognition';
export { computeActiveSettings, computeAiRecommendations } from './telemetryAnalysis';
export type {
  PhotoRecognitionHook,
  PhotoRecognitionOptions,
  AspectRatio,
  FrameQualityInfo,
  RecognitionTelemetry,
  RecognitionDebugInfo,
  BestMatchInfo,
  FailureCategory,
  FailureDiagnostic,
  HashAlgorithm,
  FrameQualityStats,
  HammingDistanceLog,
  NearMissEntry,
} from './types';
export type { ActiveSettings, AiRecommendation } from './telemetryAnalysis';
