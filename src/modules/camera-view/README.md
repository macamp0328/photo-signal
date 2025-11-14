# Camera View Module

## Purpose

Render camera video feed with UI overlay.

## Responsibility

**ONLY** handles:

- Displaying video stream in viewport
- Rendering 3:2 aspect ratio frame overlay (landscape)
- Rendering 2:3 aspect ratio frame overlay (portrait)
- Providing aspect ratio toggle functionality
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
  stream: MediaStream | null;         // Video stream to display
  error: string | null;               // Error message to show
  hasPermission: boolean | null;      // Permission state
  onRetry?: () => void;               // Retry callback for errors
  aspectRatio?: '3:2' | '2:3';        // Aspect ratio for framing guide (default '3:2')
  onAspectRatioToggle?: () => void;   // Callback when aspect ratio toggle is clicked
}
```

**Output**: React component (pure UI)

---

## Features

- Full viewport video display
- **3:2 aspect ratio guide overlay (landscape)**
- **2:3 aspect ratio guide overlay (portrait)**
- **Aspect ratio toggle button**
- Corner markers for alignment
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

### With Aspect Ratio Toggle

```typescript
import { useState } from 'react';
import { useCameraAccess } from '@/modules/camera-access';
import { CameraView } from '@/modules/camera-view';
import type { AspectRatio } from '@/modules/camera-view';

function App() {
  const { stream, error, hasPermission, retry } = useCameraAccess();
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:2');

  return (
    <CameraView
      stream={stream}
      error={error}
      hasPermission={hasPermission}
      onRetry={retry}
      aspectRatio={aspectRatio}
      onAspectRatioToggle={() => setAspectRatio(prev => prev === '3:2' ? '2:3' : '3:2')}
    />
  );
}
```

### Portrait Mode (2:3)

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
      aspectRatio="2:3"
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
