/**
 * Photo Recognition Module
 *
 * Identifies photos from camera stream and matches to concert data.
 * Current: Placeholder implementation
 * Future: ML-based image recognition
 */

export { usePhotoRecognition, calculateFramedRegion } from './usePhotoRecognition';
export { FrameQualityIndicator } from './FrameQualityIndicator';
export { TelemetryExport } from './TelemetryExport';
export { GuidanceMessage } from './GuidanceMessage';
export type {
  PhotoRecognitionHook,
  PhotoRecognitionOptions,
  AspectRatio,
  FrameQualityInfo,
  RecognitionTelemetry,
  GuidanceType,
  RecognitionDebugInfo,
  BestMatchInfo,
  FailureCategory,
  FailureDiagnostic,
  HashAlgorithm,
} from './types';
