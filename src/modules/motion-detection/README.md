# Motion Detection

Detects camera movement by comparing pixel differences between successive video frames using a
canvas-based analysis.

## API

```ts
useMotionDetection(
  stream: MediaStream | null,
  options?: MotionDetectionOptions
): MotionDetectionHook
```

`MotionDetectionHook` members: `isMoving`, `sensitivity`, `setSensitivity(value)`

`MotionDetectionOptions`: `sensitivity` (0–100, default 50), `checkInterval` (ms, default 500),
`enabled` (default `true`)

## Responsibilities

- Sampling video frames at a configurable interval
- Computing pixel-level diff between consecutive frames
- Exposing `isMoving` so the recognition pipeline can pause during camera shake

## Does NOT Own

- Acquiring the stream (`camera-access`)
- Acting on motion state — `App.tsx` pauses recognition when `isMoving` is `true`

## Dependencies

- Browser `OffscreenCanvas` / `Canvas` API (mocked in tests via `src/test/mocks.ts`)

## Key Files

- `useMotionDetection.ts` — hook, frame sampling, pixel diff algorithm
- `types.ts` — `MotionDetectionHook`, `MotionDetectionOptions`
