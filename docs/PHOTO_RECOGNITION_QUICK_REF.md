# Photo Recognition Quick Reference

> **Quick reference card** for Photo Signal photo recognition configuration and troubleshooting.

For detailed explanations, see [PHOTO_RECOGNITION_DEEP_DIVE.md](./PHOTO_RECOGNITION_DEEP_DIVE.md).

---

## Algorithm Quick Comparison

| Algorithm | Speed  | Accuracy | Rotation | Lighting | Use Case                    |
| --------- | ------ | -------- | -------- | -------- | --------------------------- |
| **dHash** | ⚡⚡⚡ | ⭐⭐     | ❌       | ⚠️       | Controlled env, performance |
| **pHash** | ⚡⚡   | ⭐⭐⭐   | ⚠️       | ✅       | **Default - best balance**  |
| **ORB**   | ⚡     | ⭐⭐⭐⭐ | ✅       | ✅       | Extreme conditions          |

**Default Recommendation**: pHash

---

## Baseline Configurations

### pHash (Recommended)

```json
{
  "hashAlgorithm": "phash",
  "similarityThreshold": 12,
  "recognitionDelay": 1000,
  "checkInterval": 250,
  "sharpnessThreshold": 100,
  "glareThreshold": 250,
  "glarePercentageThreshold": 20
}
```

### dHash (Performance)

```json
{
  "hashAlgorithm": "dhash",
  "similarityThreshold": 24,
  "recognitionDelay": 1000,
  "checkInterval": 250,
  "sharpnessThreshold": 100,
  "glareThreshold": 250,
  "glarePercentageThreshold": 20
}
```

### ORB (Robustness)

```json
{
  "hashAlgorithm": "orb",
  "recognitionDelay": 1500,
  "checkInterval": 250,
  "sharpnessThreshold": 80,
  "glareThreshold": 250,
  "glarePercentageThreshold": 25,
  "orbConfig": {
    "maxFeatures": 500,
    "fastThreshold": 20,
    "minMatchCount": 20,
    "matchRatioThreshold": 0.7
  }
}
```

---

## Environment-Specific Tweaks

### Bathroom (Variable Lighting)

```json
{
  "similarityThreshold": 14, // +2 from baseline
  "glarePercentageThreshold": 25, // +5 from baseline
  "sharpnessThreshold": 90, // -10 from baseline
  "recognitionDelay": 1500 // +500ms from baseline
}
```

**Note**: Use multi-exposure hashing (3 variants)

### Handheld Scanning

```json
{
  "similarityThreshold": 14, // +2 from baseline
  "sharpnessThreshold": 80, // -20 from baseline
  "glarePercentageThreshold": 25, // +5 from baseline
  "recognitionDelay": 1500, // +500ms from baseline
  "enableMultiScale": true,
  "multiScaleVariants": [0.7, 0.8, 0.9, 0.95]
}
```

### Gallery Wall (Mounted)

```json
{
  "similarityThreshold": 12, // Standard
  "recognitionDelay": 800, // -200ms (stable mount)
  "rectangleDetectionConfidenceThreshold": 0.4 // +0.1 (cleaner detection)
}
```

---

## Hash Generation Quick Start

### Method 1: Direct Camera Capture (Best)

1. Enable Test Mode (triple-tap → "Test Data Mode")
2. Point camera at photo
3. Wait for "Good" quality indicator
4. Copy hash from debug overlay
5. Add to data.json

**Example**:

```
Debug Overlay shows:
Frame Hash: a5b3c7d9e1f20486
```

Add to data.json:

```json
{
  "id": 1,
  "photoHashes": {
    "phash": ["a5b3c7d9e1f20486"]
  }
}
```

### Method 2: Script Generation

```bash
# Place photos in assets/reference-photos/
npm run generate-hashes

# Copy output to data.json
```

### Multi-Exposure Strategy

Capture 3 hashes per photo:

1. Bright lighting → hash 1
2. Normal lighting → hash 2
3. Dim lighting → hash 3

```json
{
  "photoHashes": {
    "phash": [
      "a5b3c7d9e1f20486", // bright
      "a5b3c7d9e1f20487", // normal
      "a5b3c7d9e1f20488" // dim
    ]
  }
}
```

---

## Troubleshooting Quick Fixes

### Photo Not Recognized

**Check**: Debug overlay distance to best match

| Distance | Similarity | Action                           |
| -------- | ---------- | -------------------------------- |
| 0-10     | >84%       | ✅ Should work - check stability |
| 11-20    | >69%       | Increase threshold by 4-8        |
| 21-30    | >53%       | Increase threshold by 8-12       |
| >30      | <53%       | ❌ Hash mismatch - regenerate    |

