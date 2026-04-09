# Audio Playback

Controls music playback with smooth fades and crossfades via Howler.js.

## API

```ts
useAudioPlayback(options?: AudioPlaybackOptions): AudioPlaybackHook
```

`AudioPlaybackHook` members: `play(url)`, `preload(url)`, `pause()`, `stop()`, `fadeOut(duration?)`,
`crossfade(newUrl, duration?)`, `isPlaying`, `progress`, `volume`, `playbackError`,
`setVolume(volume)`, `clearPlaybackError()`

```ts
useAudioReactiveGlow(isActive: boolean, isEnabled: boolean): void
```

Taps Howler's Web Audio context with an `AnalyserNode` and writes bass energy to
`--glow-reactive-scale` and `--glow-reactive-scale-ring` CSS custom properties on `<html>`.
Zero recognition impact.

```ts
diagnoseAudioUrl(url: string): Promise<AudioDiagnosticResult>
```

Checks CORS headers and HTTP status for a given audio URL. Used in the debug overlay.

## Responsibilities

- Wrapping Howler.js with a React hook interface
- Starting first playback from the HTML5 streaming path so audio can begin before full decode
- Maintaining a bounded preload window for candidate and upcoming playlist tracks
- Crossfading between tracks (cancel-safe, same-URL restarts)
- Updating `--glow-reactive-scale` from live audio frequency data

## Does NOT Own

- Deciding _when_ to play or which URL to play (that's `App.tsx`)
- Volume persistence across sessions (handled by `secret-settings`)

## Dependencies

- Howler.js (`howler`) — audio engine
- HTMLMediaElement + Howler internals — streamed playback and preload reuse
- Web Audio API via `Howler.ctx` — audio unlock and bass-reactive glow analysis

## Key Files

- `useAudioPlayback.ts` — main hook, Howler lifecycle management, crossfade logic
- `useAudioReactiveGlow.ts` — bass-energy AnalyserNode → CSS custom property
- `diagnoseAudioUrl.ts` — HEAD request + CORS header inspection
- `types.ts` — `AudioPlaybackHook`, `AudioPlaybackOptions`, `AudioDiagnosticResult`
