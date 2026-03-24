# Debug Overlay

Real-time recognition diagnostics panel. Shows Hamming distances, frame quality stats, telemetry,
and a "Test Song" audio diagnostic button. Hidden by default; enabled via the `debugOverlay`
feature flag in `secret-settings`.

## API

```tsx
<DebugOverlay
  recognizedConcert={Concert | null}
  isRecognizing={boolean}
  enabled={boolean}
  onVisibilityChange?={(isVisible: boolean) => void}
  debugInfo?={RecognitionDebugInfo | null}
  onReset?={() => void}
  testAudioUrl?={string | null}
/>
```

Wire `onVisibilityChange` to `enableDebugInfo` so telemetry only runs while the overlay is open.

## Responsibilities

- Rendering live recognition telemetry from `RecognitionDebugInfo`
- Running a `diagnoseAudioUrl` check for the current track (via the "Test Song" button)
- Reporting frame quality, near-miss candidates, and failure diagnostics

## Does NOT Own

- Collecting telemetry data (that's `photo-recognition`)
- Audio playback (that's `audio-playback`)

## Dependencies

- `photo-recognition` — `RecognitionDebugInfo` type
- `audio-playback` — `diagnoseAudioUrl` for the Test Song button
- `Concert` type from `src/types/index.ts`

## Key Files

- `DebugOverlay.tsx` — component, Test Song diagnostic logic
- `DebugOverlay.module.css` — overlay styles
- `types.ts` — `DebugOverlayProps`, `RecognitionStatus`
