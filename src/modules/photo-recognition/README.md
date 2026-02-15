# Photo Recognition Module

## Purpose

Identify printed photos from a camera stream using a **single pHash pipeline** and map matches to concert entries.

## Scope

This module handles:

- Frame capture and centered/rectangle-assisted cropping
- Frame quality filtering (blur, glare, poor lighting)
- pHash generation and Hamming-distance matching
- Stability confirmation before recognition
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
  recognitionDelay?: number;              // default 1000ms
  enabled?: boolean;                      // default true
  similarityThreshold?: number;           // pHash distance threshold, default 12
  checkInterval?: number;                 // default 250ms
  enableDebugInfo?: boolean;              // default false
  aspectRatio?: '3:2' | '2:3' | '1:1' | 'auto';
  sharpnessThreshold?: number;            // default 100
  glareThreshold?: number;                // default 250
  glarePercentageThreshold?: number;      // default 20
  minBrightness?: number;                 // default 50
  maxBrightness?: number;                 // default 220
  enableRectangleDetection?: boolean;     // default false
  rectangleConfidenceThreshold?: number;  // default 0.6
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

Legacy fields (e.g. `dhash`, `orbFeatures`) may still exist in `data.json` and are ignored by runtime recognition.

## Notes

- Chosen runtime algorithm: **pHash only**
- Kept for matching: `algorithms/phash.ts`, `algorithms/hamming.ts`, `algorithms/utils.ts`
- Removed runtime paths: dHash, ORB, parallel voting, secondary fallback, multi-scale branching
