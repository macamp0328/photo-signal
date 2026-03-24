# Photo Rectangle Detection

Computer vision-based rectangle detector that finds printed photo boundaries in camera frames.
Used to give `photo-recognition` a tighter crop region.

## API

```ts
new RectangleDetectionService(options?: RectangleDetectionOptions): RectangleDetectionService
service.detectRectangle(imageData: ImageData): RectangleDetectionResult
```

```tsx
<RectangleOverlay rectangle={DetectedRectangle | null} state={DetectionState} />
```

All coordinates in `DetectedRectangle` are normalized to [0, 1] relative to frame dimensions.

## Responsibilities

- Canny edge detection and contour analysis on raw `ImageData`
- Scoring candidate rectangles and returning the best above a confidence threshold
- Rendering a corner-marker overlay on `CameraView` when a rectangle is detected

## Does NOT Own

- Cropping or hashing the detected region (`photo-recognition` handles this)
- Camera acquisition or video rendering

## Dependencies

- Browser Canvas `ImageData` API (mocked in tests via `src/test/mocks.ts`)

## Key Files

- `RectangleDetectionService.ts` — detection algorithm (Canny edges → contours → scoring)
- `RectangleOverlay.tsx` — SVG corner-marker overlay component
- `types.ts` — `DetectedRectangle`, `RectangleDetectionResult`, `RectangleDetectionOptions`, `DetectionState`
