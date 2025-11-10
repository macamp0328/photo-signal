# Photo Recognition Module

## Purpose

Identify photos from camera stream using perceptual hashing (dHash algorithm) and match to concert data.

## Responsibility

**ONLY** handles:

- Analyzing video frames for photo detection using dHash perceptual hashing
- Matching photos to concert data using Hamming distance
- Providing recognition results with confidence scoring

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
  recognitionDelay?: number;     // Delay before confirming match (ms), default 1000
  enabled?: boolean;             // Enable/disable recognition, default true
  similarityThreshold?: number;  // Hamming distance threshold (0-64), default 10
  checkInterval?: number;        // Interval for checking frames (ms), default 1000
}
```

**Output**:

```typescript
{
  recognizedConcert: Concert | null;    // Matched concert or null
  isRecognizing: boolean;               // True during potential match
  reset: () => void;                    // Reset recognition state
}
```

**Side Effects**:

- Fetches concert data from `data-service`
- Analyzes video frames periodically
- Computes perceptual hashes of frames
- Compares hashes with stored photo hashes
- Triggers recognition after stability period

---

## Implementation: Perceptual Hashing (dHash)

**Algorithm**: dHash (Difference Hash)

This module uses a lightweight, client-side perceptual hashing algorithm to recognize photos:

1. **Capture Frame**: Extract current video frame from MediaStream
2. **Resize**: Reduce to 9x8 pixels (optimized for speed)
3. **Grayscale**: Convert to grayscale using luminance formula
4. **Gradient Hash**: Compute horizontal pixel gradients
5. **Generate Hash**: Create 64-bit hash from gradient differences
6. **Compare**: Use Hamming distance to compare with stored hashes
7. **Match**: Recognize photo when distance < threshold for stable period

**Why dHash?**

Based on research in `docs/photo-recognition-research.md`:

- ✅ Fast: ~6-8ms per frame on mobile
- ✅ Accurate: 85-90% under varying conditions
- ✅ Small: ~3KB code size (zero dependencies)
- ✅ Private: 100% client-side processing
- ✅ Offline: Works without internet
- ✅ Robust: Handles brightness/contrast changes well

---

## Configuration

### Similarity Threshold

Controls how strict the matching is (Hamming distance):

- **0**: Exact match only (very strict, may miss valid photos)
- **5**: Very strict (90%+ similar)
- **10**: Balanced (default, ~85% similar)
- **15**: Lenient (allows more variation)
- **20**: Very lenient (may allow false positives)

**Recommendation**: Start with 10, adjust based on accuracy testing.

### Check Interval

How often to analyze frames (in milliseconds):

- **500ms**: High frequency (2 FPS) - faster response, more CPU
- **1000ms**: Balanced (1 FPS) - default, good performance
- **2000ms**: Low frequency (0.5 FPS) - slower response, less CPU

**Recommendation**: Use 1000ms for balance of responsiveness and performance.

### Recognition Delay

How long a photo must be stable before confirming match:

- **500ms**: Fast (may be too eager)
- **1000ms**: Balanced (default)
- **2000ms**: Conservative (ensures stability)

**Recommendation**: Use 1000ms to avoid false triggers while maintaining good UX.

---

## Debug Mode

When running in development mode (`import.meta.env.DEV`), the module logs:

- Hash values of each frame
- Similarity scores for each concert
- Match/lost match events
- Recognized concert confirmation

**Example console output**:

```
[Photo Recognition] Frame hash: a5b3c7d9e1f20486
[Photo Recognition] The Midnight Echoes: distance=8, similarity=87.5%
[Photo Recognition] Electric Dreams: distance=24, similarity=62.5%
[Photo Recognition] Potential match: The Midnight Echoes
[Photo Recognition] Recognized: The Midnight Echoes
```

---

## Usage Example

### Basic Usage

```typescript
import { useCameraAccess } from '@/modules/camera-access';
import { usePhotoRecognition } from '@/modules/photo-recognition';

