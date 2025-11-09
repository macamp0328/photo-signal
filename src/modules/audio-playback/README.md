# Audio Playback Module

## Purpose

Control music playback with smooth fades.

## Responsibility

**ONLY** handles:

- Loading and playing audio files
- Volume control and fading
- Playback state management

**Does NOT** handle:

- Determining what to play (see App orchestrator)
- Concert data (see `data-service`)
- UI controls (handled by App)

---

## API Contract

### Hook: `useAudioPlayback(options?)`

**Input**:

```typescript
options?: {
  volume?: number;        // Initial volume 0-1, default 0.8
  fadeTime?: number;      // Fade duration in ms, default 1000
}
```

**Output**:

```typescript
{
  play: (url: string) => void;         // Play audio from URL
  pause: () => void;                   // Pause playback
  stop: () => void;                    // Stop and unload
  fadeOut: (duration?: number) => void; // Fade out over duration
  isPlaying: boolean;                  // Current playback state
  volume: number;                      // Current volume 0-1
  setVolume: (v: number) => void;      // Set volume 0-1
}
```

**Side Effects**:

- Loads and plays audio files
- Modifies audio volume
- May use Howler.js or native Audio API

---

## Implementation Options

### Option 1: Native Audio API (Recommended)

**Pros**:

- Zero dependencies
- Smallest bundle size
- Maximum performance

**Cons**:

- Manual fade implementation
- Less cross-browser audio format handling

### Option 2: Howler.js

**Pros**:

- Built-in fade methods
- Excellent browser compatibility
- Robust error handling

**Cons**:

- +15KB bundle size
- Extra dependency

**Decision**: Use Howler.js for now (already in dependencies), can switch to native later if needed.

---

## Usage Example

```typescript
import { useAudioPlayback } from '@/modules/audio-playback';

function App() {
  const { play, fadeOut, isPlaying } = useAudioPlayback();

  const handlePhotoRecognized = (concert) => {
    play(concert.audioFile);
  };

  const handleMovement = () => {
    fadeOut(1000); // Fade out over 1 second
  };
}
```

---

## Performance

- **Preloading**: Consider preloading first track
- **Format**: MP3 (best compatibility/size ratio)
- **Streaming**: HTML5 audio (no full download needed)

---

## Future Enhancements

- [ ] Crossfade between tracks
- [ ] Equalizer controls
- [ ] Spatial audio (stereo positioning)
- [ ] Visualizer data export
- [ ] External speaker support (ESP32, Google Home)
- [ ] Offline caching (PWA)

---

## Dependencies

- `howler` library (can be replaced with native Audio API)
