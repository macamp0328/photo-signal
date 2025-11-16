# Test Images

This directory contains sample JPEG images for testing photo recognition and display functionality.

## Files

### Baseline Concert Photos

- `concert-1.jpg` - Test image for "The Midnight Echoes" concert (37KB)
- `concert-2.jpg` - Test image for "Electric Dreams" concert (31KB)
- `concert-3.jpg` - Test image for "Velvet Revolution" concert (29KB)
- `concert-4.jpg` - Test image for "Sunset Boulevard" concert (27KB)

### High-Contrast Calibration Targets

- `easy-target-bullseye.png` - High-contrast bullseye with layered rings (generated via canvas)
- `easy-target-diagonals.png` - Bold diagonal bands with text overlay
- `easy-target-checker.png` - Checkerboard grid with central label

### Edge Case Test Images

Based on failure categories from `docs/image-recognition-exploratory-analysis.md` Section 2:

**Motion Blur (Category 2.1)**

- `edge-case-motion-blur-light.png` - Light motion blur (5px horizontal) - simulates minor camera shake
- `edge-case-motion-blur-moderate.png` - Moderate motion blur (10px) - typical handheld movement
- `edge-case-motion-blur-heavy.png` - Heavy motion blur (15px) - walking while scanning

**Glare and Reflections (Category 2.4)**

- `edge-case-glare-light.png` - Light glare (1 specular reflection) - minor reflection
- `edge-case-glare-moderate.png` - Moderate glare (2 reflections) - typical overhead lighting
- `edge-case-glare-heavy.png` - Heavy glare (3+ reflections) - glossy photo in bright light

**Poor Lighting Conditions (Category 2.3)**

- `edge-case-low-light.png` - Low-light conditions (30% brightness + noise) - evening indoor

**Extreme Angles (Category 2.2)**

- `edge-case-angle-15deg.png` - 15-degree viewing angle - slight perspective distortion
- `edge-case-angle-30deg.png` - 30-degree viewing angle - moderate perspective distortion
- `edge-case-angle-45deg.png` - 45-degree viewing angle - severe perspective distortion

**Combined Edge Cases**

- `edge-case-combined-blur-glare.png` - Motion blur + glare (realistic challenging scenario)
- `edge-case-combined-angle-lowlight.png` - 30-degree angle + low light (evening table viewing)

## License

All images in this directory are generated test files created specifically for this project and are released under CC0 (Public Domain). See [ASSET_LICENSES.md](../../ASSET_LICENSES.md) for details.

## Purpose

These images are used for:

- Testing photo recognition logic under various challenging conditions
- Validating failure category detection and telemetry
- Testing camera view and overlay display
- Module-level testing of image processing features
- Regression testing for accuracy thresholds (Section 4 of exploratory analysis)
- Development without requiring real concert photos

## Specifications

- **Formats**: JPEG + PNG
- **Dimensions**: 640x480 pixels
- **Size**: ~30-50KB average per file
- **Color Space**: RGB
- **Generation**:
  - Easy targets: `npm run create-easy-images`
  - Edge cases: `node scripts/create-edge-case-test-images.js`

## Expected Recognition Accuracy (Target Thresholds)

Based on `docs/image-recognition-exploratory-analysis.md` Section 4:

| Condition Category     | Test Images                        | Expected Accuracy (Phase 1) |
| ---------------------- | ---------------------------------- | --------------------------- |
| Ideal (baseline)       | concert-_.jpg, easy-target-_.png   | ≥95%                        |
| Motion Blur (light)    | edge-case-motion-blur-light.png    | ≥80%                        |
| Motion Blur (moderate) | edge-case-motion-blur-moderate.png | ≥60%                        |
| Motion Blur (heavy)    | edge-case-motion-blur-heavy.png    | ≥40%                        |
| Glare (light)          | edge-case-glare-light.png          | ≥85%                        |
| Glare (moderate/heavy) | edge-case-glare-\*.png             | ≥70%                        |
| Low Light              | edge-case-low-light.png            | ≥75%                        |
| Angle (15°)            | edge-case-angle-15deg.png          | ≥85%                        |
| Angle (30°)            | edge-case-angle-30deg.png          | ≥70%                        |
| Angle (45°)            | edge-case-angle-45deg.png          | ≥50%                        |
| Combined challenges    | edge-case-combined-\*.png          | ≥60%                        |

**Note**: These thresholds represent realistic Phase 1 targets after implementing sharpness detection, glare guidance, and multi-exposure hashing improvements.
