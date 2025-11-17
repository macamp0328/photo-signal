# Phase 2: pHash + Diagnostics - Benchmarking Guide

> **Purpose**: Guide for benchmarking the Phase 2 enhancements (pHash algorithm and failure diagnostics) against the baseline performance documented in `image-recognition-exploratory-analysis.md`.
>
> **Status**: Ready for benchmarking
>
> **Date**: 2025-11-16

---

## Overview

Phase 2 implements:

1. **pHash Algorithm**: DCT-based perceptual hashing (more robust to angles and lighting)
2. **Failure Diagnostics**: Categorized failure tracking (motion-blur, glare, no-match, collision, etc.)
3. **Algorithm Toggle**: Runtime switching between dHash and pHash

This guide explains how to benchmark these improvements against the baseline established in the exploratory analysis.

---

## Baseline Performance (from Exploratory Analysis)

### dHash Accuracy by Condition

| Condition                          | True Positive | False Negative | False Positive | Accuracy |
| ---------------------------------- | ------------- | -------------- | -------------- | -------- |
| **Ideal** (good light, 0°, matte)  | 95%           | 5%             | 0%             | 95%      |
| **Good** (normal indoor, 0-15°)    | 87%           | 13%            | 0%             | 87%      |
| **Fair** (varied light/angle)      | 72%           | 25%            | 3%             | 72%      |
| **Poor** (low light or 30°+ angle) | 48%           | 47%            | 5%             | 48%      |
| **Challenging** (motion/glare)     | 35%           | 60%            | 5%             | 35%      |

**Average**: ~67% overall accuracy

### Failure Category Breakdown (Baseline)

| Failure Category  | Impact Weight | Accuracy When Present | Contribution to Miss Rate |
| ----------------- | ------------- | --------------------- | ------------------------- |
| Motion Blur       | 25%           | 35%                   | 16.3%                     |
| Extreme Angles    | 20%           | 48%                   | 10.4%                     |
| Poor Lighting     | 15%           | 52%                   | 7.2%                      |
| Glare/Reflections | 15%           | 38%                   | 9.3%                      |
| Similar Photos    | 10%           | 65%                   | 3.5%                      |
| Background Noise  | 10%           | 78%                   | 2.2%                      |

---

## Phase 2 Target Performance

### Success Criteria (from Issue #136)

1. **Overall Accuracy**: >=92% (up from 67% baseline)
2. **Extreme Angle Improvement**: 50% reduction in angle-related failures (from 10.4% to ~5.2%)
3. **Bundle Size**: <10 KB increase (actual: +0.83 KB ✅)
4. **Performance**: <25ms per hash on iPhone 13 Pro (needs validation)

### Expected Improvements

Based on research analysis, pHash should provide:

- **15-30% better** at handling perspective distortion and lighting
- **Lower false positive rate**: 1% vs 3-5% for dHash
- **Better discrimination**: Handles similar photos better

---

## Benchmarking Procedure

### Test Setup

**Equipment**:

- iPhone 13 Pro (primary test device)
- Pixel 7 (Android reference)
- Desktop browser (control)

**Test Images**:

- Use images from `assets/test-images/` and `assets/example-real-photos/`
- 12 concerts with pre-computed hashes

**Conditions to Test**:

1. **Ideal**: Good lighting, 0° angle, matte print, 12" distance
2. **Good**: Normal indoor light, 0-15° angle, 12-18" distance
3. **Fair**: Varied lighting, 15-30° angle, mixed distances
4. **Poor**: Low light or 30-45° angle
5. **Challenging**: Motion blur, glare, extreme angles (>45°)

### Test Protocol

For each condition, perform **5 attempts per concert** (60 total attempts):

1. **Enable Test Mode**:
   - Triple-tap to open Secret Settings
   - Enable "Test Mode" feature flag
   - This activates diagnostic logging

2. **Test dHash (Baseline)**:

   ```typescript
   // Use default dHash
   const { recognizedConcert, debugInfo } = usePhotoRecognition(stream, {
     hashAlgorithm: 'dhash', // default
     enableDebugInfo: true,
   });
   ```

   - Record: Success/Failure, Similarity %, Recognition time
   - Check console for telemetry and failure categories

3. **Test pHash (Phase 2)**:

   ```typescript
   // Use pHash for comparison
   const { recognizedConcert, debugInfo } = usePhotoRecognition(stream, {
     hashAlgorithm: 'phash',
     enableDebugInfo: true,
   });
   ```

   - Record: Success/Failure, Similarity %, Recognition time
   - Check console for telemetry and failure categories

4. **Collect Metrics**:
   - True Positives (correct recognition)
   - False Negatives (no match when should match)
   - False Positives (wrong concert recognized)
   - Failure category breakdown from telemetry
   - Average hash computation time (from debugInfo)

---

## Performance Benchmarking

### Hash Computation Speed

**dHash Baseline**: 6-8ms per frame (measured on iPhone 13 Pro)

