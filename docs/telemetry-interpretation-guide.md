# Telemetry Interpretation Guide

> **Purpose**: Guide for understanding and using the telemetry data exported from Photo Signal's Test Mode.

## Overview

Photo Signal's telemetry system tracks photo recognition performance and failure patterns in real-time. This data helps identify edge cases, validate improvements, and diagnose recognition issues.

## Accessing Telemetry

### In-App Export (Test Mode)

1. Enable **Test Data Mode** in Secret Settings (triple-tap/click anywhere)
2. Start scanning photos with the camera
3. Telemetry widget appears in bottom-right corner showing live stats
4. Click **"📥 Export JSON"** for raw structured data
5. Click **"📝 Export Markdown Report"** for formatted table report

### Automated Validation (CI/CD)

Edge case accuracy thresholds are validated as part of standard CI test runs.

## Telemetry Data Structure

### Summary Metrics

| Metric                      | Description                         | Good Value       | Poor Value       |
| --------------------------- | ----------------------------------- | ---------------- | ---------------- |
| **Total Frames**            | Total frames processed              | Any              | N/A              |
| **Quality Frames**          | Frames that passed quality checks   | >70% of total    | <50% of total    |
| **Blur Rejections**         | Frames rejected for motion blur     | <20% of total    | >40% of total    |
| **Glare Rejections**        | Frames rejected for excessive glare | <15% of total    | >30% of total    |
| **Successful Recognitions** | Photos successfully matched         | >80% of attempts | <60% of attempts |
| **Failed Attempts**         | Quality frames that didn't match    | <20% of attempts | >40% of attempts |

### Failure Categories

Each failed recognition is categorized to identify patterns:

| Category         | Description                                | Common Causes                                                      |
| ---------------- | ------------------------------------------ | ------------------------------------------------------------------ |
| **motion-blur**  | Frame too blurry for recognition           | Camera shake, walking while scanning, fast movement                |
| **glare**        | Excessive specular reflections             | Glossy photo surface, overhead lighting, window reflections        |
| **poor-quality** | Low-quality frame (neither blur nor glare) | Camera issues, focus problems, compression artifacts               |
| **no-match**     | No concert in database matched             | Photo not in dataset, severe distortion, wrong photo               |
| **collision**    | Multiple similar matches                   | Similar photos in database, hash collision, near-threshold matches |
| **unknown**      | Unclassified failure                       | Edge cases not covered by other categories                         |

### Switch Decision Metrics (Prompt Behavior)

When music is already playing and a new strong candidate appears, app-level telemetry records prompt outcomes:

| Metric                 | Description                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| **shownCount**         | Number of times switch prompt was shown                                  |
| **confirmCount**       | User confirmed switching to candidate track                              |
| **dismissCount**       | User selected “Keep current track”                                       |
| **decisionLatencyMs**  | Time-to-decision stats (average/last/min/max + samples) from prompt show |
| **lastPromptSnapshot** | Last prompt context: active/candidate IDs, confidence, margin, timestamp |

Use `confirmRate` and `dismissRate` (derived in JSON export) to evaluate whether switch prompts are too aggressive for current field conditions.

## Interpreting JSON Export

### Sample JSON Structure

```json
{
  "timestamp": "2024-03-15T10:30:45.123Z",
  "summary": {
    "totalFrames": 150,
    "qualityFrames": 105,
    "qualityFrameRate": "70.0%",
    "blurRejections": 30,
    "blurRejectionRate": "20.0%",
    "glareRejections": 15,
    "glareRejectionRate": "10.0%",
    "successfulRecognitions": 5,
    "failedAttempts": 100,
    "recognitionSuccessRate": "4.8%"
  },
  "failuresByCategory": [
    {
      "category": "motion-blur",
      "count": 30,
      "percentage": "20.0%"
    }
  ],
  "recentFailures": [
    {
      "category": "motion-blur",
      "reason": "Sharpness 85.3 below threshold 100",
      "frameHash": "N/A",
      "timestamp": "2024-03-15T10:30:44.500Z"
    }
  ],
  "switchDecisionMetrics": {
    "shownCount": 3,
    "confirmCount": 2,
    "dismissCount": 1,
    "decisionLatencyMs": {
      "average": 1000,
      "last": 1200,
      "min": 800,
      "max": 1200,
      "samples": [800, 1000, 1200]
    },
    "lastPromptSnapshot": {
      "activeConcertId": 1,
      "candidateConcertId": 2,
      "confidence": 96.25,
      "margin": 5
    }
  },
  "rawData": {
    /* Full telemetry object */
  }
}
```

