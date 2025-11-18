# Migration Guide: Switching from dHash to pHash

> **Purpose**: Step-by-step guide for migrating from dHash to pHash algorithm for improved robustness against angles and lighting variations.
>
> **Audience**: Developers, system administrators
>
> **Estimated Time**: 30-60 minutes (depending on number of photos)

---

## Overview

Phase 2 introduces **pHash** (Perceptual Hash), a DCT-based algorithm that provides:

- **15-30% better accuracy** at handling angles and lighting
- **Lower false positive rate** (1% vs 3-5% for dHash)
- **Better discrimination** between similar photos
- **Smaller hash size** (64-bit vs 128-bit)

This guide walks through migrating your existing dHash-based setup to pHash. The current data schema uses a `photoHashes` object so both algorithms can live side-by-side while you experiment.

---

## When to Migrate

### Consider pHash if:

✅ You experience angle-related recognition failures (>30° tilts)
✅ Your photos have similar visual content (need better discrimination)
✅ Lighting varies significantly in your environment
✅ You want to maximize accuracy for challenging conditions

### Stick with dHash if:

✅ Current accuracy meets your needs (>90% success)
✅ Photos are always viewed frontally (0-15° angles)
✅ You want absolute fastest performance (~6ms vs ~15ms per hash)
✅ You're on older mobile devices with limited processing power

---

## Pre-Migration Checklist

Before starting:

- [ ] **Backup your current `data.json`** (or production concert data)
- [ ] **Verify you have source images** for all concerts in `assets/test-images/` or similar
- [ ] **Test pHash performance** on your target devices first
- [ ] **Review benchmarking guide** at `docs/phase-2-benchmarking-guide.md`
- [ ] **Understand the changes** required (new hashes, code updates)

---

## Migration Steps

### Step 1: Generate pHash Values

Use the updated hash generation script to create pHash values for your photos:

```bash
# Navigate to project root
cd photo-signal

# Generate pHash values for all test images
node scripts/generate-photo-hashes.js --algorithm phash assets/test-images/

# Or for specific images
node scripts/generate-photo-hashes.js --algorithm phash path/to/photo1.jpg path/to/photo2.jpg
```

**Expected Output**:

```
📸 Photo Hash Generator

Algorithm: PHASH
Hash size: 64-bit (16 hex chars)
Targets:
  • assets/test-images/

Found 12 image(s):

✓ assets/test-images/concert-1.jpg
  Hash (dark):   9853660d98d36f26
  Hash (normal): 98d2662d98d26f26
  Hash (bright): 98f2662c98d26f26
  Size: 640 × 480 px

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 JSON Output (for concerts.json) - PHASH hashes:

[
  {
    "file": "assets/test-images/concert-1.jpg",
    "photoHashes": {
      "phash": [
        "9853660d98d36f26",
        "98d2662d98d26f26",
        "98f2662c98d26f26"
      ]
    },
    "photoHash": [
      "9853660d98d36f26",
      "98d2662d98d26f26",
      "98f2662c98d26f26"
    ]
  },
  ...
]
```

**Note the differences**:

- pHash produces **16 hex characters** (vs 32 for dHash)
- Multi-exposure hashes still generate 3 variants (dark, normal, bright)

### Step 2: Update Concert Data

Update your `data.json` (or production data file) with the new pHash values:

**Before (dHash)**:

```json
{
  "concerts": [
    {
      "id": 1,
      "band": "The Midnight Echoes",
      "venue": "The Fillmore",
      "date": "2023-08-15",
      "audioFile": "/audio/concert-1.opus",
      "photoHash": [
        "00000000000001600acc000000000000",
        "00000000000001600acc000000000000",
        "00000000000001600acc000000000000"
      ]
    }
  ]
}
```

**After (pHash + dual storage)**:

```json
{
  "concerts": [
    {
      "id": 1,
      "band": "The Midnight Echoes",
      "venue": "The Fillmore",
      "date": "2023-08-15",
      "audioFile": "/audio/concert-1.opus",
      "photoHashes": {
        "phash": ["9853660d98d36f26", "98d2662d98d26f26", "98f2662c98d26f26"],
        "dhash": [
          "00000000000001600acc000000000000",
          "00000000000001600acc000000000000",
          "00000000000001600acc000000000000"
        ]
      },
      "photoHash": ["9853660d98d36f26", "98d2662d98d26f26", "98f2662c98d26f26"]
    }
  ]
}
```

