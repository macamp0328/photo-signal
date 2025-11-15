# Grayscale Camera Feature Implementation

## Overview

This document describes the implementation of the grayscale camera image feature flag, which enables users to toggle between color and black & white camera preview and photo recognition.

## Feature Flag

**ID:** `grayscale-mode`  
**Name:** Grayscale Conversion  
**Category:** experimental  
**Default:** disabled

**Description:**

> Convert camera frames to black and white before photo recognition. May improve accuracy since printed reference photos are monochrome, and can reduce noise in low-light conditions.

## Implementation

### 1. Camera Preview (Visual)

When the `grayscale-mode` flag is enabled, the camera preview applies a CSS grayscale filter:

```css
.grayscale {
  filter: grayscale(100%);
}
```

This provides immediate visual feedback to the user that grayscale mode is active.

### 2. Photo Recognition (Processing)

The photo recognition module was already configured to apply grayscale conversion to image data before computing perceptual hashes:

```typescript
// In usePhotoRecognition.ts
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

// Apply grayscale conversion if enabled
if (isEnabled('grayscale-mode')) {
  convertToGrayscale(imageData);
}

// Compute hash of current frame
const currentHash = computeDHash(imageData);
```

The `convertToGrayscale()` function uses ITU-R BT.601 luma coefficients for perceptually accurate grayscale conversion:

```typescript
// Luma calculation
const gray = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
```

## Usage

### Activating the Feature

1. **Open Secret Settings:** Triple-tap/click in the center of the screen
2. **Find the Flag:** Scroll to "Grayscale Conversion" in the Feature Flags section
3. **Toggle:** Click the toggle switch to enable/disable
4. **Apply:** Click "Send It 🚀" to apply changes and reload the app

### Visual Feedback

- **Enabled:** Camera preview displays in black and white
- **Disabled:** Camera preview displays in full color

### Effect on Photo Recognition

When enabled, both the visible camera preview and the image processing pipeline use grayscale images:

- **User sees:** Black and white camera preview
- **Recognition uses:** Grayscale image data for hash computation
- **Potential benefit:** Reduced color noise may improve matching accuracy for monochrome printed photos

## Technical Details

### Component Props

```typescript
interface CameraViewProps {
  // ... other props
  grayscale?: boolean; // Apply grayscale filter to camera view
}
```

### Data Flow

```
Feature Flag Toggle
    ↓
App.tsx: isEnabled('grayscale-mode')
    ↓
CameraView: grayscale={true/false}
    ↓
CSS Class: styles.grayscale applied conditionally
    ↓
Video Element: filter: grayscale(100%)
```

### Files Modified

1. **Types:** `src/modules/camera-view/types.ts`
   - Added `grayscale?: boolean` to `CameraViewProps`

2. **Component:** `src/modules/camera-view/CameraView.tsx`
   - Added `grayscale` prop parameter with default `false`
   - Applied conditional CSS class to video element

3. **Styles:** `src/modules/camera-view/CameraView.module.css`
   - Added `.grayscale` class with `filter: grayscale(100%)`

4. **App:** `src/App.tsx`
   - Passed `grayscale={isEnabled('grayscale-mode')}` to CameraView

5. **Tests:** `src/modules/camera-view/CameraView.test.tsx`
   - Added 4 test cases for grayscale functionality

6. **Docs:** `src/modules/camera-view/README.md`
   - Added grayscale prop documentation
   - Added usage example

## Testing

### Unit Tests

Four test cases verify grayscale functionality:

1. **Default behavior:** Grayscale filter not applied when prop is undefined
2. **Enabled state:** Grayscale filter applied when prop is `true`
3. **Disabled state:** Grayscale filter not applied when prop is `false`
4. **Toggle behavior:** Filter correctly applied/removed when prop changes

### Manual Testing

To manually test the feature:

1. Run the development server: `npm run dev`
2. Open the app in a browser
3. Triple-tap/click in the center of the screen to open secret settings
4. Toggle "Grayscale Conversion" feature flag
5. Click "Send It 🚀" to reload
6. Verify camera preview is now black and white
7. Toggle again to return to color

## Browser Compatibility

The CSS `filter: grayscale()` property is supported in:

- ✅ Chrome 18+
- ✅ Firefox 35+
- ✅ Safari 6.1+
- ✅ Edge 12+
- ✅ iOS Safari 6.1+
- ✅ Android Browser 4.4+

**Coverage:** 98%+ of browsers in use

## Performance

The CSS grayscale filter is hardware-accelerated and has negligible performance impact:

- **Filter application:** GPU-accelerated CSS transform
- **Image processing:** Already implemented, no change
- **Frame rate:** No measurable impact on 60 FPS camera feed

## Future Enhancements

Potential improvements to consider:

- [ ] Add keyboard shortcut to toggle grayscale mode
- [ ] Add grayscale intensity slider (0-100%)
- [ ] Add contrast adjustment for low-light conditions
- [ ] Add side-by-side preview comparison

## References

- **Feature Flag Config:** `src/modules/secret-settings/featureFlagConfig.ts`
- **Camera View Module:** `src/modules/camera-view/`
- **Photo Recognition:** `src/modules/photo-recognition/usePhotoRecognition.ts`
- **Grayscale Conversion:** `src/modules/photo-recognition/algorithms/utils.ts`
- **Secret Settings:** `src/modules/secret-settings/`

## Related Documentation

- [Camera View README](../src/modules/camera-view/README.md)
- [Secret Settings README](../src/modules/secret-settings/README.md)
- [Photo Recognition README](../src/modules/photo-recognition/README.md)
- [Camera Settings Guide](./camera-settings-guide.md)

---

**Implementation Date:** 2025-11-15  
**Author:** GitHub Copilot (Bug Fix Specialist)  
**Status:** ✅ Complete