**pHash Target**: <25ms per frame

**How to Measure**:

1. Open browser DevTools Console
2. Enable Test Mode
3. Point camera at photo
4. Check debug logs for timing:
   ```
   [Photo Recognition] FRAME 1 @ timestamp
   Frame Hash: [hash]  ← Generated in Xms
   ```

Use browser Performance API for precise measurements:

```typescript
const start = performance.now();
const hash = hashAlgorithm === 'phash' ? computePHash(imageData) : computeDHash(imageData);
const duration = performance.now() - start;
console.log(`Hash computation: ${duration.toFixed(2)}ms`);
```

### Bundle Size Impact

**Baseline**: 84.44 KB (gzipped)
**Phase 2**: 85.27 KB (gzipped)
**Increase**: +0.83 KB (8.3% of 10 KB budget) ✅

---

## Failure Diagnostics Validation

### Using the New Diagnostics

Phase 2 adds failure category tracking. When recognition fails, check the telemetry:

```
📊 Telemetry Summary:
  Total Frames: 100
  Quality Frames: 75 (75.0%)
  Blur Rejections: 15 (15.0%)
  Glare Rejections: 10 (10.0%)

  Failure Categories:
    motion-blur: 15 (15.0%)
    glare: 10 (10.0%)
    no-match: 5 (5.0%)
    collision: 0 (0%)

  Recent Failures (last 5):
    1. [10:30:15] motion-blur: Sharpness 85.2 below threshold 100
    2. [10:30:16] glare: 25.3% of frame blown out
    3. [10:30:20] no-match: Best match distance 45
```

### Validation Steps

1. **Verify Categorization**: Manually observe failures and confirm they're categorized correctly
2. **Angle Failure Reduction**: Compare angle-related failures between dHash and pHash
3. **Track Improvements**: Use failure percentages to validate 50% reduction goal

---

## Data Collection Template

### Accuracy Table

| Algorithm | Ideal | Good | Fair | Poor | Challenging | **Average** |
| --------- | ----- | ---- | ---- | ---- | ----------- | ----------- |
| dHash     | 95%   | 87%  | 72%  | 48%  | 35%         | **67%**     |
| pHash     | ?     | ?    | ?    | ?    | ?           | **?**       |

### Failure Category Comparison

| Category      | dHash Baseline | pHash Phase 2 | Improvement |
| ------------- | -------------- | ------------- | ----------- |
| Motion Blur   | 16.3%          | ?             | ?           |
| Extreme Angle | 10.4%          | ?             | ?           |
| Poor Lighting | 7.2%           | ?             | ?           |
| Glare         | 9.3%           | ?             | ?           |
| Collision     | 3.5%           | ?             | ?           |
| Noise         | 2.2%           | ?             | ?           |

### Performance Metrics

| Metric            | dHash    | pHash    | Within Target? |
| ----------------- | -------- | -------- | -------------- |
| Hash Time (ms)    | 6-8ms    | ?        | <25ms          |
| Bundle Size (KB)  | 84.44 KB | 85.27 KB | <94.44 KB ✅   |
| Memory Usage (MB) | <1 MB    | ?        | <2 MB          |

---

## Completing the Benchmark

### Steps to Finalize

1. **Run the tests** following the protocol above
2. **Fill in the data tables** with actual measurements
3. **Calculate improvements**:
   - Overall accuracy improvement
   - Angle failure reduction percentage
   - Performance validation
4. **Document findings** in a new section of `image-recognition-exploratory-analysis.md`
5. **Update the PR description** with benchmark results
6. **Attach results** to Issue #136 before closing

### Expected Outcome

If pHash meets targets:

- ✅ Overall accuracy >=92%
- ✅ Angle failures reduced by 50%
- ✅ Bundle size <10 KB increase
- ✅ Performance <25ms per hash
- ✅ Failure diagnostics working correctly

Then Phase 2 is **COMPLETE** and Issue #136 can be closed.

---

## Troubleshooting

### If pHash is slower than expected

- Check that DCT computation is optimized
- Consider caching or memoization
- Profile with browser DevTools Performance tab

### If accuracy is lower than expected

- Verify reference hashes are computed correctly with pHash
- Check similarity threshold (may need adjustment for 64-bit vs 128-bit hashes)
- Ensure multi-exposure hashes are being used

### If failure categories are incorrect

- Add more granular logging in usePhotoRecognition.ts
- Cross-reference visual observation with reported category
- Adjust categorization logic if needed

---

## Next Steps After Benchmarking

1. **Document Results**: Add benchmark section to exploratory analysis
2. **Update Documentation**: Link benchmark results in README
3. **Performance Optimization**: If needed based on results
4. **Angle Compensation**: Implement Task 3 if angle failures still high
5. **Production Deployment**: Generate pHash values for production dataset

---

**Note**: This is a living document. Update with actual benchmark data as testing progresses.