### Key Insights from JSON

1. **High Blur Rejection Rate** (>30%)
   - **Diagnosis**: User is moving camera too much during scanning
   - **Action**: Remind user to hold camera steady
   - **Improvement**: Consider lowering sharpness threshold (from 100 to 80)

2. **High Glare Rejection Rate** (>25%)
   - **Diagnosis**: Lighting conditions causing excessive reflections
   - **Action**: Suggest tilting photo to avoid glare, adjust lighting
   - **Improvement**: Glare detection is working as designed

3. **Low Quality Frame Rate** (<60%)
   - **Diagnosis**: Most frames failing quality checks
   - **Action**: Check camera settings, lighting, photo surface type
   - **Improvement**: May need to adjust quality thresholds

4. **Low Recognition Success Rate** (<50% of quality frames)
   - **Diagnosis**: Quality frames not matching stored hashes
   - **Action**: Verify hashes are correct, check photo dataset completeness
   - **Improvement**: May need multi-exposure hashing, pHash algorithm

5. **High Switch Prompt Dismiss Rate** (>60% dismissals)
   - **Diagnosis**: Prompt candidates are often not compelling enough to users
   - **Action**: Review `switchDecisionMetrics.lastPromptSnapshot` confidence/margin with nearby failures
   - **Improvement**: Field-tune switch thresholds (`switchDistanceThreshold`, margin thresholds, delay multiplier)

## Interpreting Markdown Report

### Sample Report Sections

#### Summary Statistics Table

Shows overview of all processed frames and their outcomes. **Look for**:

- Quality frame rate >70% indicates good frame quality
- Blur/glare rejection rates help identify environmental issues

#### Failure Categories Table

Breaks down failures by type. **Look for**:

- Top categories indicate systematic issues
- `motion-blur` >25% → User needs steadier hands
- `glare` >20% → Lighting needs adjustment
- `no-match` >30% → Dataset may be incomplete
- `collision` >10% → Photos may be too similar

#### Recent Failures List

Shows last 10 failures with timestamps and reasons. **Look for**:

- Patterns in failure reasons
- Specific threshold violations
- Temporal clustering (failures at specific times)

## Using Telemetry for Debugging

### Scenario 1: Low Recognition Rate Despite High Quality Frames

**Symptoms**:

- Quality frame rate: 85% ✓
- Successful recognitions: 10% ✗

**Diagnosis Steps**:

1. Check `failuresByCategory` → Is `no-match` the top category?
2. Review `recentFailures` → What are the actual similarity scores?
3. Export JSON → Check `rawData.bestMatch` distances

**Common Causes**:

- Hashes in database are incorrect (regenerate with `npm run hashes:paths`)
- Similarity threshold too strict (try increasing from 40 to 50)
- Photos are too different from reference (lighting, printing quality)

### Scenario 2: High Blur Rejection Rate

**Symptoms**:

- Blur rejection rate: 45% ✗
- Quality frame rate: 55% ✗

**Diagnosis Steps**:

1. Check `blurRejections` count vs `totalFrames`
2. Review `recentFailures` → What sharpness values are being rejected?

**Common Causes**:

- Sharpness threshold too strict (100 is default, try 80)
- Camera auto-focus struggling in environment
- User moving camera during scanning

