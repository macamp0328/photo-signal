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
  play: (url: string, fallbackUrl?: string) => void;  // Play audio from URL with optional fallback
  pause: () => void;                                  // Pause playback
  stop: () => void;                                   // Stop and unload
  fadeOut: (duration?: number) => void;               // Fade out over duration
  crossfade: (newUrl: string, duration?: number, fallbackUrl?: string) => void; // Crossfade to new track with optional fallback
  isPlaying: boolean;                                 // Current playback state
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
    // Play with CDN URL and local fallback
    play(concert.audioFile, concert.audioFileFallback);
  };

  const handleMovement = () => {
    fadeOut(1000); // Fade out over 1 second
  };

  const handleTrackChange = (newConcert) => {
    // Smooth transition between tracks with fallback support
    crossfade(newConcert.audioFile, 2000, newConcert.audioFileFallback);
  };
}
```

### CDN Streaming with Fallback

The audio playback module supports streaming from CDN with automatic fallback to local files:

```typescript
// Concert data with CDN URL and local fallback
const concert = {
  id: 1,
  band: 'The Midnight Echoes',
  audioFile: 'https://cdn.example.com/concert-1.mp3', // Primary CDN URL
  audioFileFallback: '/audio/concert-1.mp3', // Local fallback
};

// Play with automatic fallback
play(concert.audioFile, concert.audioFileFallback);

// If CDN URL fails, automatically tries local fallback
// If both fail, error is logged but app continues
```

**How fallback works:**

1. **Try primary URL**: Attempts to load from CDN
2. **On error, try fallback**: If CDN fails and fallback URL provided, tries local file
3. **Graceful degradation**: If both fail, error is logged and playback state is managed

This enables:

- ✅ **Offline development**: Local files work without CDN
- ✅ **Production reliability**: CDN outages don't break the app
- ✅ **Cost optimization**: Stream from free CDN (GitHub Releases, Cloudflare R2)
- ✅ **Scalability**: Support 100+ tracks without bloating git repo

**See also:** [docs/audio-streaming-setup.md](../../../docs/audio-streaming-setup.md) - Complete CDN setup guide

### Crossfade Example

```typescript
// Use default crossfade duration (2000ms)
const { crossfade } = useAudioPlayback({
  crossfadeDuration: 3000, // Default to 3 seconds
});

// Crossfade with default duration
crossfade('/audio/new-track.mp3');

// Crossfade with custom duration
crossfade('/audio/new-track.mp3', 1500);

// Disable crossfade for immediate switching
const { crossfade: switchTrack } = useAudioPlayback({
  crossfadeEnabled: false,
});
switchTrack('/audio/new-track.mp3'); // Acts like play()
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
- **Format**: MP3 (best compatibility/size ratio)
- **Streaming**: HTML5 audio (no full download needed)
- **CDN Delivery**: Supports streaming from GitHub Releases or Cloudflare R2
- **Fallback**: Automatic failover to local files when CDN unavailable
- **Multi-source**: Howler.js tries sources in order until one succeeds

---

## CDN Streaming Setup

For production deployments with 100+ tracks:

1. **Upload MP3s to CDN** (GitHub Releases or Cloudflare R2)
2. **Update data.json** with CDN URLs and fallbacks:
   ```json
   {
     "audioFile": "https://cdn.example.com/concert-1.mp3",
     "audioFileFallback": "/audio/concert-1.mp3"
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
- Clean git repository (no large MP3 files)
- Offline development still works (fallback to local files)

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
