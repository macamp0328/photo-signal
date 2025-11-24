# Photo Recognition Deep Dive: Achieving Successful Photo Recognition

> **Purpose**: Comprehensive technical guide to successfully recognize printed photographs in Photo Signal, with detailed mechanics, configuration guidance, and troubleshooting.

---

## Executive Summary

Photo Signal currently implements **three photo recognition algorithms**:

1. **dHash** (Difference Hash) - Fast, lightweight, good for controlled environments
2. **pHash** (Perceptual Hash) - More robust, handles varied angles and lighting
3. **ORB** (Oriented FAST and Rotated BRIEF) - Feature-based, handles distortion and rotation

**Current Challenge**: The system has all the pieces but needs proper configuration and workflow guidance to achieve reliable recognition of printed photographs.

**This Guide Provides**:

- Deep understanding of how each algorithm works internally
- Systematic workflow for hash generation
- Environment-specific configuration recommendations
- Troubleshooting procedures for common failure modes
- Real-world testing methodology

---

## Table of Contents

1. [Understanding the Recognition Pipeline](#understanding-the-recognition-pipeline)
2. [Algorithm Comparison & Selection](#algorithm-comparison--selection)
3. [Hash Generation Workflow](#hash-generation-workflow)
4. [Configuration Guidelines](#configuration-guidelines)
5. [Testing & Validation](#testing--validation)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Advanced Topics](#advanced-topics)

---

## Understanding the Recognition Pipeline

### High-Level Flow

```
Camera Frame → Quality Check → Crop Region → Compute Hash/Features → Compare → Match?
```

### Detailed Pipeline Steps

#### Step 1: Frame Capture

```typescript
// Every checkInterval ms (default: 250ms)
const video = document.querySelector('video');
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
```

**What happens**: Extract current video frame as ImageData (raw pixel array)

**Key Points**:

- Frame rate independent of video FPS
- Lower checkInterval = more CPU, faster response
- Higher checkInterval = less CPU, slower response

#### Step 2: Quality Filtering

**Blur Detection** (Laplacian Variance):

```typescript
// Convert to grayscale
const gray = convertToGrayscale(imageData);

// Apply Laplacian operator (edge detection)
const laplacian = applyLaplacian(gray);

// Calculate variance
const variance = calculateVariance(laplacian);

// Check threshold
if (variance < sharpnessThreshold) {
  reject('motion-blur');
}
```

**What this measures**: High-frequency content (edges and detail)

- Sharp image: High variance (lots of edges)
- Blurry image: Low variance (fuzzy edges)
- Default threshold: 100

**Glare Detection** (Brightness Analysis):

```typescript
// Count pixels above glare threshold (250 = very bright)
const brightPixels = imageData.data.filter(
  (_, i) =>
    i % 4 === 0 && // R channel
    imageData.data[i] > glareThreshold
).length;

const glarePercentage = (brightPixels / totalPixels) * 100;

if (glarePercentage > glarePercentageThreshold) {
  reject('glare');
}
```

**What this measures**: Specular reflections (hot spots)

- Matte photo: <5% glare
- Some reflection: 5-20% glare
- Heavy glare: >20% glare
- Default threshold: 20%

#### Step 3: Region Cropping

The system crops to the region most likely to contain the photo:

**Option A: Rectangle Detection** (default: enabled)

```typescript
// Detect photo edges using Sobel edge detection
const edges = detectEdges(imageData);
const rectangle = findLargestRectangle(edges);

if (rectangle.confidence > confidenceThreshold) {
  // Use detected rectangle
  cropRegion = rectangle.bounds;
} else {
  // Fall back to centered crop
  cropRegion = getCenteredCrop(0.8); // 80% of viewport
}
```

**Option B: Static Centered Crop** (if rectangle detection disabled)

```typescript
// Crop to centered region (80% of viewport by default)
cropRegion = {
  x: width * 0.1,
  y: height * 0.1,
  width: width * 0.8,
  height: height * 0.8,
};
```

**Why crop?**

- Reduces background noise
- Focuses on photo content
- Improves recognition accuracy
- Faster processing (less data)

#### Step 4: Hash/Feature Computation

**For dHash:**

```typescript
// 1. Resize cropped region to 17×8 pixels
const small = resizeImage(croppedData, 17, 8);

// 2. Convert to grayscale
const gray = toGrayscale(small);

// 3. Compute horizontal gradients
const hash = [];
for (let y = 0; y < 8; y++) {
  for (let x = 0; x < 16; x++) {
    const left = gray[y * 17 + x];
    const right = gray[y * 17 + x + 1];
    hash.push(left > right ? '1' : '0');
  }
}

// 4. Convert binary to hex
return binaryToHex(hash.join('')); // 32 hex characters
```

**For pHash:**

```typescript
// 1. Resize to 32×32 pixels
const small = resizeImage(croppedData, 32, 32);

// 2. Convert to grayscale
const gray = toGrayscale(small);

// 3. Apply DCT (Discrete Cosine Transform)
const dct = computeDCT(gray);

// 4. Extract low-frequency coefficients (top-left 8×8, skip DC)
const coeffs = extractLowFreq(dct, 8, 8);

// 5. Calculate median
const median = calculateMedian(coeffs);

// 6. Generate binary hash
const hash = coeffs.map((c) => (c > median ? '1' : '0')).join('');

// 7. Convert to hex
return binaryToHex(hash); // 16 hex characters
```

**For ORB:**

```typescript
// 1. Extract FAST keypoints
const keypoints = detectFASTKeypoints(imageData, {
  threshold: 20,
  maxFeatures: 500,
});

// 2. Compute BRIEF descriptors for each keypoint
const descriptors = computeBRIEFDescriptors(imageData, keypoints);

return { keypoints, descriptors };
```

#### Step 5: Similarity Comparison

**For Perceptual Hashing (dHash/pHash):**

```typescript
function hammingDistance(hash1: string, hash2: string): number {
  let distance = 0;

  // Convert hex to binary
  const bin1 = hexToBinary(hash1);
  const bin2 = hexToBinary(hash2);

  // Count differing bits
  for (let i = 0; i < bin1.length; i++) {
    if (bin1[i] !== bin2[i]) distance++;
  }

  return distance;
}

// Compare with all stored hashes
const matches = concerts.map((concert) => {
  const distances = concert.photoHashes.phash.map((hash) => hammingDistance(frameHash, hash));

  const bestDistance = Math.min(...distances);

  return {
    concert,
    distance: bestDistance,
    similarity: ((64 - bestDistance) / 64) * 100,
  };
});

// Find best match
const bestMatch = matches.reduce((best, curr) => (curr.distance < best.distance ? curr : best));

if (bestMatch.distance <= similarityThreshold) {
  return bestMatch.concert; // Recognized!
}
```

**What Hamming distance means**:

- 0 bits different = Identical (100% match)
- 8 bits different = Very similar (~87% match)
- 16 bits different = Similar (~75% match)
- 32 bits different = Different (~50% match)
- 64 bits different = Completely different (0% match)

**For ORB Feature Matching:**

```typescript
// Match descriptors using Lowe's ratio test
const goodMatches = [];

for (const queryDesc of frameDescriptors) {
  const matches = referenceDescriptors
    .map((refDesc, idx) => ({
      idx,
      distance: hammingDistance(queryDesc, refDesc),
    }))
    .sort((a, b) => a.distance - b.distance);

  // Lowe's ratio test: best match much better than second best?
  if (matches[0].distance < matchRatioThreshold * matches[1].distance) {
    goodMatches.push(matches[0]);
  }
}

if (goodMatches.length >= minMatchCount) {
  return concert; // Recognized!
}
```

#### Step 6: Stability Confirmation

```typescript
// Match must be stable for recognitionDelay ms
if (currentMatch === previousMatch) {
  stabilityTimer += checkInterval;

  if (stabilityTimer >= recognitionDelay) {
    // Confirmed match!
    setRecognizedConcert(currentMatch);
  }
} else {
  // Different match, reset timer
  stabilityTimer = 0;
  previousMatch = currentMatch;
}
```

**Why stability check?**

- Prevents false positives from transient matches
- Requires user to hold photo steady
- Default: 1000ms (1 second)
- Configurable: 500ms (fast) to 3000ms (conservative)

---

## Algorithm Comparison & Selection

### dHash (Difference Hash)

**How it works**: Computes horizontal gradient differences between adjacent pixels

**Strengths**:

- ⚡ Very fast (~6-8ms on mobile)
- 📦 Tiny code size (~3KB)
- 🎯 Good accuracy under ideal conditions (85-90%)
- 🔢 128-bit hash (32 hex chars)

**Weaknesses**:

- 📐 Sensitive to rotation (>15° degrades accuracy)
- 🔆 Sensitive to lighting changes
- 📏 Less robust to perspective distortion

**Best for**:

- Controlled environments (good lighting, stable mounting)
- Frontal photos (0-15° angle)
- Distinct images (different concerts, not similar shots)
- Performance-critical applications

**Configuration**:

```typescript
{
  hashAlgorithm: 'dhash',
  similarityThreshold: 24, // ~81% match required
  recognitionDelay: 1000,
  checkInterval: 250
}
```

### pHash (Perceptual Hash)

**How it works**: Extracts low-frequency DCT coefficients to capture overall structure

**Strengths**:

- 🎯 High accuracy (90-95% under varied conditions)
- 📐 Handles rotation better (up to 30°)
- 🔆 Robust to lighting variations
- 📏 Better with perspective changes
- 🔢 64-bit hash (16 hex chars) - smaller storage

**Weaknesses**:

- 🐢 Slower (~15-25ms on mobile)
- 📦 Larger code size (~10KB with DCT)
- Still struggles with severe distortion (>45° angle)

**Best for**:

- Challenging environments (varied lighting, handheld)
- Similar photos (same venue, similar composition)
- Wider angle tolerance (0-30°)
- When accuracy > speed

**Configuration**:

```typescript
{
  hashAlgorithm: 'phash',
  similarityThreshold: 12, // ~81% match required
  recognitionDelay: 1000,
  checkInterval: 250
}
```

### ORB (Oriented FAST and Rotated BRIEF)

**How it works**: Detects keypoints and compares local feature descriptors

**Strengths**:

- 🎯 Excellent accuracy (95%+ under extreme conditions)
- 📐 Handles rotation, scale, perspective distortion
- 🔆 Robust to lighting, glare, shadows
- 🎨 Works with partial occlusion
- ⚠️ Near-zero false positives

**Weaknesses**:

- 🐌 Slowest (~50-100ms on mobile)
- 📦 Largest code size (~20KB)
- 🖼️ Requires reference image file (not just hash)
- 💾 More storage (keypoints + descriptors)
- 🔧 More complex configuration

**Best for**:

- Extreme conditions (poor lighting, varied angles)
- Printed zines or booklets (rotation, perspective)
- When false positives are unacceptable
- When performance is not critical

**Configuration**:

```typescript
{
  hashAlgorithm: 'orb',
  recognitionDelay: 1500,
  checkInterval: 250,
  orbConfig: {
    maxFeatures: 500,
    fastThreshold: 20,
    minMatchCount: 20, // Require 20 good feature matches
    matchRatioThreshold: 0.7 // Lowe's ratio test
  }
}
```

### Algorithm Decision Tree

```
Start
│
├─ Need fastest possible? (real-time critical)
│  └─ YES → dHash
│
├─ Similar photos in gallery? (same venue, similar scenes)
│  └─ YES → pHash
│
├─ Printed zines with rotation/distortion?
│  └─ YES → ORB
│
├─ Controlled environment? (good lighting, stable mount)
│  └─ YES → dHash
│
├─ Handheld scanning? (varied angles, shaky hands)
│  └─ YES → pHash
│
└─ Default → pHash (best balance)
```

---

## Hash Generation Workflow

### Why Hash Generation Matters

**The #1 cause of recognition failure is incorrect reference hashes.**

Your reference hashes must represent how the photo actually looks when scanned by the camera, not how it looks to your eyes or in a high-res scan.

### Recommended Workflow

#### Option 1: Direct Camera Capture (Best)

**Purpose**: Generate hashes from actual camera frames

**Steps**:

1. **Enable Test Mode**
   - Triple-tap/click to open Secret Settings
   - Enable "Test Data Mode"
   - Close settings menu

2. **Position Photo**
   - Place printed photo in scanning position
   - Use same lighting as production use
   - Ensure photo is fully in frame

3. **Capture Hash from Debug Overlay**
   - Point camera at photo
   - Wait for frame quality indicator to show "Good"
   - Read hash from debug overlay: `Frame Hash: a5b3c7d9e1f20486`
   - Note hash in a text file with photo ID

4. **Vary Lighting (Optional but Recommended)**
   - Capture hash with bright lighting
   - Capture hash with dim lighting
   - Capture hash with normal lighting
   - Store all three hashes in `photoHashes.phash` array

5. **Update data.json**
   ```json
   {
     "id": 1,
     "photoHashes": {
       "phash": [
         "a5b3c7d9e1f20486", // bright
         "a5b3c7d9e1f20487", // normal
         "a5b3c7d9e1f20488" // dim
       ],
       "dhash": [
         "00000000000001600acc000000000000",
         "00000000000001600acc000000000000",
         "00000000000001600acc000000000000"
       ]
     }
   }
   ```

**Advantages**:

- Hashes represent actual camera view
- Accounts for camera characteristics
- Accounts for photo surface (matte vs glossy)
- Accounts for lighting conditions
- Most reliable method

**Disadvantages**:

- Manual process
- Requires physical setup
- Time-consuming for large galleries

#### Option 2: Script-Based Generation (Faster)

**Purpose**: Bulk generate hashes from photo files

**Steps**:

1. **Take Reference Photos**
   - Photograph each printed photo with your phone
   - Use same camera as production
   - Good lighting, straight-on angle
   - Save as JPEG in `assets/reference-photos/`

2. **Run Hash Generation Script**

```bash
npm run generate-hashes -- --paths assets/reference-photos
# or call the CLI directly:
node scripts/update-recognition-data.js --paths-mode --paths assets/reference-photos --algorithms phash,dhash
```

3. **Review Output**

   ```
   Processing assets/reference-photos/concert-1.jpg
   dHash: 00000000000001600acc000000000000
   pHash: a5b3c7d9e1f20486

   Processing assets/reference-photos/concert-2.jpg
   dHash: 00000000000001601acc000000000000
   pHash: b6c4d8e2f3a10597
   ```

4. **Copy Hashes to data.json**

**Advantages**:

- Faster for multiple photos
- Consistent process
- Easy to regenerate
- Can version control reference photos

**Disadvantages**:

- Reference photo quality affects accuracy
- May not match live camera exactly
- Requires separate photo capture step

#### Option 3: Browser-Based Tool (Interactive)

**Purpose**: Generate hashes from uploaded images

**Steps**:

1. **Open Hash Generator**
   - Open `scripts/generate-photo-hashes.html` in browser
   - Or use live tool: [URL TBD]

2. **Upload Reference Photos**
   - Drag and drop photo files
   - Or click to select files

3. **View Generated Hashes**
   - Tool displays both dHash and pHash
   - Visual preview of each image
   - Copy-to-clipboard buttons

4. **Copy to data.json**

**Advantages**:

- No command line needed
- Visual confirmation
- Works on any device with browser
- Easy to share with others

**Disadvantages**:

- Still requires reference photos
- Manual copy-paste to data.json

### Multi-Exposure Hash Strategy

**Problem**: Lighting in real-world installations varies (morning vs night, cloudy vs sunny)

**Solution**: Store 3 hashes per photo representing different lighting conditions

**Implementation**:

```json
{
  "photoHashes": {
    "phash": [
      "89c6710bc6f07ec1", // Bright exposure (direct sunlight)
      "89c6f10be4f03ec1", // Normal exposure (room lighting)
      "8bc4f10be4f03ec1" // Dark exposure (dim lighting)
    ]
  }
}
```

**How to capture**:

1. Position photo under bright light
2. Capture hash from debug overlay
3. Reduce lighting to normal level
4. Capture second hash
5. Reduce to dim lighting
6. Capture third hash

**Matching logic** (automatically handled):

```typescript
// System checks all exposure variants
const distances = concert.photoHashes.phash.map((hash) => hammingDistance(frameHash, hash));

// Uses best (closest) match
const bestDistance = Math.min(...distances);
```

**Benefits**:

- Works in varied lighting without threshold adjustment
- More reliable recognition
- Handles time-of-day variations

**When to use**:

- Installation lighting changes throughout day
- Near windows (sunlight varies)
- Bathroom with variable natural light
- Any environment where lighting isn't controlled

---

## Configuration Guidelines

### Baseline Configuration (Start Here)

**For pHash (Recommended Default)**:

```typescript
{
  hashAlgorithm: 'phash',
  similarityThreshold: 12,      // 81% match required (12 of 64 bits different)
  recognitionDelay: 1000,       // 1 second stability
  checkInterval: 250,           // Check 4 times per second
  sharpnessThreshold: 100,      // Reject blurry frames
  glareThreshold: 250,          // Bright pixel threshold
  glarePercentageThreshold: 20, // Max 20% glare pixels
  enableRectangleDetection: true,
  rectangleDetectionConfidenceThreshold: 0.3
}
```

**For dHash (Performance Priority)**:

```typescript
{
  hashAlgorithm: 'dhash',
  similarityThreshold: 24,      // 81% match required (24 of 128 bits different)
  recognitionDelay: 1000,
  checkInterval: 250,
  sharpnessThreshold: 100,
  glareThreshold: 250,
  glarePercentageThreshold: 20,
  enableRectangleDetection: true,
  rectangleDetectionConfidenceThreshold: 0.3
}
```

**For ORB (Robustness Priority)**:

```typescript
{
  hashAlgorithm: 'orb',
  recognitionDelay: 1500,       // Slower, need more time
  checkInterval: 250,
  sharpnessThreshold: 80,       // More lenient (ORB handles blur better)
  glareThreshold: 250,
  glarePercentageThreshold: 25, // More lenient
  enableRectangleDetection: true,
  rectangleDetectionConfidenceThreshold: 0.3,
  orbConfig: {
    maxFeatures: 500,
    fastThreshold: 20,
    minMatchCount: 20,
    matchRatioThreshold: 0.7
  }
}
```

### Environment-Specific Tuning

#### Bathroom Installation (Variable Lighting)

**Challenges**:

- Natural light varies throughout day
- Overhead lights may cause glare
- Tile/mirror reflections

**Configuration**:

```typescript
{
  hashAlgorithm: 'phash',       // Handles lighting changes
  similarityThreshold: 14,      // Slightly more lenient
  glarePercentageThreshold: 25, // Accept more glare
  sharpnessThreshold: 90,       // Slightly more lenient
  recognitionDelay: 1500        // Longer confirmation
}
```

**Hash Generation**:

- Capture 3 exposure variants (bright/normal/dim)
- Test at different times of day
- Use matte photo surface if possible

#### Living Room (Stable Lighting)

**Challenges**:

- Consistent lighting
- May have window glare during day

**Configuration**:

```typescript
{
  hashAlgorithm: 'dhash',       // Can use faster algorithm
  similarityThreshold: 22,      // Stricter (consistent conditions)
  glarePercentageThreshold: 20, // Standard
  sharpnessThreshold: 100,      // Standard
  recognitionDelay: 1000        // Standard
}
```

**Hash Generation**:

- Single hash per photo sufficient
- Test with blinds open and closed
- Adjust if window glare causes issues

#### Gallery Wall (Mounted Photos)

**Challenges**:

- Photos at various angles
- Different photo sizes
- Consistent distance

**Configuration**:

```typescript
{
  hashAlgorithm: 'pHash',       // Better angle tolerance
  similarityThreshold: 12,      // Standard
  enableRectangleDetection: true,
  rectangleDetectionConfidenceThreshold: 0.4, // Stricter (cleaner detection)
  recognitionDelay: 800         // Can be faster (stable mounting)
}
```

#### Handheld Scanning (User Holds Photo)

**Challenges**:

- Hand shake and movement
- Variable angles
- Inconsistent distance

**Configuration**:

```typescript
{
  hashAlgorithm: 'phash',
  similarityThreshold: 14,      // More lenient (angle variations)
  sharpnessThreshold: 80,       // More lenient (hand shake)
  glarePercentageThreshold: 25,
  recognitionDelay: 1500,       // Longer stability required
  enableMultiScale: true,       // Handle distance variations
  multiScaleVariants: [0.7, 0.8, 0.9, 0.95]
}
```

### Threshold Tuning Methodology

**Step 1: Baseline Test**

1. Set threshold to default (12 for pHash, 24 for dHash)
2. Scan each photo 10 times
3. Record recognition rate

**Step 2: Analyze Failures**

1. Enable Test Mode
2. Export telemetry
3. Check failure categories:
   - `no-match` → Threshold too strict, increase by 2-4
   - `collision` → Threshold too lenient, decrease by 2
   - `motion-blur` → Sharpness threshold too strict, decrease by 10-20
   - `glare` → Glare threshold issues, increase percentage threshold by 5

**Step 3: Incremental Adjustment**

```
Current: 12, Recognition: 60% → Try 14
Current: 14, Recognition: 80% → Try 16
Current: 16, Recognition: 90% → Keep at 16 ✓
```

**Step 4: Validate**

1. Test all photos 20 times each
2. Target: >85% recognition rate
3. Check for false positives (wrong concert matched)

**Step 5: Document**

```json
{
  "environment": "bathroom-morning-light",
  "algorithm": "phash",
  "threshold": 16,
  "recognitionRate": "90%",
  "notes": "Increased threshold due to variable natural light"
}
```

---

## Testing & Validation

### Test Data Mode Workflow

**Purpose**: Debug recognition without affecting production UX

**Setup**:

1. Triple-tap to open Secret Settings
2. Enable "Test Data Mode"
3. Debug overlay appears showing:
   - Frame hash
   - Best match
   - Similarity score
   - Quality indicators
   - Telemetry stats

**What to observe**:

- Frame hash changes with each capture
- Similarity scores for each concert
- Quality rejections (blur, glare)
- Frame processing time

### Systematic Testing Procedure

#### Phase 1: Individual Photo Tests

**For each photo**:

1. **Position Photo**
   - Center in frame
   - Good lighting
   - Hold steady

2. **Observe Debug Info**
   - Wait for "Good" quality indicator
   - Check similarity scores
   - Note best match

3. **Record Results**

   ```
   Photo ID: 1
   Expected: The Midnight Echoes
   Actual: The Midnight Echoes
   Distance: 8
   Similarity: 87.5%
   Status: ✓ PASS
   ```

4. **Test Variations**
   - Rotate 15° left → Record result
   - Rotate 15° right → Record result
   - Tilt 10° up → Record result
   - Tilt 10° down → Record result
   - Move 6" closer → Record result
   - Move 6" farther → Record result

5. **Lighting Variations**
   - Bright lighting → Record result
   - Dim lighting → Record result
   - Angled (avoid glare) → Record result

**Success Criteria**: >80% recognition across all variations

#### Phase 2: Gallery-Wide Test

**Scan all photos sequentially**:

1. Enable telemetry export
2. Scan each photo 10 times
3. Record recognition rate per photo
4. Export telemetry at end
5. Analyze failure patterns

**Metrics to track**:

```
Total Scans: 50 (5 photos × 10 scans each)
Successful: 43
Failed: 7
Success Rate: 86%

Failure Breakdown:
- motion-blur: 3 (6%)
- glare: 2 (4%)
- no-match: 2 (4%)
```

#### Phase 3: Edge Case Validation

**Test challenging scenarios**:

1. **Low Light**
   - Turn off overhead lights
   - Use only ambient light
   - Expected: Slower recognition, still successful

2. **High Glare**
   - Direct overhead light on glossy photo
   - Expected: Glare rejection, need to tilt photo

3. **Extreme Angles**
   - 30° rotation
   - 45° rotation
   - Expected: pHash works, dHash may fail

4. **Similar Photos**
   - Two concerts at same venue
   - Similar crowd shots
   - Expected: Correct distinction (no collisions)

5. **Distance Variations**
   - 6 inches from camera
   - 12 inches (normal)
   - 24 inches (far)
   - Expected: Recognition at all distances

### Telemetry Analysis

**After each test session**:

1. **Export Telemetry**
   - Click "📥 Export JSON"
   - Or "📝 Export Markdown Report"

2. **Review Summary Metrics**

   ```json
   {
     "totalFrames": 500,
     "qualityFrames": 380,
     "qualityFrameRate": "76.0%",
     "successfulRecognitions": 45,
     "recognitionSuccessRate": "90.0%"
   }
   ```

3. **Analyze Failure Categories**
   - If motion-blur >25% → User movement issue or threshold too strict
   - If glare >20% → Lighting issue or photo surface issue
   - If no-match >15% → Threshold too strict or hash mismatch

4. **Review Recent Failures**
   - Look for patterns in failure reasons
   - Check if specific photos consistently fail
   - Note similarity scores for near-misses

### Automated Testing (Future)

**Visual Regression Tests**:

- Capture reference frames for each photo
- Automated hash comparison
- CI/CD integration
- Regression detection

**Performance Tests**:

- Frame processing time benchmarks
- Memory usage tracking
- Battery impact measurement

---

## Troubleshooting Guide

### Problem: Photo Not Recognized

**Symptom**: Debug overlay shows "No match found" or very low similarity

**Diagnosis Steps**:

1. **Check Frame Quality**
   - Look at quality indicator: "Good", "Blur", "Glare", "Poor"
   - If consistently "Blur" → Camera focus issue or movement
   - If "Glare" → Adjust lighting or tilt photo
   - If "Poor" → Lighting too dark or camera issue

2. **Check Hash Comparison**
   - Note frame hash from debug overlay
   - Compare manually with stored hashes
   - Calculate Hamming distance
   - If distance >30 → Hash mismatch (regenerate reference hashes)

3. **Check Threshold**
   - Note best match distance
   - If distance is 15 but threshold is 12 → Increase threshold
   - If all distances >30 → Reference hash is wrong

4. **Verify Data**

   ```bash
   # Check data.json has correct concert entry
   cat public/data.json | grep -A 10 "concert-1"

   # Verify hash format
   # pHash should be 16 hex chars: a5b3c7d9e1f20486
   # dHash should be 32 hex chars: 00000000000001600acc000000000000
   ```

**Solutions**:

**Solution 1: Regenerate Reference Hash**

```typescript
// In Test Mode, point camera at photo
// Wait for "Good" quality indicator
// Copy hash from debug overlay: "Frame Hash: a5b3c7d9e1f20486"
// Update data.json with new hash
```

**Solution 2: Adjust Threshold**

```typescript
// If best match is 16 but threshold is 12
// Update settings
{
  similarityThreshold: 18; // Increased from 12
}
```

**Solution 3: Switch Algorithm**

```typescript
// If dHash not working, try pHash
{
  hashAlgorithm: 'phash',
  similarityThreshold: 12
}
```

### Problem: Wrong Photo Recognized (Collision)

**Symptom**: Debug overlay shows wrong concert match

**Diagnosis Steps**:

1. **Check Similarity Scores**
   - Look at debug overlay distances
   - If wrong photo distance = 8, correct photo distance = 9
   - Photos are too similar (hash collision)

2. **Check Photo Content**
   - Are photos visually similar?
   - Same venue, similar lighting, similar composition
   - May need more distinctive reference photos

3. **Verify Threshold**
   - If threshold is too high (lenient), wrong matches can occur
   - Check if correct photo is within threshold range

**Solutions**:

**Solution 1: Use More Distinctive Photos**

```
Before: Two photos of same stage, different shows
After: One photo of stage, one photo of crowd
Result: More distinctive hashes
```

**Solution 2: Decrease Threshold**

```typescript
{
  similarityThreshold: 10; // Decreased from 12 (stricter)
}
```

**Solution 3: Use pHash Instead of dHash**

```typescript
// pHash has better discrimination
{
  hashAlgorithm: 'phash',
  similarityThreshold: 12
}
```

**Solution 4: Regenerate Hashes with Better Lighting**

```
// Ensure reference captures have:
// - Good contrast
// - Clear details
// - Distinctive features visible
```

### Problem: Excessive Blur Rejections

**Symptom**: Telemetry shows >30% blur rejections

**Diagnosis Steps**:

1. **Check Sharpness Values**
   - Export telemetry
   - Look at recent failures
   - Note reported sharpness values
   - Example: "Sharpness 85.3 below threshold 100"

2. **Test Camera Focus**
   - Point at high-contrast target
   - Check if focus locks
   - If fuzzy, camera may have hardware issue

3. **Check Movement**
   - Try holding camera very steady
   - If still blurry, threshold too strict
   - If sharp when steady, user movement is issue

**Solutions**:

**Solution 1: Lower Sharpness Threshold**

```typescript
{
  sharpnessThreshold: 80; // Decreased from 100
}
```

**Solution 2: Add Visual Feedback**

```typescript
// Already implemented: FrameQualityIndicator
// Shows "Hold steady..." when blur detected
// User feedback helps reduce movement
```

**Solution 3: Test Different Device**

```
// Some phone cameras have:
// - Better autofocus
// - Image stabilization
// - Higher quality sensors
```

### Problem: Excessive Glare Rejections

**Symptom**: Telemetry shows >25% glare rejections

**Diagnosis Steps**:

1. **Check Photo Surface**
   - Glossy photos reflect more light
   - Matte photos have less glare
   - Laminated photos worst for glare

2. **Check Lighting**
   - Overhead lights directly above photo
   - Window light at wrong angle
   - Flash/bright lights in frame

3. **Check Glare Percentage**
   - Export telemetry
   - Note reported glare percentages
   - Example: "Glare 32% above threshold 20%"

**Solutions**:

**Solution 1: Adjust Photo Angle**

```
// Tilt photo to deflect reflection
// Move photo away from direct light
// Use matte photo surface if possible
```

**Solution 2: Increase Glare Tolerance**

```typescript
{
  glarePercentageThreshold: 30; // Increased from 20
}
```

**Solution 3: Add User Guidance**

```typescript
// Already implemented: GuidanceMessage
// Shows "Tilt to avoid glare" when glare detected
// User adjusts photo angle
```

**Solution 4: Change Lighting**

```
// Use diffused lighting (lampshade, indirect)
// Avoid direct overhead lights
// Position photo away from windows during day
```

### Problem: Slow Recognition

**Symptom**: Takes 5-10 seconds to recognize photo

**Diagnosis Steps**:

1. **Check Recognition Delay Setting**
   - Current value in settings
   - Default: 1000ms (1 second)
   - If set to 3000ms+ → Configured for stability

2. **Check Frame Quality**
   - If frames consistently poor quality
   - System waits for good frame
   - Can take several seconds

3. **Check Algorithm**
   - ORB is slower than pHash
   - pHash is slower than dHash
   - Trade-off: speed vs accuracy

**Solutions**:

**Solution 1: Reduce Recognition Delay**

```typescript
{
  recognitionDelay: 800; // Decreased from 1000ms
}
```

**Solution 2: Improve Frame Quality**

```
// Better lighting
// Hold camera steadier
// Clean photo surface (remove smudges)
```

**Solution 3: Switch to Faster Algorithm**

```typescript
{
  hashAlgorithm: 'dhash'; // Faster than pHash
}
```

**Solution 4: Reduce Check Interval** (More CPU)

```typescript
{
  checkInterval: 200; // Decreased from 250ms
  // Checks 5x per second instead of 4x
}
```

### Problem: False Positives at Wrong Distance

**Symptom**: Recognizes photo when too close or too far

**Diagnosis Steps**:

1. **Check Rectangle Detection**
   - Is rectangle detection enabled?
   - What confidence threshold?
   - Is photo filling frame properly?

2. **Check Multi-Scale Settings**
   - Is multi-scale recognition enabled?
   - What scale variants are tested?

3. **Observe at Various Distances**
   - 6 inches → Should recognize
   - 12 inches → Should recognize
   - 24 inches → Should recognize
   - 36 inches → Should NOT recognize (too far)

**Solutions**:

**Solution 1: Enable Rectangle Detection**

```typescript
{
  enableRectangleDetection: true,
  rectangleDetectionConfidenceThreshold: 0.4
}
```

**Solution 2: Disable Multi-Scale** (if causing issues)

```typescript
{
  enableMultiScale: false;
}
```

**Solution 3: Regenerate Hashes at Correct Distance**

```
// Capture reference hashes at:
// - 12 inches (normal viewing distance)
// Test at same distance
```

---

## Advanced Topics

### Hybrid Recognition Strategy

**Concept**: Use multiple algorithms in sequence

**Implementation**:

```typescript
// Primary: Fast dHash for initial screening
const dHashMatch = findMatch(frameHash, concerts, { algorithm: 'dhash' });

if (dHashMatch && dHashMatch.distance <= 20) {
  // High confidence match
  return dHashMatch;
}

// Secondary: Accurate pHash for confirmation
const pHashMatch = findMatch(frameHash, concerts, { algorithm: 'phash' });

if (pHashMatch && pHashMatch.distance <= 12) {
  // Confirmed match
  return pHashMatch;
}

// Tertiary: ORB for difficult cases
if (enableORBFallback) {
  const orbMatch = matchORB(frameFeatures, concerts);
  if (orbMatch && orbMatch.matchCount >= 20) {
    return orbMatch;
  }
}

return null; // No match
```

**Benefits**:

- Fast path for easy matches (90% of cases)
- Accurate path for challenging matches (9% of cases)
- Robust path for edge cases (1% of cases)

**Configuration**:

```typescript
{
  hashAlgorithm: 'dhash',
  secondaryHashAlgorithm: 'phash',
  enableORBFallback: true,
  similarityThreshold: 24, // dHash threshold
  secondarySimilarityThreshold: 12 // pHash threshold
}
```

### Adaptive Threshold

**Concept**: Adjust threshold based on environment

**Implementation**:

```typescript
// Measure ambient light level
const brightness = calculateAverageBrightness(frameData);

// Adjust threshold dynamically
let threshold = baseSimilarityThreshold;

if (brightness < 100) {
  // Low light - be more lenient
  threshold += 4;
} else if (brightness > 200) {
  // Bright light - can be stricter
  threshold -= 2;
}

// Use adjusted threshold for matching
const match = findMatch(frameHash, concerts, { threshold });
```

**Benefits**:

- Adapts to changing conditions
- No manual reconfiguration
- Better recognition across time-of-day

### Performance Optimization

**Frame Skipping**:

```typescript
// Don't process every frame if performance suffers
let frameCount = 0;

function processFrame() {
  frameCount++;

  if (frameCount % 3 !== 0) {
    return; // Skip 2 out of 3 frames
  }

  // Process every 3rd frame
  const hash = computeHash(frameData);
  const match = findMatch(hash, concerts);
}
```

**Canvas Reuse**:

```typescript
// Reuse canvas instead of creating new ones
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

function processFrame() {
  // Reuse existing canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(video, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Process...
}
```

**Worker Threads** (Future):

```typescript
// Offload hash computation to Web Worker
const worker = new Worker('hash-worker.js');

worker.postMessage({ imageData });

worker.onmessage = (e) => {
  const { hash } = e.data;
  const match = findMatch(hash, concerts);
};
```

### Machine Learning Enhancement (Future)

**Concept**: Train ML model on your specific photos

**Benefits**:

- Higher accuracy (>95%)
- Learns your specific photo characteristics
- Handles unique challenges in your environment

**Implementation Path**:

1. Collect 100+ reference images per photo
2. Train TensorFlow.js model
3. Export model to ONNX
4. Load in browser
5. Use as primary or secondary matcher

**Resources**:

- TensorFlow.js: https://www.tensorflow.org/js
- ONNX Runtime Web: https://onnxruntime.ai/docs/tutorials/web/

---

## Summary & Action Items

### Quick Start Checklist

- [ ] Choose algorithm (default: pHash)
- [ ] Generate reference hashes using direct camera capture
- [ ] Store 3 exposure variants per photo (bright/normal/dim)
- [ ] Update data.json with hashes
- [ ] Test each photo 10 times
- [ ] Achieve >85% recognition rate
- [ ] Export telemetry and analyze failures
- [ ] Tune thresholds based on failure categories
- [ ] Document final configuration
- [ ] Deploy and monitor in production

### Key Takeaways

1. **Reference hashes are critical** - Capture them from actual camera, not scans
2. **Multi-exposure hashing** - Store 3 variants for lighting robustness
3. **pHash is the sweet spot** - Best balance of speed and accuracy
4. **Threshold tuning is iterative** - Start conservative, relax based on testing
5. **Telemetry is your friend** - Use Test Mode to diagnose all issues
6. **Environment matters** - Configuration must match installation conditions

### Getting Help

**If still struggling**:

1. Export telemetry (JSON and Markdown)
2. Document your configuration
3. Note your environment (lighting, photo surface, camera)
4. Share test results (recognition rate, failure categories)
5. Open GitHub issue with details

**Resources**:

- Module README: `src/modules/photo-recognition/README.md`
- Telemetry Guide: `docs/telemetry-interpretation-guide.md`
- Camera Settings: `docs/camera-settings-guide.md`
- Test Mode Guide: `docs/TEST_DATA_MODE_GUIDE.md`

---

**Last Updated**: 2025-11-23  
**Document Version**: 1.0  
**Maintainer**: Photo Signal Team
