# Phase 2: Angle Compensation - Implementation Recommendations

> **Purpose**: Analysis and recommendations for implementing angle compensation to handle extreme angles (>30°) better.
>
> **Status**: Research complete, implementation deferred
>
> **Date**: 2025-11-16

---

## Problem Statement

From the exploratory analysis:

- **Extreme Angles** (>30°) affect ~20% of recognition attempts
- Accuracy drops to **48%** when photos are at 30-45° angles
- Perspective distortion changes aspect ratios and gradient patterns
- Current system relies on user positioning (framing guide)

**Goal**: Reduce angle-related failures by ~50% (from 10.4% to ~5.2% of total attempts)

---

## Approach 1: pHash Algorithm (IMPLEMENTED ✅)

**Status**: Completed in Phase 2

The DCT-based pHash algorithm is inherently more robust to perspective distortion than dHash:

- Focuses on low-frequency components (overall structure)
- Less sensitive to edge distortion from angles
- Expected 15-30% better at handling perspective

**Recommendation**: Test pHash effectiveness first before adding complexity. The exploratory analysis suggests pHash alone may provide sufficient angle robustness for most use cases.

---

## Approach 2: Multi-Angle Reference Hashes

### Concept

Instead of perspective correction, generate reference hashes at multiple simulated angles:

- 0° (frontal)
- 15° (slight tilt)
- 30° (moderate angle)
- 45° (extreme angle)

Store all angle variants and match against whichever is closest.

### Implementation

```typescript
// Generate multi-angle hashes (script)
function generateAngleVariants(imageData: ImageData): string[] {
  const angles = [0, 15, 30, 45];
  return angles.map(angle => {
    const transformed = simulatePerspective(imageData, angle);
    return computePHash(transformed);  // Use pHash for robustness
  });
}

// Data structure
{
  "id": 1,
  "band": "Concert Name",
  "photoHash": {
    "0deg": "a5b3c7d9e1f20486",
    "15deg": "b6c4d8e2f3a10597",
    "30deg": "c7d5e9f1a2b30849",
    "45deg": "d8e6f2a3b4c51062"
  }
}

// Matching logic
function findBestAngleMatch(frameHash: string, concertHashes: object): Match {
  const angles = ['0deg', '15deg', '30deg', '45deg'];
  let bestMatch = null;
  let bestDistance = Infinity;

  for (const angle of angles) {
    const distance = hammingDistance(frameHash, concertHashes[angle]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestMatch = { angle, distance };
    }
  }

  return bestMatch;
}
```

### Pros

✅ Relatively simple implementation
✅ No runtime perspective correction needed
✅ Works with existing matching logic
✅ Can combine with pHash for best results

### Cons

⚠️ 4x storage for reference hashes
⚠️ 4x comparison time (still fast: ~40ms total)
⚠️ Requires regenerating all reference hashes
⚠️ Simulated perspective may not match real angles perfectly

### Effort

**Estimated**: 2-3 days

- Implement perspective transformation (2D matrix transforms)
- Update hash generation scripts
- Regenerate reference hashes
- Update matching logic
- Test and validate

---

## Approach 3: OpenCV.js Perspective Correction

### Concept

Use OpenCV.js to detect photo edges and apply perspective correction:

1. Detect photo edges in camera frame
2. Find corners/keypoints
3. Apply perspective warp to straighten photo
4. Hash the corrected image

### Implementation Sketch

```typescript
import cv from 'opencv.js';

function correctPerspective(imageData: ImageData): ImageData {
  // Convert to OpenCV Mat
  const src = cv.matFromImageData(imageData);
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  // Edge detection
  const edges = new cv.Mat();
  cv.Canny(gray, edges, 50, 150);

  // Find contours
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  // Find largest rectangular contour (the photo)
  const photoContour = findLargestRect(contours);

  // Get perspective transform
  const corners = getCorners(photoContour);
  const transform = cv.getPerspectiveTransform(corners, targetCorners);

  // Warp to frontal view
  const corrected = new cv.Mat();
  cv.warpPerspective(src, corrected, transform, new cv.Size(width, height));

  // Convert back to ImageData
  return matToImageData(corrected);
}
```

### Pros

✅ Most accurate perspective correction
✅ Handles arbitrary angles
✅ Single reference hash per photo
✅ Industry-standard approach

### Cons

❌ Very large bundle size (~4-6 MB for OpenCV.js)
❌ High complexity (edge detection, contour finding)
❌ Slower processing (~50-100ms additional)
❌ May fail if photo edges not clearly visible
❌ Requires photo to fill frame reasonably well

### Effort

**Estimated**: 5-7 days

- Integrate OpenCV.js (handle WASM loading)
- Implement edge/contour detection
- Tune parameters for photo detection
- Handle failure cases
- Extensive testing
- Optimize performance

