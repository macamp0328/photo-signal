# Camera View Module

## Purpose

Render camera video feed with UI overlay.

## Responsibility

**ONLY** handles:

- Displaying video stream in viewport
- Rendering 3:2 aspect ratio frame overlay
- Showing instructions to user
- Displaying permission errors

**Does NOT** handle:

- Camera access (see `camera-access` module)
- Motion detection (see `motion-detection` module)
- Photo recognition (see `photo-recognition` module)

---

## API Contract

### Component: `CameraView`

**Input**:

```typescript
{
  stream: MediaStream | null;    // Video stream to display
  error: string | null;          // Error message to show
  hasPermission: boolean | null; // Permission state
  onRetry?: () => void;          // Retry callback for errors
}
```

**Output**: React component (pure UI)

---

## Features

- Full viewport video display
- 3:2 aspect ratio guide overlay
- Corner markers for alignment
- Instruction text
- Permission error handling

---

## Usage Example

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

---

## Performance

- Hardware-accelerated video rendering
- CSS-only overlays (no canvas overhead)
- Efficient video element updates

---

## Dependencies

- `camera-access` types
- Tailwind CSS