function App() {
  const { stream } = useCameraAccess();
  const { recognizedConcert, isRecognizing, reset } = usePhotoRecognition(stream);

  useEffect(() => {
    if (recognizedConcert) {
      console.log('Recognized:', recognizedConcert.band);
    }
  }, [recognizedConcert]);

  return (
    <div>
      {isRecognizing && <p>Looking for photo...</p>}
      {recognizedConcert && (
        <div>
          <h2>{recognizedConcert.band}</h2>
          <button onClick={reset}>Reset</button>
        </div>
      )}
    </div>
  );
}
```

### Custom Configuration

```typescript
const { recognizedConcert } = usePhotoRecognition(stream, {
  similarityThreshold: 8,  // Stricter matching
  checkInterval: 500,      // Check more frequently
  recognitionDelay: 2000,  // Wait longer before confirming
});
```

---

## Photo Hash Generation

For the recognition to work, each concert in `data.json` must have a `photoHash` field:

```json
{
  "concerts": [
    {
      "id": 1,
      "band": "The Midnight Echoes",
      "venue": "The Fillmore",
      "date": "2023-08-15",
      "audioFile": "/audio/sample.mp3",
      "photoHash": "a5b3c7d9e1f20486"
    }
  ]
}
```

**To generate hashes:**

1. Take reference photo of printed concert photo
2. Capture frame or load image
3. Run through `computeDHash()` from `algorithms/dhash.ts`
4. Add resulting hash to concert data

**Future**: A CLI tool could automate hash generation from image files.

---

## Performance

**Measured Performance** (per research benchmarks):

| Device        | Hash Generation | Hamming Distance | Total Time |
| ------------- | --------------- | ---------------- | ---------- |
| iPhone 13 Pro | 6ms             | 0.1ms            | ~6ms       |
| Pixel 7       | 8ms             | 0.1ms            | ~8ms       |
| Desktop       | 3ms             | 0.05ms           | ~3ms       |

**Accuracy**: 87% match rate under varying conditions  
**False Positive Rate**: 2%  
**False Negative Rate**: 11%

**Performance Tips**:

- Reduce `checkInterval` only if needed (higher CPU usage)
- Ensure good lighting for best accuracy
- Hold photo stable during recognition
- Guide users to 12-18 inches from camera

---

## Tuning for Your Use Case

### High Accuracy Required

```typescript
usePhotoRecognition(stream, {
  similarityThreshold: 5,   // Stricter
  recognitionDelay: 2000,   // Longer confirmation
});
```

### Fast Response Required

```typescript
usePhotoRecognition(stream, {
  checkInterval: 500,       // Check more often
  recognitionDelay: 500,    // Quicker confirmation
  similarityThreshold: 12,  // Slightly lenient
});
```

### Battery Saving

```typescript
usePhotoRecognition(stream, {
  checkInterval: 2000,      // Check less often
  recognitionDelay: 1000,
});
```

---

## Testing

To test the recognition:

1. Add test hashes to concert data
2. Print reference photos
3. Point camera at photos under various conditions:
   - Different lighting (bright, dim, mixed)
   - Different angles (0°, 15°, 30°)
   - Different distances (6", 12", 24")
4. Monitor debug console for similarity scores
5. Adjust `similarityThreshold` based on results

**Target**: >80% recognition rate in your environment

---

## Troubleshooting

**Problem**: Not recognizing photos

- Check that concerts have `photoHash` field
- Verify hash was computed from correct photo
- Try increasing `similarityThreshold` (e.g., 15)
- Check console logs for similarity scores
- Ensure good lighting

**Problem**: False recognitions

- Decrease `similarityThreshold` (e.g., 7)
- Increase `recognitionDelay` for more stability
- Ensure reference photos are distinct

**Problem**: Slow performance

- Increase `checkInterval` (e.g., 2000ms)
- Check browser console for errors
- Verify video stream is working

---

## Future Enhancements

- [ ] Upgrade to pHash for higher accuracy (90-95%)
- [ ] Add confidence scoring (0-100%)
- [ ] Multi-photo detection (recognize multiple prints)
- [ ] Offline training data bundling
- [ ] CLI tool for hash generation
- [ ] Automatic threshold calibration
- [ ] Hash export/import for testing

---

## Dependencies

- `data-service` (concert data)
- `camera-access` (video stream)
- `algorithms/dhash` (hash generation)
- `algorithms/hamming` (hash comparison)

## Module Files

- `usePhotoRecognition.ts` - Main hook implementation
- `algorithms/dhash.ts` - dHash algorithm
- `algorithms/hamming.ts` - Hamming distance calculator
- `algorithms/utils.ts` - Image processing utilities
- `types.ts` - TypeScript interfaces
- `README.md` - This documentation