💡 **Tip**: Copy the JSON output from the hash generation script directly—the snippet already matches the `photoHashes` schema (and includes the legacy `photoHash` array when using pHash). If you need dHash coverage, run the script with `--algorithm dhash` to populate `photoHashes.dhash` as well.

### Step 3: Update Application Code

Enable pHash in your application by setting the `hashAlgorithm` option:

**Before (default dHash)**:

```typescript
import { usePhotoRecognition } from '@/modules/photo-recognition';

function App() {
  const { stream } = useCameraAccess();

  // Uses dHash by default
  const { recognizedConcert, isRecognizing } = usePhotoRecognition(stream);

  // ... rest of code
}
```

**After (pHash)**:

```typescript
import { usePhotoRecognition } from '@/modules/photo-recognition';

function App() {
  const { stream } = useCameraAccess();

  // Explicitly use pHash
  const { recognizedConcert, isRecognizing } = usePhotoRecognition(stream, {
    hashAlgorithm: 'phash', // 👈 Add this option
  });

  // ... rest of code
}
```

### Step 4: Adjust Similarity Threshold (Optional)

pHash uses 64-bit hashes (vs 128-bit for dHash), so the Hamming distance scale is different:

**dHash thresholds** (out of 128 bits):

- Strict: 10 (~92% similarity)
- Balanced: 40 (~84% similarity)
- Lenient: 50 (~80% similarity)

**pHash equivalent thresholds** (out of 64 bits):

- Strict: 5 (~92% similarity)
- Balanced: 10 (~84% similarity)
- Lenient: 12 (~81% similarity)

**Recommendation**: Start with threshold 10 (balanced) and adjust based on testing:

```typescript
const { recognizedConcert } = usePhotoRecognition(stream, {
  hashAlgorithm: 'phash',
  similarityThreshold: 10, // 👈 Adjust from default 40
});
```

### Step 5: Test Recognition

Before deploying:

1. **Enable Test Mode**:
   - Triple-tap the screen
   - Toggle "Test Mode" feature flag
   - This shows detailed logging

2. **Test each concert photo**:
   - Point camera at photo
   - Verify recognition works
   - Check console logs for similarity scores

3. **Test edge cases**:
   - Different angles (0°, 15°, 30°, 45°)
   - Varied lighting conditions
   - Different distances

4. **Check telemetry**:
   ```
   📊 Telemetry Summary:
     Algorithm: PHASH
     Successful Recognitions: X
     Failed Attempts: Y
   ```

### Step 6: Deploy

Once testing is successful:

1. **Commit changes**:

   ```bash
   git add data.json src/App.tsx  # or wherever you updated code
   git commit -m "chore: migrate to pHash algorithm"
   git push
   ```

2. **Deploy to production** (Vercel, etc.)

3. **Monitor performance** in production:
   - Track recognition success rate
   - Monitor any user-reported issues
   - Review failure diagnostics in Test Mode

---

## Rollback Plan

If you need to revert to dHash:

### Quick Rollback (Code Only)

```typescript
// Change back to dHash
const { recognizedConcert } = usePhotoRecognition(stream, {
  hashAlgorithm: 'dhash', // or remove option entirely (uses default)
});
```

**Note**: This will fail with pHash-generated hashes in `data.json`!

### Full Rollback (Code + Data)

1. **Restore old `data.json`** from backup
2. **Revert code changes**:
   ```bash
   git revert HEAD  # if you committed the migration
   ```
3. **Redeploy**

---

## Side-by-Side Comparison (A/B Testing)

Want to compare both algorithms before fully migrating?

### Dual Hash Storage

Store both dHash and pHash values inside the `photoHashes` object:

```json
{
  "id": 1,
  "band": "The Midnight Echoes",
  "photoHashes": {
    "dhash": [
      "00000000000001600acc000000000000",
      "00000000000001600acc000000000000",
      "00000000000001600acc000000000000"
    ],
    "phash": ["9853660d98d36f26", "98d2662d98d26f26", "98f2662c98d26f26"]
  },
  "photoHash": ["9853660d98d36f26", "98d2662d98d26f26", "98f2662c98d26f26"]
}
```

