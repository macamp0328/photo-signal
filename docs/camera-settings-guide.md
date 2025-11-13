# Camera Settings Guide

> **Purpose**: Comprehensive documentation of camera API constraints, browser support, and optimization strategies for Photo Signal's low-light use case.

---

## Overview

Photo Signal uses the browser's MediaDevices.getUserMedia API to access the camera. This document details the camera constraints used, their browser support, and rationale for low-light bathroom installations.

---

## Camera Constraints

### Basic Constraints

These constraints are widely supported across all modern browsers:

| Constraint    | Value           | Purpose                                |
| ------------- | --------------- | -------------------------------------- |
| `facingMode`  | `'environment'` | Use rear camera (if available)         |
| `aspectRatio` | `3/2`           | Match typical photo print aspect ratio |
| `audio`       | `false`         | No audio needed for photo recognition  |

### Advanced Constraints (Low-Light Optimization)

These constraints optimize for Photo Signal's typical installation environment (bathroom with limited natural light):

| Constraint         | Value                             | Purpose                  | Browser Support          |
| ------------------ | --------------------------------- | ------------------------ | ------------------------ |
| `focusMode`        | `{ ideal: 'continuous' }`         | Continuous autofocus     | Limited (Chrome/Android) |
| `pointsOfInterest` | `{ ideal: [{ x: 0.5, y: 0.5 }] }` | Center focus point       | Limited (Chrome/Android) |
| `exposureMode`     | `{ ideal: 'continuous' }`         | Auto exposure adjustment | Limited (Chrome/Android) |
| `whiteBalanceMode` | `{ ideal: 'continuous' }`         | Auto white balance       | Limited (Chrome/Android) |
| `brightness`       | `{ ideal: 1.2 }`                  | Boost brightness 20%     | Limited (varies)         |
| `contrast`         | `{ ideal: 1.2 }`                  | Boost contrast 20%       | Limited (varies)         |

---

## Browser Support Matrix

### Desktop Browsers

| Browser     | Basic Constraints | Advanced Constraints | Notes                                               |
| ----------- | ----------------- | -------------------- | --------------------------------------------------- |
| Chrome/Edge | ✅ Full           | ⚠️ Partial           | Advanced constraints may work with external cameras |
| Firefox     | ✅ Full           | ❌ None              | Ignores advanced constraints                        |
| Safari      | ✅ Full           | ❌ None              | Ignores advanced constraints                        |

### Mobile Browsers

| Platform | Browser | Basic Constraints | Advanced Constraints | Notes                                |
| -------- | ------- | ----------------- | -------------------- | ------------------------------------ |
| Android  | Chrome  | ✅ Full           | ✅ Good              | Best support for camera controls     |
| Android  | Firefox | ✅ Full           | ❌ None              | Basic functionality only             |
| iOS      | Safari  | ✅ Full           | ⚠️ Limited           | Some constraints partially supported |
| iOS      | Chrome  | ✅ Full           | ⚠️ Limited           | Uses Safari engine, same limitations |

---

## Implementation Strategy

### Graceful Degradation

All advanced constraints use `{ ideal: value }` instead of `{ exact: value }`:

- **Supported browsers**: Apply the constraint
- **Unsupported browsers**: Silently ignore the constraint, use camera defaults
- **Result**: App works everywhere, optimized where possible

### Example

```typescript
const constraints = {
  video: {
    facingMode: 'environment',
    aspectRatio: 3 / 2,
    // Advanced constraints - browsers ignore what they don't support
    focusMode: { ideal: 'continuous' },
    exposureMode: { ideal: 'continuous' },
  },
};
```

---

## Verification

### How to Check Applied Settings

In development mode, Photo Signal logs the actual applied camera settings:

```javascript
const track = stream.getVideoTracks()[0];
const settings = track.getSettings();
console.log('Camera settings applied:', settings);
```

This shows which constraints the browser actually applied vs. ignored.

### Testing on Different Devices

1. **Android Chrome**: Expect most/all advanced constraints to apply
2. **iOS Safari**: Expect basic constraints only
3. **Desktop**: Expect basic constraints, advanced constraints may work with high-end webcams

---

## W3C Media Capture Specification

### Constraint Types

The Media Capture and Streams spec defines three types of constraint values:

1. **Exact**: `{ exact: value }` - Fail if not supported
2. **Ideal**: `{ ideal: value }` - Use if possible, fallback if not
3. **Range**: `{ min: x, max: y, ideal: z }` - Flexible constraints

Photo Signal uses `ideal` for all advanced constraints to ensure broad compatibility.

### Additional Available Constraints

These constraints are defined in the spec but not currently used:

- `exposureCompensation` - EV adjustment (-3 to +3 typically)
- `exposureTime` - Shutter speed (100 microsecond units)
- `colorTemperature` - White balance in Kelvin (2000-8000)
- `iso` - ISO sensitivity (depends on device)
- `saturation` - Color saturation (0 = grayscale)
- `sharpness` - Sharpness adjustment
- `torch` - Flash/torch on/off
- `zoom` - Digital/optical zoom
- `focusDistance` - Manual focus distance in meters

