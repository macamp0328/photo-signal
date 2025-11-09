# Camera Access Module

## Purpose
Manage camera permissions and provide MediaStream access.

## Responsibility
**ONLY** handles:
- Requesting camera permissions
- Opening rear camera with 3:2 aspect ratio
- Providing stream to other modules
- Managing stream lifecycle (cleanup)

**Does NOT** handle:
- Motion detection (see `motion-detection` module)
- Photo recognition (see `photo-recognition` module)
- UI overlays (see `concert-info` module)

---

## API Contract

### Hook: `useCameraAccess()`

**Input**: None (auto-requests on mount)

**Output**:
```typescript
{
  stream: MediaStream | null;      // Camera video stream
  error: string | null;             // Error message if failed
  hasPermission: boolean | null;    // null=loading, true=granted, false=denied
  retry: () => void;                // Retry camera access after error
}
```

**Side Effects**:
- Requests camera permissions on mount
- Stops all tracks on unmount
- Attempts to use rear camera (`facingMode: 'environment'`)

---

## Usage Example

```typescript
import { useCameraAccess } from '@/modules/camera-access';

function CameraView() {
  const { stream, error, hasPermission, retry } = useCameraAccess();

  if (hasPermission === false) {
    return <div>Camera denied. <button onClick={retry}>Retry</button></div>;
  }

  if (!stream) {
    return <div>Loading camera...</div>;
  }

  return <video srcObject={stream} autoPlay />;
}
```

---

## Configuration

Camera constraints (can be modified in `useCameraAccess.ts`):

```typescript
{
  video: {
    facingMode: 'environment',  // Rear camera
    aspectRatio: 3 / 2,         // 3:2 ratio for photo framing
  },
  audio: false                   // No audio needed
}
```

---

## Performance Considerations

- **Minimal overhead**: Uses native `getUserMedia` API
- **Auto cleanup**: Stops tracks on unmount to free resources
- **No polling**: Event-driven permission handling

---

## Future Enhancements

- [ ] Allow switching between front/rear cameras
- [ ] Support custom aspect ratios
- [ ] Add resolution preferences (720p, 1080p)
- [ ] Flash/torch control for low light

---

## Dependencies

- None (uses native MediaDevices API)