**Fix**: If distance >20, regenerate reference hash using camera capture method

### Excessive Blur Rejections

**Check**: Telemetry shows >30% blur rejections

**Fix**:

```json
{
  "sharpnessThreshold": 80 // Decrease from 100
}
```

**Alternative**: Add visual feedback to user (already implemented)

### Excessive Glare Rejections

**Check**: Telemetry shows >25% glare rejections

**Fix**:

```json
{
  "glarePercentageThreshold": 30 // Increase from 20
}
```

**Alternative**: Adjust photo angle or lighting

### Wrong Photo Recognized (Collision)

**Check**: Debug overlay shows wrong concert

**Fix**: Decrease threshold (stricter)

```json
{
  "similarityThreshold": 10 // Decrease from 12
}
```

**Alternative**: Use pHash instead of dHash, or regenerate with more distinctive reference

### Slow Recognition (>5 seconds)

**Check**: Recognition delay setting

**Fix**:

```json
{
  "recognitionDelay": 800 // Decrease from 1000ms
}
```

**Alternative**: Switch to dHash for faster processing

---

## Threshold Adjustment Guide

### Hamming Distance to Similarity %

**pHash (64-bit)**:

- 0 bits = 100% match
- 6 bits = 90.6% match
- 12 bits = 81.3% match (default)
- 16 bits = 75.0% match
- 24 bits = 62.5% match
- 32 bits = 50.0% match

**dHash (128-bit)**:

- 0 bits = 100% match
- 12 bits = 90.6% match
- 24 bits = 81.3% match (default)
- 32 bits = 75.0% match
- 48 bits = 62.5% match
- 64 bits = 50.0% match

### Adjustment Strategy

1. **Too strict** (not recognizing) → Increase threshold by 2-4
2. **Too lenient** (wrong matches) → Decrease threshold by 2
3. **Test after each change** → Validate with 10 scans per photo

---

## Telemetry Interpretation

### Good Metrics

- Quality frame rate: >70%
- Blur rejections: <20%
- Glare rejections: <15%
- Recognition success: >85%

### Warning Signs

- Quality frame rate: <60% → Environment/camera issues
- Blur rejections: >30% → Sharpness threshold too strict or camera movement
- Glare rejections: >25% → Lighting issues or photo surface issues
- Recognition success: <70% → Hash mismatch or threshold issues

### Export Telemetry

In Test Mode:

1. Click "📥 Export JSON" for raw data
2. Or "📝 Export Markdown Report" for formatted report
3. Review failure categories and recent failures

---

## Common Failure Categories

| Category         | Cause                    | Solution                                              |
| ---------------- | ------------------------ | ----------------------------------------------------- |
| **motion-blur**  | Camera shake, movement   | Lower sharpness threshold, hold steadier              |
| **glare**        | Specular reflections     | Adjust lighting, tilt photo, increase glare threshold |
| **no-match**     | Hash not in database     | Regenerate hash, increase similarity threshold        |
| **collision**    | Multiple similar matches | Decrease threshold, use more distinctive references   |
| **poor-quality** | Low-quality frame        | Improve lighting, check camera                        |

---

## Quick Commands

### Enable Test Mode

Triple-tap/click anywhere → Secret Settings → Enable "Test Data Mode"

### Generate Hashes

```bash
npm run generate-hashes
```

### Rebuild All Hashes

```bash
npm run update-recognition-data -- --hashes-only
```

### Check Data Structure

```bash
cat public/data.json | jq '.concerts[0].photoHashes'
```

---

## Decision Tree

```
Start
│
├─ Photo not recognized?
│  ├─ Distance >30? → Regenerate hash
│  └─ Distance 11-20? → Increase threshold
│
├─ Wrong photo recognized?
│  └─ Decrease threshold (stricter)
│
├─ Too many blur rejections?
│  └─ Decrease sharpness threshold
│
├─ Too many glare rejections?
│  └─ Increase glare percentage threshold
│
└─ Slow recognition?
   └─ Decrease recognition delay
```

---

## Resources

- **Full Guide**: [PHOTO_RECOGNITION_DEEP_DIVE.md](./PHOTO_RECOGNITION_DEEP_DIVE.md)
- **Telemetry Guide**: [telemetry-interpretation-guide.md](./telemetry-interpretation-guide.md)
- **Module README**: [photo-recognition/README.md](../src/modules/photo-recognition/README.md)
- **Test Mode Guide**: [TEST_DATA_MODE_GUIDE.md](./TEST_DATA_MODE_GUIDE.md)

---

**Last Updated**: 2025-11-23