**Solutions**:

- Lower sharpness threshold in settings
- Add visual feedback to encourage holding steady
- Test on different device/camera

### Scenario 3: High Glare Rejection Rate

**Symptoms**:

- Glare rejection rate: 35% ✗
- Quality frame rate: 65% ✗

**Diagnosis Steps**:

1. Check `glareRejections` vs `totalFrames`
2. Review recent failures for glare percentage values

**Common Causes**:

- Glossy photo prints in bright lighting
- Overhead lights reflecting directly on photo
- Glass-covered or laminated photos

**Solutions**:

- Use matte photo prints instead of glossy
- Adjust lighting angle
- Tilt photo to avoid reflections
- Lower glare threshold if needed (from 250 to 240)

## Regression Testing with Telemetry

### Edge Case Accuracy Tests

The automated test suite (`edgeCaseAccuracy.test.ts`) validates recognition against expected thresholds:

```bash
npm run test:run -- src/modules/photo-recognition/__tests__/edgeCaseAccuracy.test.ts
```

**Expected Output**:

```
📊 Edge Case Performance Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Edge Case: Motion Blur (Light)      87.9% (target: 80%)
✓ Edge Case: Glare (Moderate)         87.9% (target: 70%)
...
Average Accuracy: 89.9%
Pass Rate: 100% (12/12)
```

**Interpretation**:

- ✓ Pass: Accuracy meets or exceeds target for that edge case
- ✗ Fail: Accuracy below target → regression detected
- Average: Overall edge case performance (baseline: ≥65%)
- Pass Rate: Percentage of edge cases meeting targets (target: ≥75%)

These edge-case assertions are also exercised in standard CI test runs.

## Best Practices

### For Development

1. **Run tests before committing**: `npm run test:run`
2. **Export telemetry after changes**: Test with real photos, export report
3. **Compare before/after**: Keep baseline telemetry to measure improvements
4. **Focus on top categories**: Fix highest-impact failure categories first

### For Testing

1. **Use Test Mode**: Always enable for development testing
2. **Export regularly**: Export telemetry after each major test session
3. **Document conditions**: Note lighting, photo types, environment in report
4. **Test edge cases**: Specifically test motion blur, glare, angles

### For Production Monitoring

1. **Track trends**: Compare telemetry across versions
2. **Watch for regressions**: Monitor pass rate and average accuracy
3. **User feedback**: Correlate telemetry with user-reported issues
4. **Iterate on thresholds**: Adjust quality thresholds based on data

## Troubleshooting

### Q: Why is quality frame rate so low?

**A**: Check blur and glare rejection rates:

- High blur → Adjust sharpness threshold or use tripod
- High glare → Change lighting or photo surface
- Both high → Environmental factors need improvement

### Q: Why do tests pass but real-world performance is poor?

**A**: Edge case tests use reference images directly:

- Tests validate hash generation and comparison logic
- Real-world uses camera captures with additional noise
- Camera quality, focus, and stability matter in practice

### Q: How do I know if telemetry is accurate?

**A**: Telemetry tracks what the algorithm sees:

- Use Test Mode debug overlay to verify frame processing
- Compare telemetry counts with actual scan session duration
- Export and review recent failures for plausibility

### Q: What's a "good" baseline for my use case?

**A**: Depends on environment and photos:

- **Controlled environment** (studio): Target >90% quality frames, >85% recognition
- **Home gallery** (typical): Target >70% quality frames, >75% recognition
- **Challenging** (outdoor, varied): Target >60% quality frames, >65% recognition

## References

- **Test Implementation**: `src/modules/photo-recognition/__tests__/edgeCaseAccuracy.test.ts`
- **Telemetry Types**: `src/modules/photo-recognition/types.ts`
- **Export Component**: `src/modules/photo-recognition/TelemetryExport.tsx`

---

**Last Updated**: 2024-11-16
