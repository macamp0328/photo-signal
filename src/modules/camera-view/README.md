# Camera View Module

## Purpose

Render camera video feed with optional grayscale and instructional guidance.

## Responsibility

**ONLY** handles:

- Displaying video stream in viewport
- Showing instructions to user
- Displaying permission errors
- Rectangle detection overlay rendering

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
  showInstructions?: boolean;         // Control visibility of instructional text (default true)
}
```

**Output**: React component (pure UI)

---

## Features

- Full viewport video display
- **Grayscale filter support**
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

### Hide Instructions While Matched

```typescript
import { useCameraAccess } from '@/modules/camera-access';
import { usePhotoRecognition } from '@/modules/photo-recognition';
import { CameraView } from '@/modules/camera-view';

function App() {
  const { stream, error, hasPermission, retry } = useCameraAccess();
  const { recognizedConcert } = usePhotoRecognition(stream);

  return (
    <CameraView
      stream={stream}
      error={error}
      hasPermission={hasPermission}
      onRetry={retry}
      showInstructions={!recognizedConcert}
    />
  );
}
```

---

## Performance

- Hardware-accelerated video rendering
- CSS-only overlays (no canvas overhead)
- Efficient video element updates

---

## Dependencies

- `camera-access` types
- CSS Modules (`CameraView.module.css`)
