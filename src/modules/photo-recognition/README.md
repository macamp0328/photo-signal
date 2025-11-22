# Photo Recognition Module

## Purpose

Identify photos from camera stream using perceptual hashing (dHash or pHash algorithms) and match to concert data.

## Responsibility

**ONLY** handles:

- Analyzing video frames for photo detection using perceptual hashing (dHash or pHash)
- Matching photos to concert data using Hamming distance
- Providing recognition results with confidence scoring
- Tracking failure diagnostics for debugging and optimization

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
  recognitionDelay?: number;     // Delay before confirming match (ms), default 3000
  enabled?: boolean;             // Enable/disable recognition, default true
  similarityThreshold?: number;  // Hamming distance threshold (0-64), default 40
  checkInterval?: number;        // Interval for checking frames (ms), default 1000
  enableDebugInfo?: boolean;     // Enable debug information output, default false
  aspectRatio?: '3:2' | '2:3';   // Aspect ratio for frame cropping (default '3:2')
  hashAlgorithm?: 'dhash' | 'phash';  // Hash algorithm to use (default 'dhash')
  sharpnessThreshold?: number;   // Sharpness threshold for blur detection (default 100)
  glareThreshold?: number;       // Glare detection threshold (default 250)
  glarePercentageThreshold?: number;  // Glare percentage threshold (default 20)
  enableMultiScale?: boolean;    // Enable multi-scale recognition for imprecise framing (default false)
  multiScaleVariants?: number[]; // Scale variants to try (default [0.75, 0.8, 0.85, 0.9])
}
```

**Output**:

```typescript
{
  recognizedConcert: Concert | null;    // Matched concert or null
  isRecognizing: boolean;               // True during potential match
  reset: () => void;                    // Reset recognition state
  debugInfo: RecognitionDebugInfo | null; // Debug information (when enabled)
}

// Debug info structure
interface RecognitionDebugInfo {
  lastFrameHash: string | null;       // Last computed frame hash
  bestMatch: BestMatchInfo | null;    // Best matching concert
  lastCheckTime: number;              // Timestamp of last check
  concertCount: number;               // Number of concerts checked
  frameCount: number;                 // Frames processed since start
  checkInterval: number;              // Active frame sampling interval
  aspectRatio: AspectRatio;           // Active framing aspect ratio
  frameSize: { width: number; height: number } | null; // Cropped frame size
  stability: StabilityDebugInfo | null; // Countdown info for active candidate
  similarityThreshold: number;        // Active matching threshold (distance)
  recognitionDelay: number;           // Required hold duration (ms)
}

interface BestMatchInfo {
  concert: Concert;      // The matched concert
  distance: number;      // Hamming distance (0-64)
  similarity: number;    // Similarity percentage (0-100)
}

