# Debug Overlay Module

## Overview

The Debug Overlay module provides real-time debugging information for the photo recognition system. It displays recognition status, frame hashes, match information, and similarity scores to help troubleshoot and verify photo recognition functionality.

**Purpose**: Enable developers and testers to see what the photo recognition algorithm is doing in real-time.

## Key Features

✅ **Real-time Status Display**: Shows recognition state (IDLE/CHECKING/MATCHING/RECOGNIZED)
✅ **Frame Hash Visualization**: Displays the current frame's dHash value
✅ **Best Match Information**: Shows the closest matching concert and similarity score
✅ **Threshold Visualization**: Displays current threshold and required similarity percentage
✅ **Stability Countdown**: Visual progress bar and timer while waiting for confirmation
✅ **Metric Snapshot**: Frames processed, concerts evaluated, check interval, aspect ratio, frame size, last check timestamp
✅ **Test Mode Integration**: Only visible when Test Mode is enabled
✅ **Non-intrusive Design**: Positioned in bottom-right corner with semi-transparent background

## Usage

### In App.tsx

```tsx
import { DebugOverlay } from './modules/debug-overlay';

function App() {
  const { isEnabled } = useFeatureFlags();
  const { recognizedConcert, debugInfo } = usePhotoRecognition(stream, {
    enableDebugInfo: isEnabled('test-mode'),
  });

  return (
    <>
      {/* Other components */}
      <DebugOverlay
        enabled={isEnabled('test-mode')}
        recognizedConcert={recognizedConcert}
        isRecognizing={false}
        debugInfo={debugInfo}
      />
    </>
  );
}
```

## Component API

### Props

```typescript
interface DebugOverlayProps {
  /** Current recognized concert (if any) */
  recognizedConcert: Concert | null;

  /** Whether recognition is actively processing */
  isRecognizing: boolean;

  /** Whether debug overlay is enabled (Test Mode) */
  enabled: boolean;

  /** Optional override for similarity threshold */
  threshold?: number;

  /** Aggregated debug info from the recognition hook */
  debugInfo?: RecognitionDebugInfo | null;
}
```

## Visual Design

### Status Indicators

- ⚪ **IDLE**: No camera stream or not checking frames
- 🔵 **CHECKING**: Processing camera frames
- 🟡 **MATCHING**: Potential match found, waiting for stability
- 🟢 **RECOGNIZED**: Concert confirmed and recognized

### Information Displayed

1. **Status Section**: Current recognition state with animated indicator
2. **Frame Hash**: Truncated hash value (e.g., `a5b3c7...0486`) with time since last check
3. **Best Match**: Concert name with distance and similarity percentage
4. **Countdown**: Stability timer showing elapsed/remaining time plus progress bar
5. **Threshold**: Current threshold setting with required similarity
6. **Metrics**: Frames processed, concerts compared, check interval, aspect ratio, frame size, last check timestamp
7. **Recognized Concert**: Full concert details when recognized (highlighted in green)

## Styling

The overlay uses CSS Modules for scoped styling:

- **Position**: Fixed, bottom-right corner
- **Background**: Semi-transparent black with blur effect
- **Size**: 280-320px width, responsive
- **Z-index**: 9999 (always on top)
- **Mobile**: Responsive design, hides on very small screens (<400px)

## Integration with Photo Recognition

The debug overlay receives information from the `usePhotoRecognition` hook via the `debugInfo` return value:

```typescript
const { recognizedConcert, debugInfo } = usePhotoRecognition(stream, {
  enableDebugInfo: true, // Enable debug info output
});

// debugInfo contains:
// - lastFrameHash: Hash of the last processed frame
// - bestMatch: Best matching concert with distance and similarity
// - lastCheckTime: Timestamp of last frame check
// - concertCount: Number of concerts being checked
// - frameCount: Frames processed since start
// - checkInterval: Active frame sampling interval (ms)
// - aspectRatio & frameSize: Cropped viewport details
// - stability: Countdown info when a candidate is being confirmed
// - similarityThreshold & recognitionDelay: Active recognition tuning values

interface RecognitionDebugInfo {
  lastFrameHash: string | null;
  bestMatch: BestMatchInfo | null;
  lastCheckTime: number;
  concertCount: number;
  frameCount: number;
  checkInterval: number;
  aspectRatio: '3:2' | '2:3';
  frameSize: { width: number; height: number } | null;
  stability: {
    concert: Concert;
    elapsedMs: number;
    remainingMs: number;
    requiredMs: number;
    progress: number;
  } | null;
  similarityThreshold: number;
  recognitionDelay: number;
}
```

## Example Use Cases

### Testing Photo Recognition

1. Enable Test Mode via Secret Settings
2. Point camera at test images
3. Watch debug overlay update in real-time
4. Verify hash computation and matching

### Troubleshooting Recognition Issues

1. Check if frame hashes are being computed
2. Verify similarity scores are being calculated
3. Identify if threshold is too strict/lenient
4. See which concert is the closest match

### Verifying Test Data

1. Compare frame hashes with known photo hashes
2. Verify that test images produce expected matches
3. Check that similarity scores are reasonable

## Performance Considerations

- **Minimal Overhead**: Only renders when Test Mode is enabled
- **Efficient Updates**: Uses React state management, no excessive re-renders
- **No Performance Impact**: Does not affect photo recognition algorithm

## Accessibility

- Keyboard navigation supported
- Focus indicators visible
- Does not interfere with main UI interaction
- Can be dismissed by disabling Test Mode

## Files

- `DebugOverlay.tsx` - Main component
- `DebugOverlay.module.css` - Scoped styles
- `types.ts` - TypeScript interfaces
- `index.ts` - Public API exports
- `README.md` - This file

## Dependencies

- **Internal**: `../../types` (Concert type)
- **External**: React (hooks)

## Testing

Currently, the debug overlay does not have dedicated tests. It is tested manually by:

1. Enabling Test Mode
2. Verifying overlay appears
3. Checking that information updates correctly
4. Confirming it hides when Test Mode is disabled

## Future Enhancements

Potential improvements:

- [ ] Add collapsible/expandable sections
- [ ] Include frame rate and performance metrics
- [ ] Add copy-to-clipboard for debug info
- [ ] Show frame preview/thumbnail
- [ ] Add visual representation of hash comparison
- [ ] Include history of recent frames

## See Also

- [photo-recognition/README.md](../photo-recognition/README.md) - Photo recognition module
- [secret-settings/README.md](../secret-settings/README.md) - Feature flags and Test Mode
- [TEST_DATA_MODE_GUIDE.md](../../docs/TEST_DATA_MODE_GUIDE.md) - Test Mode user guide
