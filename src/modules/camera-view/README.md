# Camera View

Renders the camera feed in a `<video>` element with a 3:2/2:3 framing overlay and an optional
rectangle detection overlay.

## API

```tsx
<CameraView
  stream={MediaStream | null}
  error={string | null}
  hasPermission={boolean | null}
  onRetry?={() => void}
  grayscale?={boolean}
  detectedRectangle?={DetectedRectangle | null}
  rectangleConfidence?={number}
  rectangleDetectionConfidenceThreshold?={number}
  showRectangleOverlay?={boolean}
/>
```

## Responsibilities

- Attaching a `MediaStream` to a `<video>` element via `srcObject`
- Rendering a framing overlay (3:2 landscape / 2:3 portrait guide)
- Forwarding `DetectedRectangle` data to `RectangleOverlay` when enabled
- Showing error and permission-denied states

## Does NOT Own

- Acquiring the stream (`camera-access`)
- Detecting rectangles (`photo-rectangle-detection`)
- Recognition logic (`photo-recognition`)

## Dependencies

- `photo-rectangle-detection` — `DetectedRectangle` type and `RectangleOverlay` component

## Key Files

- `CameraView.tsx` — component
- `CameraView.module.css` — framing overlay styles
- `types.ts` — `CameraViewProps`, `AspectRatio`