### Runtime Toggle

Add UI to switch algorithms:

```typescript
function App() {
  const [algorithm, setAlgorithm] = useState<'dhash' | 'phash'>('dhash');

  const { recognizedConcert } = usePhotoRecognition(stream, {
    hashAlgorithm: algorithm,
  });

  return (
    <>
      {/* Algorithm switcher in dev mode */}
      {import.meta.env.DEV && (
        <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
          <option value="dhash">dHash</option>
          <option value="phash">pHash</option>
        </select>
      )}
      {/* ... rest of app */}
    </>
  );
}
```

---

## Performance Considerations

### Bundle Size Impact

| Algorithm           | Bundle Size (gzipped) | Increase |
| ------------------- | --------------------- | -------- |
| dHash only          | 84.44 KB              | Baseline |
| pHash only          | 85.27 KB              | +0.83 KB |
| Both (dual support) | 85.27 KB              | +0.83 KB |

**Conclusion**: Minimal impact, well under 10 KB budget.

### Hash Computation Speed

| Algorithm | iPhone 13 Pro | Pixel 7 | Desktop |
| --------- | ------------- | ------- | ------- |
| dHash     | 6-8ms         | 8-10ms  | 3-5ms   |
| pHash     | 15-25ms       | 20-30ms | 10-15ms |

**Conclusion**: pHash is slower but still well under 25ms target. Acceptable for 1 FPS frame sampling.

---

## Troubleshooting

### Photos not being recognized after migration

**Possible causes**:

1. pHash values not generated correctly
2. Similarity threshold too strict for pHash
3. Old dHash values still in data.json

**Solutions**:

1. Regenerate pHash values from source images
2. Increase threshold to 12-15 and test
3. Verify `photoHashes.phash` values are 16 hex chars (pHash) and `photoHashes.dhash` values are 32 hex chars (legacy dHash)

### Lower accuracy than expected

**Possible causes**:

1. Reference photos different from printed photos
2. Threshold needs adjustment
3. Source images are low quality

**Solutions**:

1. Generate hashes from actual printed photo (photograph the print)
2. Adjust threshold based on test results
3. Use higher quality source images (300+ DPI)

### Performance issues on older devices

**Possible causes**:

1. pHash DCT computation is more intensive
2. Device CPU limitations

**Solutions**:

1. Increase `checkInterval` to reduce frame sampling rate:
   ```typescript
   usePhotoRecognition(stream, {
     hashAlgorithm: 'phash',
     checkInterval: 2000, // Check every 2 seconds instead of 1
   });
   ```
2. Consider reverting to dHash for older devices
3. Profile performance using browser DevTools

---

## Migration Checklist

Before marking migration complete:

- [ ] All concert photos have pHash values generated
- [ ] `data.json` updated with pHash values
- [ ] Application code updated to use `hashAlgorithm: 'phash'`
- [ ] Similarity threshold adjusted if needed
- [ ] Tested recognition on all target devices
- [ ] Tested under various conditions (angles, lighting)
- [ ] Backup of old dHash data.json stored safely
- [ ] Changes committed and deployed
- [ ] Production performance monitored
- [ ] Documentation updated (if needed)

---

## Getting Help

If you encounter issues:

1. **Check Test Mode logs** for diagnostic information
2. **Review benchmarking guide** at `docs/phase-2-benchmarking-guide.md`
3. **Compare with baseline** in `docs/image-recognition-exploratory-analysis.md`
4. **File an issue** with:
   - Device/browser details
   - Test Mode logs
   - Reproduction steps
   - Expected vs actual behavior

---

## Further Reading

- **[Phase 2 Benchmarking Guide](./phase-2-benchmarking-guide.md)** - Detailed testing protocol
- **[Angle Compensation Analysis](./phase-2-angle-compensation-analysis.md)** - Understanding angle handling
- **[Photo Recognition README](../src/modules/photo-recognition/README.md)** - Complete module documentation
- **[Image Recognition Exploratory Analysis](./image-recognition-exploratory-analysis.md)** - Research and baseline data

---

**Last Updated**: 2025-11-16