interface StabilityDebugInfo {
  concert: Concert;      // Candidate concert being confirmed
  elapsedMs: number;     // Time spent above threshold
  remainingMs: number;   // Time left before confirmation
  requiredMs: number;    // Total hold time required
  progress: number;      // 0-1 progress toward confirmation
}
```

**Side Effects**:

- Fetches concert data from `data-service`
- Analyzes video frames periodically
- Computes perceptual hashes of frames
- Compares hashes with stored photo hashes
- Triggers recognition after stability period

---

## Implementation: Functional Framing with Dual Hash Algorithms

**Algorithms**: dHash (Difference Hash) or pHash (Perceptual Hash) with Functional Frame Cropping

This module supports two perceptual hashing algorithms with **functional frame cropping** to recognize photos:

### Algorithm Choice: dHash vs pHash

**dHash (Default)** - Difference Hash:

- ✅ **Fast**: ~6-8ms per frame on mobile
- ✅ **Small**: ~3KB code size
- ✅ **Good accuracy**: 85-90% under ideal conditions
- ⚠️ Less robust to extreme angles and perspective distortion
- 📊 **Hash size**: 128-bit (32 hex characters)
- **Best for**: Controlled environments, good lighting, frontal angles

**pHash** - Perceptual Hash with DCT:

- ✅ **More robust**: 15-30% better at handling angles and lighting
- ✅ **Lower false positives**: Better discrimination between similar photos
- ✅ **Handles perspective**: DCT-based algorithm more resilient to distortion
- ⚠️ **Slower**: ~15-25ms per frame on mobile (still acceptable)
- ⚠️ **Larger**: +8KB code size
- 📊 **Hash size**: 64-bit (16 hex characters)
- **Best for**: Challenging conditions, varied angles, larger galleries

### Recognition Pipeline

1. **Capture Frame**: Extract current video frame from MediaStream
2. **Quality Check**: Filter out blurry frames (motion blur) and frames with glare
3. **Crop to Framed Region**: Extract only pixels inside the framing guide (3:2 or 2:3)
4. **Resize**: Reduce cropped region based on algorithm:
   - dHash: 17×8 pixels (optimized for speed)
   - pHash: 32×32 pixels (for DCT computation)
5. **Grayscale**: Convert to grayscale using ITU-R BT.601 luma coefficients
6. **Hash Generation**:
   - dHash: Compute horizontal pixel gradients → 128-bit hash
   - pHash: Compute DCT → Extract low-frequency coefficients → 64-bit hash
7. **Compare**: Use Hamming distance to compare with stored hashes
8. **Match**: Recognize photo when distance < threshold for stable period

### Functional Framing

The photo recognition module **focuses on the region most likely to contain the photo**:

- ✅ Auto aspect ratio: picks 3:2 when the video feed is wider, 2:3 when taller
- ✅ Rectangle detection (default on): uses detected photo bounds when confidence is high
- ✅ Falls back to a centered crop (~80% of viewport) when detection is unavailable
- ✅ Reduces background noise and false positives

### Quality Filtering (Phase 1)

Before computing hashes, frames are checked for quality issues:

**Motion Blur Detection**:

- Uses Laplacian variance to measure sharpness
- Rejects frames below sharpness threshold (default: 100)
- Prevents hashing blurry frames that won't match

**Glare Detection**:

- Detects blown-out pixels (>250 brightness)
- Rejects frames with >20% glare coverage (configurable)
- Prevents hashing frames with reflections

### Failure Diagnostics

The module tracks detailed failure categories for debugging:

- **motion-blur**: Frame too blurry (camera shake, motion)
- **glare**: Excessive reflections on photo surface
- **no-match**: No concert hash similar enough
- **collision**: Multiple photos with similar hashes
- **poor-quality**: Other quality issues
- **unknown**: Unclassified failures

Telemetry is available in Test Mode showing:

- Failure counts by category
- Percentage breakdown
- Last 10 failures with timestamps and reasons

---

## Configuration

### Similarity Threshold

Controls how strict the matching is (Hamming distance):

- **20** (~92% similarity): Ultra strict, requires near-perfect match
- **30** (~88% similarity): Strict, good lighting required
- **40** (~84% similarity, **default**): Balanced for real-world lighting and phones
- **50** (~80% similarity): Lenient, may allow more drift but risks false positives

**Recommendation**: Start with 40, then tighten/loosen based on environment.

### Check Interval

How often to analyze frames (in milliseconds):

- **500ms**: High frequency (2 FPS) - faster response, more CPU
- **1000ms**: Balanced (1 FPS) - default, good performance
- **2000ms**: Low frequency (0.5 FPS) - slower response, less CPU

**Recommendation**: Use 1000ms for balance of responsiveness and performance.

### Recognition Delay

How long a photo must be stable before confirming match:

- **1000ms**: Fast (good for rapid testing but prone to false triggers)
- **2000ms**: Balanced
- **3000ms**: **Default** – enough time for handheld wobble to settle
- **4000ms+**: Very conservative (installations with lots of motion/noise)

**Recommendation**: Use 3000ms for physical photos, then dial down if your environment is very stable. You can adjust this value from the Secret Settings menu (Custom Settings → Recognition Delay).

### Multi-Scale Recognition (Relaxed Framing)

**NEW**: Enable multi-scale recognition to support imprecise photo alignment and relaxed framing requirements.

**What it does:**

- Instead of analyzing only one crop scale (80% of viewport), the system tests multiple scales
- Generates hashes at different crop sizes (e.g., 75%, 80%, 85%, 90%)
- Matches against all scales to find the best fit
- Automatically uses the scale that produces the best match

**Benefits:**

- ✅ More forgiving for users who don't align photos precisely
- ✅ Recognizes photos that extend beyond the framing guide
- ✅ Recognizes photos that don't fully fill the framing guide
- ✅ Handles small borders, background visible around photo edges
- ✅ Reduces user frustration with "fill the box" requirements

**Configuration:**

```typescript
// Enable with default scales (75%, 80%, 85%, 90%)
const { recognizedConcert } = usePhotoRecognition(stream, {
  enableMultiScale: true,
});

