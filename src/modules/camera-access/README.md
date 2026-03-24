# Camera Access

Acquires a camera `MediaStream` and manages permission state.

## API

```ts
useCameraAccess(options?: CameraAccessOptions): CameraAccessHook
```

`CameraAccessHook` members: `stream`, `error`, `hasPermission`, `retry()`

`CameraAccessOptions`: `autoStart` (default `true`) — set to `false` to defer camera start.

## Responsibilities

- Calling `navigator.mediaDevices.getUserMedia` with appropriate video constraints
- Tracking permission state (`null` = loading, `true` = granted, `false` = denied)
- Exposing `retry()` so the UI can prompt a re-request after a denial

## Does NOT Own

- Rendering the video element (that's `camera-view`)
- Motion analysis on the stream (that's `motion-detection`)
- Photo recognition on the stream (that's `photo-recognition`)

## Dependencies

- Browser `MediaDevices` API (mocked in tests via `src/test/mocks.ts`)

## Key Files

- `useCameraAccess.ts` — hook, `getUserMedia` call, permission state machine
- `types.ts` — `CameraAccessHook`, `CameraAccessOptions`