---

## Approach 4: Enhanced Framing Guide (User-Driven)

### Concept

Instead of algorithmic correction, improve the framing guide to help users position photos at better angles:

- Visual feedback showing detected angle
- Suggestions to adjust angle ("Tilt photo toward you")
- Accept photos at angles but guide toward 0-15°

### Implementation

```typescript
// Estimate angle from perspective distortion
function estimatePhotoAngle(imageData: ImageData): number {
  // Analyze aspect ratio distortion
  // Detect edge slopes
  // Return estimated angle in degrees
}

// UI feedback
function FramingGuideWithAngleFeedback() {
  const angle = estimatePhotoAngle(currentFrame);

  return (
    <div className="framing-guide">
      {angle > 30 && (
        <div className="angle-warning">
          ⚠️ Photo tilted {angle}° - move camera to face photo directly
        </div>
      )}
      {angle > 15 && angle <= 30 && (
        <div className="angle-hint">
          💡 Slight tilt detected - try facing photo more directly
        </div>
      )}
    </div>
  );
}
```

### Pros

✅ Very small implementation (UI only)
✅ No bundle size impact
✅ Fast (angle estimation is simple)
✅ Guides user toward ideal conditions
✅ Can combine with pHash

### Cons

⚠️ Relies on user compliance
⚠️ Doesn't technically "solve" angle problem
⚠️ May frustrate users in challenging scenarios
⚠️ Angle estimation may be inaccurate

### Effort

**Estimated**: 1 day

- Implement simple angle estimation
- Add UI feedback component
- Test UX

---

## Recommendation: Phased Approach

### Phase 2A (Current): pHash Only

**Status**: ✅ Complete

Implement pHash and validate its angle robustness:

- Benchmark angle performance (30°, 45°)
- Measure improvement vs dHash
- Document findings

**If pHash achieves <8% angle failures**: Ship it, done!

### Phase 2B (If Needed): Multi-Angle Hashes

**Effort**: 2-3 days

If pHash alone doesn't reduce angle failures enough:

- Implement multi-angle reference hashing
- Test with 0°, 15°, 30°, 45° variants
- Validate improvement

**If this achieves <5% angle failures**: Ship it, done!

### Phase 2C (Future): OpenCV Correction

**Effort**: 5-7 days, only if absolutely necessary

Reserve for:

- Production deployment with >50 photos
- Mission-critical accuracy requirements
- After validating pHash + multi-angle isn't sufficient

### Phase 2D (Always): Enhanced Framing Guide

**Effort**: 1 day, can run in parallel

Low-cost addition that helps regardless:

- Implement angle feedback
- Guide users toward better positioning
- Complements any algorithmic approach

---

## Decision Matrix

| Approach           | Accuracy Gain | Bundle Impact | Performance | Complexity | Recommended |
| ------------------ | ------------- | ------------- | ----------- | ---------- | ----------- |
| pHash (done)       | +15-30%       | +0.83 KB      | 15-25ms     | Low        | ✅ YES      |
| Multi-Angle Hashes | +20-40%       | Minimal       | 4x matching | Medium     | ⏸️ MAYBE    |
| OpenCV Correction  | +40-60%       | +4-6 MB       | +50-100ms   | High       | ❌ DEFER    |
| Enhanced Guide     | +10-20%       | 0 KB          | 0ms         | Low        | ✅ YES      |

---

## Current Status & Next Steps

### Completed (Phase 2)

✅ pHash algorithm implemented
✅ Failure diagnostics with angle tracking
✅ Documentation and benchmarking guide

### Recommended Next Steps

1. **Benchmark pHash** (Task 5):
   - Test at 30°, 45°, 60° angles
   - Measure angle failure rate
   - Compare to 10.4% baseline

2. **If pHash sufficient** (angle failures <8%):
   - ✅ Close Task 3 (angle compensation)
   - ✅ Complete Task 5 (benchmarking)
   - ✅ Close Issue #136

3. **If pHash insufficient** (angle failures still >8%):
   - Implement Enhanced Framing Guide (1 day)
   - Re-test
   - If still insufficient, implement Multi-Angle Hashes (2-3 days)

4. **Reserve OpenCV** for future:
   - Only if deployed at scale
   - Only if accuracy requirements >95%
   - Only if bundle size budget increases

---

## Conclusion

**pHash is likely sufficient** for Phase 2 goals. The DCT-based algorithm provides inherent angle robustness. Combined with:

- Frame quality filtering (blur/glare rejection)
- Multi-exposure hashing (lighting robustness)
- Failure diagnostics (visibility into what's failing)

We should **benchmark first**, then implement additional angle handling only if data shows it's needed.

**Recommended path**: Test, measure, iterate based on data rather than pre-optimizing.
