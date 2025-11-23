# ORB Feature Matching

This module implements feature-based photo matching using ORB (Oriented FAST and Rotated BRIEF) keypoint detection. ORB is significantly more robust than perceptual hashing (dHash/pHash) for matching photos despite print-to-camera transformations.

## Why ORB?

Unlike perceptual hashing which compares overall image structure, ORB extracts distinctive feature points (corners, edges) and creates binary descriptors for each. These features are:

- **Rotation invariant**: Photo can be tilted
- **Lighting invariant**: Handles different lighting conditions
- **Robust to distortion**: Tolerates perspective changes from camera angle

Multi-scale detection (scale invariance) is now implemented via a lightweight image pyramid so the camera frame is analyzed at progressively smaller scales before matching. This makes ORB more robust than perceptual hashing for matching camera photos of printed photos against original digital images even when the framing is loose or the photo is smaller in the viewport.

## Performance Comparison

| Method | Speed     | Print→Camera Robustness             | False Positive Risk |
| ------ | --------- | ----------------------------------- | ------------------- |
| dHash  | ~5ms      | Low (fails at 30-70 bit distance)   | Low                 |
| pHash  | ~10ms     | Low (fails at 30-70 bit distance)   | Low                 |
| ORB    | ~50-100ms | **High (QR-code-like reliability)** | Very Low            |

## Usage

### Basic Matching

```typescript
import { matchImages } from './orb';

// Match camera frame against reference photo
const result = matchImages(cameraImageData, referenceImageData);

if (result.isMatch) {
  console.log(`Match found! ${result.matchCount} features matched`);
  console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`);
} else {
  console.log('No match');
}
```

### Advanced Configuration

```typescript
import { extractORBFeatures, matchORBFeatures } from './orb';

const config = {
  maxFeatures: 500, // Max keypoints to detect
  fastThreshold: 20, // Corner detection sensitivity
  minMatchCount: 15, // Minimum matches to consider valid
  matchRatioThreshold: 0.7, // Lowe's ratio test threshold
};

// Extract features once for reference images (can be cached)
const refFeatures = extractORBFeatures(referenceImageData, config);

// Match against camera frame
const queryFeatures = extractORBFeatures(cameraImageData, config);
const result = matchORBFeatures(queryFeatures, refFeatures, config);
```

## Configuration Options

### `ORBConfig`

**Active Configuration Options:**

- **`maxFeatures`** (default: 500): Maximum number of keypoints to detect. Higher = more accurate but slower.
- **`fastThreshold`** (default: 20): Threshold for FAST corner detection. Lower = more corners detected.
- **`minMatchCount`** (default: 15): Minimum number of good matches to consider a valid match.
- **`matchRatioThreshold`** (default: 0.7): Lowe's ratio test threshold for filtering good matches. Lower = stricter matching (fewer false positives).

**Multi-Scale Controls (NEW):**

- `scaleFactor` – Scale factor between pyramid levels (default `1.2`). Smaller values create more overlap, larger values downscale faster.
- `nLevels` – Number of pyramid levels to evaluate (default `8`). Each level downsamples the previous one until it becomes too small (<16px) or the level limit is hit.
- `edgeThreshold` – Size of the border (in pixels) where features are not detected (default `31`). Helps ignore high-contrast edges at the frame boundary. The threshold is automatically clamped for very small images.

## Return Values

### `ORBMatchResult`

```typescript
{
  matchCount: number,          // Number of good matches found
  queryKeypointCount: number,  // Total keypoints in camera image
  refKeypointCount: number,    // Total keypoints in reference
  matchRatio: number,          // matchCount / min(query, ref)
  isMatch: boolean,            // true if matchCount >= minMatchCount
  confidence: number           // 0-1 confidence score
}
```

## Performance Optimization

### Pre-compute Reference Features

Since reference photos don't change, extract their features once and cache:

```typescript
// At app startup or when loading concerts
const referenceFeatures = new Map();

for (const concert of concerts) {
  const imageData = await loadImage(concert.imageFile);
  const features = extractORBFeatures(imageData);
  referenceFeatures.set(concert.id, features);
}

// During recognition (much faster)
const cameraFeatures = extractORBFeatures(cameraFrame);
for (const [id, refFeatures] of referenceFeatures) {
  const result = matchORBFeatures(cameraFeatures, refFeatures);
  if (result.isMatch) {
    console.log(`Matched concert ${id}`);
  }
}
```

### Adjust Parameters for Speed

For faster matching with slightly lower accuracy:

```typescript
const fastConfig = {
  maxFeatures: 300, // Fewer features
  minMatchCount: 10, // Lower threshold
  fastThreshold: 25, // Fewer corners
};
```

## Integration with Existing System

ORB can be used alongside dHash/pHash:

1. **Try dHash/pHash first** (fast, works for screen displays)
2. **Fall back to ORB** if no hash match found
3. **Or run ORB in parallel** for maximum reliability

Example:

```typescript
// Try perceptual hashing first
const hashMatch = await tryPerceptualHashing(frame);

if (!hashMatch) {
  // Fall back to ORB for printed photos
  const orbMatch = await tryORBMatching(frame);
  return orbMatch;
}

return hashMatch;
```

## Limitations

- **Processing Time**: ~50-100ms vs ~10ms for hashing
- **CPU Intensive**: May not be suitable for very low-end devices
- **Memory**: Stores 500+ keypoints + descriptors per reference image

## Future Enhancements

- **FLANN matcher**: Faster matching using approximate nearest neighbors
- **Geometric verification**: Use RANSAC to filter outliers
- **GPU acceleration**: Use WebGL for feature extraction
- **Pre-trained descriptors**: Cache and compress descriptor data
