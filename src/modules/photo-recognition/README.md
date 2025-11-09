# Photo Recognition Module

## Purpose
Identify photos from camera stream and match to concert data.

## Responsibility
**ONLY** handles:
- Analyzing video frames for photo detection
- Matching photos to concert data
- Providing recognition results

**Does NOT** handle:
- Camera access (see `camera-access` module)
- Data loading (see `data-service`)
- UI display (see `concert-info` module)
- Audio playback (see `audio-playback` module)

---

## API Contract

### Hook: `usePhotoRecognition(stream, options?)`

**Input**:
```typescript
stream: MediaStream | null       // Camera video stream
options?: {
  recognitionDelay?: number;     // Delay before triggering (ms), default 3000
  enabled?: boolean;             // Enable/disable recognition, default true
}
```

**Output**:
```typescript
{
  recognizedConcert: Concert | null;    // Matched concert or null
  isRecognizing: boolean;               // True during recognition process
  reset: () => void;                    // Reset recognition state
}
```

**Side Effects**:
- Fetches concert data from `data-service`
- Analyzes video frames periodically
- Triggers recognition after stability period

---

## Current Implementation: Placeholder

**Algorithm**: Simulate recognition after 3-second delay

This is intentionally simple for MVP. The modular design allows easy replacement
with real ML-based recognition without touching other modules.

**Why placeholder?**
- Allows full app development/testing
- Real ML integration requires training data
- Can be upgraded by separate AI agent later

---

## Future Implementation: ML-Based

When ready for real recognition:

1. **Perceptual Hashing** (pHash)
   - Generate hash of camera frame
   - Compare with pre-computed photo hashes
   - Fast, works offline
   
2. **ML Model** (TensorFlow.js)
   - Train on concert photo dataset
   - Run inference in browser
   - More accurate, requires training

3. **Hybrid Approach**
   - pHash for initial filtering
   - ML for final confirmation
   - Best accuracy + performance

**No changes needed to other modules!** Just swap implementation.

---

## Usage Example

```typescript
import { useCameraAccess } from '@/modules/camera-access';
import { usePhotoRecognition } from '@/modules/photo-recognition';

function App() {
  const { stream } = useCameraAccess();
  const { recognizedConcert, reset } = usePhotoRecognition(stream);

  useEffect(() => {
    if (recognizedConcert) {
      console.log('Recognized:', recognizedConcert.band);
    }
  }, [recognizedConcert]);
}
```

---

## Configuration

### Recognition Delay

- **1000ms**: Fast, may trigger too early
- **3000ms**: Balanced (default)
- **5000ms**: Conservative, waits for stability

---

## Performance

**Current (Placeholder)**:
- Near-zero CPU usage
- Simple timeout-based

**Future (ML)**:
- ~10-50ms inference per frame
- GPU acceleration via WebGL
- Efficient frame sampling (not every frame)

---

## Future Enhancements

- [ ] Real perceptual hashing (pHash)
- [ ] ML-based image classification
- [ ] Confidence scoring (0-100%)
- [ ] Multi-photo detection (recognize multiple prints)
- [ ] Offline training data bundling
- [ ] Privacy-first: all processing client-side

---

## Dependencies

- `data-service` (concert data)
- `camera-access` (video stream)
