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

### Hook: `useCameraAccess(options?)`

**Input**:

```typescript
{
  autoStart?: boolean;  // Whether to automatically start camera on mount (default: true)
}
```

When `autoStart` is `false`, the camera will not request permissions or initialize on mount. This allows for delayed camera activation (e.g., after a landing page interaction).

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

// Example with delayed activation
function DelayedCameraView() {
  const { stream, error, hasPermission, retry } = useCameraAccess({ autoStart: false });

  // Camera won't start until you call retry()
  return (
    <div>
      <button onClick={retry}>Start Camera</button>
      {stream && <video srcObject={stream} autoPlay />}
    </div>
  );
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

    // Advanced constraints for low-light bathroom use case
    // Using 'ideal' to allow graceful fallback if unsupported
    focusMode: { ideal: 'continuous' },              // Continuous autofocus
    pointsOfInterest: { ideal: [{ x: 0.5, y: 0.5 }] }, // Center focus point
    exposureMode: { ideal: 'continuous' },           // Auto exposure
    whiteBalanceMode: { ideal: 'continuous' },       // Auto white balance
    brightness: { ideal: 1.2 },                      // Slight boost for low light
    contrast: { ideal: 1.2 },                        // Improve visibility
  },
  audio: false                   // No audio needed
}
```

### Advanced Constraints

The camera module now attempts to optimize for low-light conditions (e.g., bathroom installations) by requesting:

- **Autofocus**: Continuous autofocus with center focus point
- **Auto Exposure**: Automatic exposure adjustment for varying light conditions
- **Auto White Balance**: Automatic white balance for natural colors
- **Brightness/Contrast**: Slight boost to improve visibility in low light

**Browser Support**: These advanced constraints have limited support across browsers:

| Constraint         | Chrome/Edge | Firefox | Safari | Mobile           |
| ------------------ | ----------- | ------- | ------ | ---------------- |
| `focusMode`        | ✅ Android  | ❌      | ❌     | ✅ iOS (limited) |
| `pointsOfInterest` | ✅ Android  | ❌      | ❌     | ✅ iOS (limited) |
| `exposureMode`     | ✅ Android  | ❌      | ❌     | ✅ iOS (limited) |
| `whiteBalanceMode` | ✅ Android  | ❌      | ❌     | ✅ iOS (limited) |
| `brightness`       | ✅ Android  | ❌      | ❌     | ⚠️ Varies        |
| `contrast`         | ✅ Android  | ❌      | ❌     | ⚠️ Varies        |

**Fallback Behavior**: All constraints use `{ ideal: value }` instead of `{ exact: value }`, so browsers that don't support these constraints will gracefully ignore them and use default camera settings. The app will still function normally.

**Development Logging**: In development mode, the actual applied camera settings are logged to the console, allowing you to verify which constraints were applied by the browser.

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
- [x] ~~Autofocus and exposure optimization~~ (implemented with advanced constraints)
- [x] ~~Black and white mode~~ (implemented in photo-recognition module with grayscale conversion feature flag)

---

## Dependencies

- None (uses native MediaDevices API)
