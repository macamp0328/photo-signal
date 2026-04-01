# Photo Recognition

Identifies printed photos from a live camera stream using pHash (perceptual hashing) and maps
matches to concert entries. Recognition runs in a Web Worker with an adaptive check interval.

See `docs/PHOTO_RECOGNITION_DEEP_DIVE.md` for algorithm details, threshold tuning, and
troubleshooting.

## API

```ts
usePhotoRecognition(
  stream: MediaStream | null,
  options?: PhotoRecognitionOptions
): PhotoRecognitionHook
```

`PhotoRecognitionHook` members: `candidateConcert`, `recognizedConcert`, `isRecognizing`,
`reset()`, `resetTelemetry()`, `forceMatch()`, `debugInfo`, `frameQuality`,
`detectedRectangle`, `rectangleConfidence`, `indexLoadFailed`

```ts
calculateFramedRegion(
  videoWidth: number,
  videoHeight: number,
  aspectRatio: AspectRatio,
  scale?: number
): { x: number; y: number; width: number; height: number }
```

Returns the cropped region used for hashing (matches the camera-view framing overlay).

```ts
computeActiveSettings(options: PhotoRecognitionOptions): ActiveSettings
computeAiRecommendations(telemetry: RecognitionTelemetry, settings: ActiveSettings): AiRecommendation[]
```

Derive recommended threshold adjustments from aggregated telemetry (used in debug overlay).

## Responsibilities

- Running pHash on cropped video frames inside a Web Worker
- Comparing hashes against `data.recognition.v2.json` at multiple exposure variants
- Exposing a candidate concert before final confirmation so callers can warm related media
- Requiring sustained match stability before emitting `recognizedConcert`
- Collecting telemetry (`RecognitionDebugInfo`) when debug mode is enabled

## Does NOT Own

- Displaying recognition results (`concert-info`, `debug-overlay`)
- Camera acquisition (`camera-access`)
- Motion gating (caller in `App.tsx` checks `isMoving` before passing the stream)

## Dependencies

- `public/data.recognition.v2.json` — pHash index loaded via `data-service.ts`
- Web Worker (`src/modules/photo-recognition/worker/`) — off-main-thread hashing
- `photo-rectangle-detection` — optional rectangle-guided crop region

## Key Files

- `usePhotoRecognition.ts` — hook, worker bridge, stability timer, result emission
- `telemetryAnalysis.ts` — `computeActiveSettings`, `computeAiRecommendations`
- `worker/` — Web Worker that performs the actual pHash computation and lookup
- `types.ts` — all exported types including `PhotoRecognitionHook`, `RecognitionDebugInfo`, etc.