// Customize scale variants - these REPLACE the defaults entirely
const { recognizedConcert } = usePhotoRecognition(stream, {
  enableMultiScale: true,
  multiScaleVariants: [0.7, 0.8, 0.9, 0.95], // Test exactly these 4 scales
});

// For better performance with fewer scales
const { recognizedConcert } = usePhotoRecognition(stream, {
  enableMultiScale: true,
  multiScaleVariants: [0.8, 0.9], // Test only 2 scales
});
```

**Important Note:** When you provide custom `multiScaleVariants`, those scales completely replace the defaults. If you want to include 80% (the default crop), make sure to include `0.8` in your custom array.

**Performance Considerations:**

- Additional hashes are only computed for quality frames (after blur/glare checks pass)
- Minimal performance impact: ~2-4ms per scale on mobile
- Default 4 scales = ~6-15ms total (still fast enough for real-time recognition)
- Each scale in your custom variants is tested - fewer scales = better performance

**When to use:**

- **Enable** if users struggle with precise alignment or framing
- **Enable** if photos frequently have small borders or background visible
- **Enable** in dynamic environments (handheld, moving photos)
- **Disable** (default) for controlled installations with stable mounting

**Default:** Disabled for backward compatibility and optimal performance

---

## Debug Mode

### Enhanced Logging (Dev Mode & Test Mode)

When running in development mode (`import.meta.env.DEV`) or when Test Mode is enabled, the module provides detailed logging:

**Initialization Logs**:

```
============================================================
[Photo Recognition] Initializing recognition system
  Concerts loaded: 4
  Concerts with hashes: 4
  Similarity threshold: 40 (≥84.4% match)
  Recognition delay: 3000ms
  Check interval: 1000ms
  Test Mode: ON

  Available hashes:
    The Midnight Echoes: 000000042a000000
    Electric Dreams: 0000000416000000
============================================================
```

**Frame-by-Frame Logs**:

```
============================================================
[Photo Recognition] FRAME 42 @ 12:34:56.789
Frame Hash: a5b3c7d9e1f20486
Frame Size: 640 × 480 px (cropped)
Cropped Region: x=64, y=108, w=512, h=341
Aspect Ratio: 3:2
Concerts Checked: 4
Threshold: 40 (similarity ≥ 84.4%)

Results:
  ✓ The Midnight Echoes: distance=6, similarity=90.6% ← BEST MATCH
  ✗ Electric Dreams: distance=24, similarity=62.5%
  ✗ Velvet Revolution: distance=31, similarity=51.6%
  ✗ Sunset Boulevard: distance=28, similarity=56.3%

Match Decision: POTENTIAL MATCH (The Midnight Echoes)
  Distance: 6 / 10 threshold
  Similarity: 90.6%
  Stability Timer: 1.2s / 3.0s required
============================================================
```

**Recognition Confirmation**:

```
🎵 RECOGNIZED! The Midnight Echoes
============================================================
```

### Debug Information API

Enable debug information output with `enableDebugInfo` option:

```typescript
const { recognizedConcert, debugInfo } = usePhotoRecognition(stream, {
  enableDebugInfo: true, // Enables debugInfo return value
});

