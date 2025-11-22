# Camera View Module

## Purpose

Render camera video feed with optional grayscale and info overlays.

## Responsibility

**ONLY** handles:

- Displaying video stream in viewport
- Showing instructions to user
- Displaying permission errors
- **Rendering concert info overlay (when provided)**

**Does NOT** handle:

- Camera access (see `camera-access` module)
- Motion detection (see `motion-detection` module)
- Photo recognition (see `photo-recognition` module)
- Concert data management (see `concert-info` module)

---

## API Contract

### Component: `CameraView`

**Input**:

```typescript
{
  stream: MediaStream | null;         // Video stream to display
  error: string | null;               // Error message to show
  hasPermission: boolean | null;      // Permission state
  onRetry?: () => void;               // Retry callback for errors
  grayscale?: boolean;                // Apply grayscale filter to camera view (default false)
  concertInfo?: Concert | null;       // Concert info to display as overlay (optional)
  showConcertOverlay?: boolean;       // Control visibility of concert overlay (default false)
}
```

**Output**: React component (pure UI)

---

## Features

- Full viewport video display
- **Grayscale filter support**
- **Concert info overlay** (semi-transparent, positioned absolutely)
- Rectangle detection overlay (when provided)
- Instruction text
- Permission error handling

---

## Usage Example

### Basic Usage (Default 3:2 Landscape)

```typescript
import { useCameraAccess } from '@/modules/camera-access';
import { CameraView } from '@/modules/camera-view';

function App() {
  const { stream, error, hasPermission, retry } = useCameraAccess();

  return (
    <CameraView
      stream={stream}
      error={error}
      hasPermission={hasPermission}
      onRetry={retry}
    />
  );
}
```

### With Grayscale Filter

```typescript
import { useCameraAccess } from '@/modules/camera-access';
import { CameraView } from '@/modules/camera-view';
import { useFeatureFlags } from '@/modules/secret-settings';

function App() {
  const { stream, error, hasPermission, retry } = useCameraAccess();
  const { isEnabled } = useFeatureFlags();

  return (
    <CameraView
      stream={stream}
      error={error}
      hasPermission={hasPermission}
      onRetry={retry}
      grayscale={isEnabled('grayscale-mode')}
    />
  );
}
```

### With Concert Info Overlay

```typescript
import { useCameraAccess } from '@/modules/camera-access';
import { usePhotoRecognition } from '@/modules/photo-recognition';
import { useAudioPlayback } from '@/modules/audio-playback';
import { CameraView } from '@/modules/camera-view';

function App() {
  const { stream, error, hasPermission, retry } = useCameraAccess();
  const { recognizedConcert } = usePhotoRecognition(stream);
  const { isPlaying } = useAudioPlayback();

  return (
    <CameraView
      stream={stream}
      error={error}
      hasPermission={hasPermission}
      onRetry={retry}
      concertInfo={recognizedConcert}
      showConcertOverlay={!!recognizedConcert && isPlaying}
    />
  );
}
```

**Note**: The concert overlay is positioned absolutely within the camera container, so it does not affect the camera's dimensions or the underlying video stream. This prevents the overlay from disrupting photo recognition when it appears.

---

## Performance

- Hardware-accelerated video rendering
- CSS-only overlays (no canvas overhead)
- Efficient video element updates

---

## Dependencies

- `camera-access` types
- CSS Modules (`CameraView.module.css`)
