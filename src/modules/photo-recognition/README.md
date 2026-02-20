# Photo Recognition Module

## Purpose

Identify printed photos from a camera stream using a **single pHash pipeline** and map matches to concert entries.

## Scope

This module handles:

- Frame capture and centered/rectangle-assisted cropping
- Frame quality filtering (blur, glare, poor lighting)
- pHash generation and Hamming-distance matching
- Margin-based ambiguity guardrails for near-tie candidates
- Instant/stability confirmation rules for initial matches and stricter switch-mode confirmation
- Debug telemetry for diagnostics

This module does not handle:

- Camera permissions (`camera-access`)
- Audio playback (`audio-playback`)
- Data loading API design (`data-service`)
- Presentation UI (`concert-info`, `debug-overlay`)

## API

### `usePhotoRecognition(stream, options?)`

```ts
stream: MediaStream | null

options?: {
  recognitionDelay?: number;              // default 200ms (borderline matches)
  enabled?: boolean;                      // default true
  similarityThreshold?: number;           // pHash distance threshold, default 14
  matchMarginThreshold?: number;          // min best-vs-second margin, default 2
  switchMatchMarginThreshold?: number;    // stricter switch margin, default 5
  continuousRecognition?: boolean;        // default false (enables switch-mode behavior)
  switchRecognitionDelayMultiplier?: number; // default 1.8x recognitionDelay
  switchDistanceThreshold?: number;       // default 7 (stricter than base threshold)
  checkInterval?: number;                 // default 120ms (idle), adaptive 80ms while tracking
  enableDebugInfo?: boolean;              // default false
  aspectRatio?: '3:2' | '2:3' | '1:1' | 'auto';
  sharpnessThreshold?: number;            // default 100
  glareThreshold?: number;                // default 250
  glarePercentageThreshold?: number;      // default 20
  minBrightness?: number;                 // default 50
  maxBrightness?: number;                 // default 220
  enableRectangleDetection?: boolean;     // default false
  rectangleConfidenceThreshold?: number;  // default 0.35
  displayAspectRatio?: number;            // default 1
}
```

Returns:

```ts
{
  recognizedConcert: Concert | null;
  isRecognizing: boolean;
  reset: () => void;
  debugInfo: RecognitionDebugInfo | null;
  frameQuality: FrameQualityInfo | null;
  activeGuidance: GuidanceType;
  detectedRectangle: DetectedRectangle | null;
  rectangleConfidence: number;
}
```

### `calculateFramedRegion(videoWidth, videoHeight, aspectRatio, scale?)`

Returns centered crop coordinates for framing overlays and capture.

## Data requirements

Each concert should include pHash variants:

```json
{
  "photoHashes": {
    "phash": ["..."]
  }
}
```

Only `photoHashes.phash` is required by runtime recognition.

## Notes

- Chosen runtime algorithm: **pHash only**
- Initial match confirmation: immediate when distance <= 10, otherwise 2 consecutive strong matches or short delay hold
- Continuous switch confirmation: only for stronger candidates (distance <= 7 + margin >= 5), then 3 consistent frames and either delay completion or instant distance <= 3
- Quality checks are bypassed for close matches at distance <= 14 and run for weaker/ambiguous candidates
- Ambiguous candidates (within threshold but low margin) emit `ambiguous-match` guidance and are not promoted
- App-level switch prompt is suppressed while `ambiguous-match` guidance is active
- Telemetry includes switch prompt decisions (`shownCount`, `confirmCount`, `dismissCount`, decision latency, confidence/margin snapshot)
- Kept for matching: `algorithms/phash.ts`, `algorithms/hamming.ts`, `algorithms/utils.ts`
- Removed runtime paths: legacy non-pHash matching and fallback branches