// debugInfo contains:
// - lastFrameHash: Hash of the last processed frame
// - bestMatch: { concert, distance, similarity }
// - lastCheckTime: Timestamp of last frame check
// - concertCount: Number of concerts being checked
```

Use `debugInfo` with the DebugOverlay component for real-time visualization:

```typescript
import { DebugOverlay } from '@/modules/debug-overlay';

function App() {
  const { debugInfo, recognizedConcert, isRecognizing } = usePhotoRecognition(stream, {
    enableDebugInfo: isTestMode,
  });

  return (
    <>
      {/* Your app UI */}
      <DebugOverlay
        enabled={isTestMode}
        recognizedConcert={recognizedConcert}
        isRecognizing={isRecognizing}
        debugInfo={debugInfo}
      />
    </>
  );
}
```

---

## Generating Photo Hashes

Photo hashes are required for recognition to work. Each concert should now include a `photoHashes` object (with per-algorithm arrays) plus the legacy `photoHash` array for backwards compatibility.

### Hash Format

Photo hashes are hexadecimal strings generated by the perceptual hashing algorithms (`dhash` = 32 chars, `phash` = 16 chars). Store them per-algorithm:

```json
{
  "id": 1,
  "band": "The Midnight Echoes",
  "venue": "The Fillmore",
  "date": "2023-08-15",
  "audioFile": "/audio/concert-1.opus",
  "photoHashes": {
    "phash": ["a5b3c7d9e1f20486", "a5b3c7d9e1f20487", "a5b3c7d9e1f20488"],
    "dhash": [
      "00000000000001600acc000000000000",
      "00000000000001600acc000000000000",
      "00000000000001600acc000000000000"
    ]
  },
  "photoHash": ["a5b3c7d9e1f20486", "a5b3c7d9e1f20487", "a5b3c7d9e1f20488"]
}
```

> `photoHash` (singular) mirrors `photoHashes.phash` for older builds. New code should read from `photoHashes` first.

### Hash Generation Tools

Two tools are available to generate photo hashes:

#### 1. Browser-Based Tool (Easiest)

Open `scripts/generate-photo-hashes.html` in your browser:

1. Drag and drop image files onto the page
2. Hashes are computed instantly using the same algorithm
3. Copy individual hashes or the complete JSON output
4. Add hashes to your concert data

**Features**:

- No installation required
- Visual preview of images
- Drag-and-drop interface
- Copy-to-clipboard functionality

#### 2. Node.js Script (For Automation)

Run the command-line script:

```bash
# Place images in assets/test-images/
npm run generate-hashes

# Output will show hashes for all images:
# concert-1.jpg: a5b3c7d9e1f20486
# concert-2.jpg: b6c4d8e2f3a10597
# ...
```

**Features**:

- Batch processing
- JSON output for easy copy-paste
- Can be integrated into build scripts
- Consistent with browser tool

### Hash Algorithms

The hash generation supports both **dHash** and **pHash** algorithms:

#### dHash (Difference Hash)

1. **Resize** image to 17×8 pixels (136 pixels total)
2. **Convert** to grayscale using ITU-R BT.601 luma coefficients
3. **Calculate** horizontal gradient differences (left vs. right neighbor)
4. **Generate** 128-bit binary hash based on differences
5. **Encode** as 32-character hexadecimal string

**Characteristics**:

- Fast: ~6-8ms on mobile devices
- Compact: 32 hex characters per hash
- Good for: Ideal conditions, frontal angles

#### pHash (Perceptual Hash)

1. **Resize** image to 32×32 pixels
2. **Convert** to grayscale using ITU-R BT.601 luma coefficients
3. **Compute** 2D Discrete Cosine Transform (DCT)
4. **Extract** low-frequency coefficients (top-left 8×8, skip DC component)
5. **Calculate** median of coefficients
6. **Generate** 64-bit binary hash (1 if > median, 0 otherwise)
7. **Encode** as 16-character hexadecimal string

**Characteristics**:

- Slower: ~15-25ms on mobile devices
- More robust: Better handles angles, lighting, perspective
- Compact: 16 hex characters per hash
- Good for: Challenging conditions, varied environments

**Algorithm Selection**:

```bash
# Generate dHash values (default)
node scripts/generate-photo-hashes.js --algorithm dhash assets/test-images/