**Note**: Most of these have even more limited browser support than the constraints currently used.

---

## Black and White Mode

### Why Black and White?

Printed reference photos in Photo Signal are black and white. Processing camera frames in grayscale could:

- Reduce noise in low-light conditions
- Improve photo recognition accuracy (focusing on luminance, not color)
- Potentially improve performance (less data to process)

### Native Camera Constraint

```typescript
saturation: 0; // or { ideal: 0 }
```

**Browser Support**: Very limited, unreliable

### Recommended Approach: Post-Processing

Instead of relying on camera constraints, convert frames to grayscale during photo recognition:

```typescript
// In photo-recognition module, when extracting frame from video
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

// Draw video frame
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

// Convert to grayscale
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const data = imageData.data;

for (let i = 0; i < data.length; i += 4) {
  const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  data[i] = gray; // R
  data[i + 1] = gray; // G
  data[i + 2] = gray; // B
  // data[i + 3] is alpha, leave unchanged
}

ctx.putImageData(imageData, 0, 0);
```

**Benefits**:

- Works in all browsers
- Predictable behavior
- Better control over conversion algorithm

**Recommendation**: Implement grayscale conversion in the photo-recognition module as a separate enhancement.

---

## ImageCapture API

### Alternative to getUserMedia Constraints

The ImageCapture API provides additional camera controls:

```typescript
const track = stream.getVideoTracks()[0];
const imageCapture = new ImageCapture(track);

// Get photo capabilities
const capabilities = await imageCapture.getPhotoCapabilities();
console.log(capabilities);

// Take a photo with specific settings
const blob = await imageCapture.takePhoto({
  imageHeight: 1080,
  imageWidth: 1920,
  fillLightMode: 'flash',
});
```

**Browser Support**: Chrome/Edge only (not Firefox/Safari)

**Current Status**: Not used in Photo Signal, as we need continuous video stream for motion detection, not still photo capture.

---

## Performance Considerations

### Low-Light Impact

Enabling auto exposure and brightness boost may:

- **Increase processing time** per frame (camera hardware adjusting settings)
- **Reduce frame rate** in very low light (longer exposure times)
- **Increase noise** (higher ISO/gain in low light)

In practice, these impacts are minimal on modern mobile devices.

### Motion Detection Sensitivity

In low-light conditions with slower shutter speeds:

- Motion blur may be more pronounced
- Motion detection threshold may need adjustment
- Consider exposing motion sensitivity in secret settings

---

## Future Enhancements

### Torch/Flash Control

For extremely dark environments:

```typescript
torch: {
  ideal: true;
} // Turn on camera flash/torch
```

**Considerations**:

- May drain battery quickly
- May be uncomfortable for users
- Limited browser support
- Could be toggleable in secret settings

### Exposure Compensation

Fine-tune brightness beyond basic boost:

```typescript
exposureCompensation: {
  ideal: 1.0;
} // +1 EV
```

**Use case**: Adjust based on ambient light sensor (if accessible)

### Resolution Optimization

Allow users to trade quality for performance:

```typescript
width: { ideal: 1280 },
height: { ideal: 720 },
```

**Consideration**: Lower resolution may reduce photo recognition accuracy

---

## Troubleshooting

### Camera Not Working

1. **Check permissions**: Browser blocked camera access
2. **Check HTTPS**: Camera API requires secure context (HTTPS or localhost)
3. **Check device**: Ensure device has a rear camera
4. **Check browser**: Use Chrome/Edge on Android for best results

### Poor Low-Light Performance

1. **Check constraints applied**: Log `track.getSettings()` in dev mode
2. **Try different browser**: Chrome on Android has best support
3. **Improve lighting**: Photo Signal requires some ambient light
4. **Adjust motion threshold**: Reduce sensitivity in secret settings

### Autofocus Not Working

1. **Check browser**: Advanced constraints not supported on all platforms
2. **Manual focus**: Some cameras don't support autofocus
3. **Focus distance**: Ensure reference photo is within camera's focus range

---

## Resources

- [MDN: MediaDevices.getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [MDN: MediaTrackConstraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints)
- [W3C: Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/)
- [MDN: ImageCapture API](https://developer.mozilla.org/en-US/docs/Web/API/ImageCapture)
- [Can I Use: getUserMedia](https://caniuse.com/stream)

---

## Summary

Photo Signal's camera module optimizes for low-light bathroom installations by:

1. Using `ideal` constraints for graceful degradation
2. Requesting continuous autofocus with center focus point
3. Enabling auto exposure and white balance
4. Slightly boosting brightness and contrast
5. Logging applied settings in development mode

This approach ensures the app works everywhere while providing enhanced performance on devices with better camera API support (primarily Chrome on Android).
