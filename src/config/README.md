# Guidance Configuration

Centralized configuration for real-time user guidance messages in Photo Signal.

## Overview

This module provides a single source of truth for all guidance-related settings:

- Guidance messages (text, icons, priorities)
- Detection thresholds
- Display behavior (duration, cooldown)
- Feature toggles

## Configuration Structure

### GuidanceConfig

```typescript
interface GuidanceConfig {
  enabled: boolean; // Global guidance toggle
  messages: Record<GuidanceType, GuidanceMessage>;
  thresholds: GuidanceThresholds;
  displayDuration: number; // How long to show messages (ms)
  cooldownDuration: number; // Min time between same message (ms)
  enableHaptics: boolean; // Mobile haptic feedback
  enableAudioCues: boolean; // Audio feedback
  showInProduction: boolean; // Show in production or Test Mode only
}
```

### Guidance Types

- `motion-blur` - Camera shake/movement detected
- `glare` - Reflections obscuring photo
- `poor-lighting` - Under/overexposed frames
- `distance` - Photo too close/far from camera (future)
- `off-center` - Photo not centered in frame (future)
- `none` - No issues detected

## Default Configuration

### Messages

Each message has:

- **icon**: Emoji or symbol (e.g., '📹', '✨', '💡')
- **text**: Short guidance (e.g., "Hold steady", "Tilt to avoid glare")
- **detail**: Optional longer explanation
- **priority**: 1-5 (higher = more important)

Priority order (highest first):

1. Motion blur (5)
2. Glare (4)
3. Poor lighting (3)
4. Distance (3)
5. Off-center (2)

### Detection Thresholds

Based on runtime behavior documented in `docs/PHOTO_RECOGNITION_DEEP_DIVE.md`:

```typescript
{
  sharpness: 100,                    // Laplacian variance threshold
  glarePixelThreshold: 250,          // Brightness level for blown-out pixels
  glarePercentageThreshold: 20,      // % of image that must be blown out
  minBrightness: 50,                 // Underexposure threshold
  maxBrightness: 220,                // Overexposure threshold
  minFrameFillPercentage: 40,        // Photo should fill 40-90% of frame
  maxFrameFillPercentage: 90,
  maxHorizontalOffsetPercentage: 20, // Center tolerance (±20%)
  maxVerticalOffsetPercentage: 20,
}
```

### Display Behavior

- **Display Duration**: 3000ms (3 seconds)
- **Cooldown Duration**: 5000ms (5 seconds)
- Same guidance won't show again for 5 seconds after being dismissed

## Usage

### Import and Use

```typescript
import { defaultGuidanceConfig, selectGuidanceToShow } from '@/config/guidanceConfig';

// Get highest priority guidance from active issues
const activeGuidance = selectGuidanceToShow(['motion-blur', 'glare'], defaultGuidanceConfig);
// Returns: 'motion-blur' (higher priority)

// Get message for display
const message = defaultGuidanceConfig.messages[activeGuidance];
console.log(message.text); // "Hold steady"
```

### Customization

To customize guidance for your use case:

```typescript
const customConfig: GuidanceConfig = {
  ...defaultGuidanceConfig,
  displayDuration: 5000, // Show for 5 seconds instead of 3
  thresholds: {
    ...defaultGuidanceConfig.thresholds,
    sharpness: 150, // Stricter blur threshold
  },
};
```

### Production vs Test Mode

Set `showInProduction: false` to only show guidance in Test Mode:

```typescript
const config = {
  ...defaultGuidanceConfig,
  showInProduction: false, // Test Mode only
};
```

## Integration

The guidance system is integrated into `usePhotoRecognition` hook:

1. **Detection**: Frame quality checks detect issues
2. **Priority**: Highest priority issue selected
3. **Emission**: `activeGuidance` state updated
4. **Display**: `GuidanceMessage` component shows message
5. **Auto-dismiss**: Message hides after `displayDuration`
6. **Cooldown**: Won't show same message for `cooldownDuration`

## Telemetry

Recognition telemetry is tracked through `RecognitionTelemetry` counters in
`src/modules/photo-recognition/types.ts` and exported via app telemetry downloads.

## Future Enhancements

- Distance detection (requires edge detection or ML)
- Centering detection (requires photo boundary detection)
- Haptic feedback on mobile
- Audio cues for visually impaired users
- Adaptive thresholds based on user behavior
- Localization/i18n support

## References

- Runtime behavior: `docs/PHOTO_RECOGNITION_DEEP_DIVE.md`
- Component: `src/modules/photo-recognition/GuidanceMessage.tsx`
- Hook: `src/modules/photo-recognition/usePhotoRecognition.ts`
