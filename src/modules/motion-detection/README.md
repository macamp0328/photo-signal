# Motion Detection Module

## Purpose

Detect camera movement to trigger audio fade-out.

## Responsibility

**ONLY** handles:

- Analyzing video frames for pixel differences
- Determining if camera is moving based on threshold
- Providing movement state to other components

**Does NOT** handle:

- Camera access (see `camera-access` module)
- Audio control (see `audio-playback` module)
- UI feedback (handled by App orchestrator)

---

## API Contract

### Hook: `useMotionDetection(stream, options?)`

**Input**:

```typescript
stream: MediaStream | null       // Camera video stream
options?: {
  sensitivity?: number;          // 0-100, default 50
  checkInterval?: number;        // ms between checks, default 500
}
```

**Output**:

```typescript
{
  isMoving: boolean;             // True if motion detected
  sensitivity: number;           // Current sensitivity (0-100)
  setSensitivity: (n: number) => void;
}
```

**Side Effects**:

- Analyzes frames at specified interval
- Uses Canvas API for pixel comparison
- Minimal performance impact (low-res sampling)

---

## Algorithm

1. Capture current video frame to canvas (downscaled 4x for performance)
2. Compare with previous frame using pixel difference
3. Count pixels that changed beyond threshold
4. If count exceeds minimum, motion detected

**Performance**: ~1ms per check on modern devices

---

## Usage Example

```typescript
import { useCameraAccess } from '@/modules/camera-access';
import { useMotionDetection } from '@/modules/motion-detection';

function App() {
  const { stream } = useCameraAccess();
  const { isMoving } = useMotionDetection(stream);

  useEffect(() => {
    if (isMoving) {
      console.log('Camera moved! Fade out audio.');
    }
  }, [isMoving]);
}
```

---

## Configuration

### Sensitivity

- **0-30**: Very sensitive (small movements trigger)
- **30-70**: Normal (default 50)
- **70-100**: Less sensitive (only large movements)

### Check Interval

- **100ms**: Very responsive, higher CPU usage
- **500ms**: Balanced (default)
- **1000ms**: Battery-friendly, less responsive

---

## Performance Optimizations

- **Downscaling**: Analyzes 1/4 resolution (4x faster)
- **Threshold-based**: Only counts significant pixel changes
- **Debouncing**: Configurable check interval
- **Canvas reuse**: Single canvas instance, no allocations

---

## Future Enhancements

- [ ] Directional movement detection (left/right/up/down)
- [ ] Gesture recognition (shake, tilt)
- [ ] Adaptive sensitivity based on lighting
- [ ] Motion history tracking

---

## Dependencies

- `camera-access` module (for MediaStream)
- Native Canvas API
