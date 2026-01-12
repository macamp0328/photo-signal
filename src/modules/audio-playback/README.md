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
  crossfadeDuration?: number;  // Default crossfade duration in ms, default 2000
  crossfadeEnabled?: boolean;  // Enable crossfade functionality, default true
}
```

**Output**:

```typescript
{
  play: (url: string) => void;  // Play or resume audio from URL
  preload: (url: string) => void; // Begin streaming so playback is instant
  pause: () => void;                                  // Pause playback
  stop: () => void;                                   // Stop and unload
  fadeOut: (duration?: number) => void;               // Fade out over duration
  crossfade: (newUrl: string, duration?: number) => void; // Crossfade to new track
  isPlaying: boolean;                                 // Current playback state
  progress: number;                                   // Playback progress (0-1)
  volume: number;                                     // Current volume 0-1
  setVolume: (v: number) => void;                     // Set volume 0-1
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
  const { play, fadeOut, crossfade, isPlaying } = useAudioPlayback();

  const handlePhotoRecognized = (concert) => {
    play(concert.audioFile);
  };

  const handleMovement = () => {
    fadeOut(1000); // Fade out over 1 second
  };

  const handleTrackChange = (newConcert) => {
    crossfade(newConcert.audioFile, 2000);
  };
}
```

### Crossfade Example

```typescript
// Use default crossfade duration (2000ms)
const { crossfade } = useAudioPlayback({
  crossfadeDuration: 3000, // Default to 3 seconds
});

// Crossfade with default duration
crossfade('/audio/new-track.opus');

// Crossfade with custom duration
crossfade('/audio/new-track.opus', 1500);

// Disable crossfade for immediate switching
const { crossfade: switchTrack } = useAudioPlayback({
  crossfadeEnabled: false,
});
switchTrack('/audio/new-track.opus'); // Acts like play()
```

---

## Crossfade Behavior

### How It Works

When you call `crossfade()`, the module:

1. **Fades out** the current track from its current volume to 0
2. **Simultaneously fades in** the new track from 0 to the current volume setting
3. **Manages two Howl instances** during the transition
4. **Cleans up** the old instance after the fade completes

### Edge Cases

| Scenario                  | Behavior                                          |
| ------------------------- | ------------------------------------------------- |
| No audio playing          | Acts like `play()` - starts new track immediately |
| Same URL                  | Seeks to beginning (restarts track)               |
| Crossfade in progress     | Cancels previous crossfade, starts new one        |
| `crossfadeEnabled: false` | Acts like `play()` - immediate switch             |
| Component unmounts        | Cleans up both tracks and pending timeouts        |

### Performance

- **Memory**: Two Howl instances exist only during crossfade
- **CPU**: Minimal - leverages Howler.js optimized fade
- **Network**: New track starts loading immediately
- **Audio gaps**: None - guaranteed smooth transition

---

## Performance

- **Preloading**: Consider preloading first track
- **Format**: Opus (best compatibility/size ratio)
- **Streaming**: HTML5 audio (no full download needed)
- **CDN Delivery**: Supports streaming from GitHub Releases or Cloudflare R2

---

## CDN Streaming Setup

For production deployments with 100+ tracks:

1. **Upload Opuss to CDN** (GitHub Releases or Cloudflare R2)
2. **Update data.json** with CDN URLs:
   ```json
   {
     "audioFile": "https://cdn.example.com/concert-1.opus"
   }
   ```
3. **Use migration script**:
   ```bash
   npm run migrate-audio -- --base-url=https://cdn.example.com
   ```
4. **Validate URLs**:
   ```bash
   npm run validate-audio
   ```

**Benefits:**

- Free hosting (GitHub Releases or Cloudflare R2 free tier)
- <1s playback start on fast wifi
- Clean git repository (no large Opus files)

**See:** [docs/audio-streaming-setup.md](../../../docs/audio-streaming-setup.md) for complete guide

---

## Future Enhancements

- [x] Crossfade between tracks
- [ ] Equalizer controls
- [ ] Spatial audio (stereo positioning)
- [ ] Visualizer data export
- [ ] External speaker support (ESP32, Google Home)
- [ ] Offline caching (PWA)

---

## Dependencies

- `howler` library (can be replaced with native Audio API)