# Generate pHash values (more robust)
node scripts/generate-photo-hashes.js --algorithm phash assets/test-images/
```

For technical details, see `algorithms/dhash.ts` and `algorithms/phash.ts`.

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
// Use pHash for better robustness to angles and lighting
const { recognizedConcert } = usePhotoRecognition(stream, {
  hashAlgorithm: 'phash', // Use pHash instead of dHash
  similarityThreshold: 40, // Stricter matching
  checkInterval: 500, // Check more frequently
  recognitionDelay: 2000, // Faster confirmation
});
```

### Using pHash for Challenging Conditions

```typescript
// Optimal settings for challenging environments
const { recognizedConcert } = usePhotoRecognition(stream, {
  hashAlgorithm: 'phash', // More robust algorithm
  similarityThreshold: 35, // Slightly stricter
  sharpnessThreshold: 80, // More lenient blur detection
  glarePercentageThreshold: 25, // More lenient glare detection
});
```

### With Aspect Ratio Toggle

```typescript
import { useState } from 'react';
import type { AspectRatio } from '@/modules/photo-recognition';

function App() {
  const { stream } = useCameraAccess();
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('3:2');

  const { recognizedConcert } = usePhotoRecognition(stream, {
    aspectRatio,
  });

  return (
    <div>
      <button onClick={() => setAspectRatio(prev => prev === '3:2' ? '2:3' : '3:2')}>
        Toggle Aspect Ratio
      </button>
      {recognizedConcert && <h2>{recognizedConcert.band}</h2>}
    </div>
  );
}
```

### With Multi-Scale for Imprecise Framing

```typescript
// Recommended settings for handheld/dynamic use
const { recognizedConcert } = usePhotoRecognition(stream, {
  enableMultiScale: true, // Enable relaxed framing
  multiScaleVariants: [0.75, 0.8, 0.85, 0.9], // Try 4 different crop scales
  similarityThreshold: 40, // Keep default threshold
  recognitionDelay: 3000, // Keep default stability time
});

// For even more flexibility (accepts smaller photos in frame)
const { recognizedConcert } = usePhotoRecognition(stream, {
  enableMultiScale: true,
  multiScaleVariants: [0.65, 0.75, 0.85, 0.95], // Wider range of scales
});
```

---

## Photo Hash Generation

For the recognition to work, each concert in `data.json` must have a `photoHashes` object (and, for now, the mirror `photoHash` array):

```json
{
  "concerts": [
    {
      "id": 1,
      "band": "The Midnight Echoes",
      "venue": "The Fillmore",
      "date": "2023-08-15",
      "audioFile": "/audio/sample.opus",
      "photoHashes": {
        "phash": ["a5b3c7d9e1f20486", "a5b3c7d9e1f20487", "a5b3c7d9e1f20488"],
        "dhash": [
          "00000000000001600acc000000000000",
          "00000000000001600acc000000000000",
          "00000000000001600acc000000000000"
        ]
      },
      "photoHash": ["a5b3c7d9e1f20486", "a5b3c7d9e1f20487", "a5b3c7d9e1f20488"]
    }
  ]
}
```

**To generate hashes:**

1. Take reference photo of printed concert photo
2. Capture frame or load image
3. Run through `computeDHash()` or `computePHash()` from `algorithms/*`
4. Add resulting hash array to the matching `photoHashes` algorithm key (and keep the legacy `photoHash` array in sync with `phash` values)

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
  similarityThreshold: 5, // Stricter
  recognitionDelay: 2000, // Longer confirmation
});
```

### Fast Response Required

```typescript
usePhotoRecognition(stream, {
  checkInterval: 500, // Check more often
  recognitionDelay: 500, // Quicker confirmation
  similarityThreshold: 12, // Slightly lenient
});
```

### Battery Saving

```typescript
usePhotoRecognition(stream, {
  checkInterval: 2000, // Check less often
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

- Check that concerts have `photoHashes.phash` (and `photoHashes.dhash` if you plan to test dHash)
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
