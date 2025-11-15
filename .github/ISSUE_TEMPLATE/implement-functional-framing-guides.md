---
name: Implement Functional Framing Guides with Dual Aspect Ratios
about: Make the framing guide functionally meaningful by cropping to framed region, and support both landscape (3:2) and portrait (2:3) photos
title: 'feat(photo-recognition): Implement functional framing with 3:2 and 2:3 aspect ratios'
labels: ['enhancement', 'photo-recognition', 'camera-view', 'ai-agent-ready']
assignees: ''
---

## Problem Statement

Currently, the camera view displays a 3:2 aspect ratio framing guide to help users align photos, but this framing is **purely cosmetic**. The photo recognition module analyzes the **entire camera frame**, not just the region inside the framing guide.

**Current Issues:**

1. ❌ Framing guide is misleading - recognition analyzes full frame, not framed region
2. ❌ Background elements, fingers, edges interfere with photo matching
3. ❌ Only supports landscape orientation (3:2), but photos can be portrait (2:3)
4. ❌ User carefully frames photo in the box, but recognition still sees everything
5. ❌ Reduced accuracy due to background noise and clutter

**Current Data Flow:**

```
Camera Stream → Full Video Frame → Full Canvas → Full ImageData → dHash Algorithm
                                                   ↑
                                    Analyzes ENTIRE frame (e.g., 1920×1080)
```

**Visual vs. Functional Mismatch:**

- User sees: "Point photo in this box"
- System does: Analyzes everything, including background

---

## Proposed Solution

Make the framing guide **functionally meaningful** by cropping the camera frame to only the region inside the framing box before computing the hash. Additionally, support both landscape and portrait orientations.

**New Data Flow:**

```
Camera Stream → Full Video Frame → Crop to Framed Region → dHash Algorithm
                                    ↑
                      Only analyzes pixels inside framing guide
                      (3:2 landscape OR 2:3 portrait)
```

**Key Changes:**

1. **Dual Aspect Ratio Support**: Allow switching between 3:2 (landscape) and 2:3 (portrait)
2. **Functional Cropping**: Only analyze pixels within the framed region
3. **Aspect Ratio Detection**: Auto-detect or allow manual toggle between orientations
4. **Improved Accuracy**: Reduce false positives by eliminating background noise

---

## Implementation Plan

### Phase 1: Add Aspect Ratio Switching to Camera View

**Module**: `src/modules/camera-view/`

**Changes Required:**

1. Add `aspectRatio` prop to `CameraView` component:

   ```typescript
   interface CameraViewProps {
     stream: MediaStream | null;
     error: string | null;
     hasPermission: boolean | null;
     onRetry?: () => void;
     aspectRatio?: '3:2' | '2:3'; // NEW: Default '3:2'
     onAspectRatioToggle?: () => void; // NEW: Optional toggle callback
   }
   ```

2. Update `CameraView.tsx` to render different overlay based on aspect ratio:

   ```typescript
   // Conditional rendering based on aspectRatio prop
   <div className={aspectRatio === '3:2' ? styles.overlayLandscape : styles.overlayPortrait}>
     {/* Corner markers */}
   </div>
   ```

3. Add toggle button (optional, can be in secret settings):

   ```typescript
   <button onClick={onAspectRatioToggle} className={styles.aspectToggle}>
     {aspectRatio === '3:2' ? '⤾ Portrait' : '⤿ Landscape'}
   </button>
   ```

4. Update `CameraView.module.css`:

   ```css
   /* Landscape (3:2) - existing */
   .overlayLandscape {
     aspect-ratio: 3 / 2;
     /* ... */
   }

   /* Portrait (2:3) - new */
   .overlayPortrait {
     aspect-ratio: 2 / 3;
     max-height: 80vh;
     max-width: calc(80vh * 2 / 3);
     /* ... */
   }
   ```

**Files to Modify:**

- `src/modules/camera-view/CameraView.tsx`
- `src/modules/camera-view/CameraView.module.css`
- `src/modules/camera-view/types.ts`
- `src/modules/camera-view/README.md` (update API contract)

---

### Phase 2: Implement Functional Cropping in Photo Recognition

**Module**: `src/modules/photo-recognition/`

**Changes Required:**

1. Add `aspectRatio` parameter to `usePhotoRecognition`:

   ```typescript
   export interface PhotoRecognitionOptions {
     recognitionDelay?: number;
     enabled?: boolean;
     similarityThreshold?: number;
     checkInterval?: number;
     enableDebugInfo?: boolean;
     aspectRatio?: '3:2' | '2:3'; // NEW: Default '3:2'
   }
   ```

2. Calculate framed region coordinates in `usePhotoRecognition.ts`:

   ```typescript
   /**
    * Calculate the framed region coordinates based on aspect ratio
    * @returns {x, y, width, height} coordinates for cropping
    */
   function calculateFramedRegion(
     videoWidth: number,
     videoHeight: number,
     aspectRatio: '3:2' | '2:3'
   ): { x: number; y: number; width: number; height: number } {
     const targetRatio = aspectRatio === '3:2' ? 3 / 2 : 2 / 3;
     const videoRatio = videoWidth / videoHeight;

     let frameWidth: number;
     let frameHeight: number;

     if (videoRatio > targetRatio) {
       // Video is wider than target - fit height, crop width
       frameHeight = videoHeight * 0.8; // 80% of viewport
       frameWidth = frameHeight * targetRatio;
     } else {
       // Video is taller than target - fit width, crop height
       frameWidth = videoWidth * 0.8;
       frameHeight = frameWidth / targetRatio;
     }

     const x = (videoWidth - frameWidth) / 2;
     const y = (videoHeight - frameHeight) / 2;

     return {
       x: Math.round(x),
       y: Math.round(y),
       width: Math.round(frameWidth),
       height: Math.round(frameHeight),
     };
   }
   ```

3. Modify frame extraction in `checkFrame()` function:

   ```typescript
   // OLD: Capture entire frame
   // canvas.width = video.videoWidth;
   // canvas.height = video.videoHeight;
   // ctx.drawImage(video, 0, 0);
   // const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

   // NEW: Capture only framed region
   const framedRegion = calculateFramedRegion(video.videoWidth, video.videoHeight, aspectRatio);

   canvas.width = framedRegion.width;
   canvas.height = framedRegion.height;

   ctx.drawImage(
     video,
     framedRegion.x,
     framedRegion.y,
     framedRegion.width,
     framedRegion.height,
     0,
     0,
     framedRegion.width,
     framedRegion.height
   );

   const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
   ```

4. Update debug logging to show cropped region:

   ```typescript
   if (import.meta.env.DEV || isTestMode) {
     console.log(`Frame Hash: ${currentHash}`);
     console.log(`Frame Size: ${canvas.width} × ${canvas.height} px`);
     console.log(`Cropped Region: x=${framedRegion.x}, y=${framedRegion.y}`);
     console.log(`Aspect Ratio: ${aspectRatio}`);
   }
   ```

**Files to Modify:**

- `src/modules/photo-recognition/usePhotoRecognition.ts`
- `src/modules/photo-recognition/types.ts`
- `src/modules/photo-recognition/README.md` (update API contract and usage)

---

### Phase 3: Wire Together in App.tsx

**Module**: `src/App.tsx`

**Changes Required:**

1. Add aspect ratio state:

   ```typescript
   const [aspectRatio, setAspectRatio] = useState<'3:2' | '2:3'>('3:2');
   ```

2. Pass to both modules:

   ```typescript
   // Camera View
   const cameraView = (
     <CameraView
       stream={stream}
       error={error}
       hasPermission={hasPermission}
       onRetry={retry}
       aspectRatio={aspectRatio}
       onAspectRatioToggle={() => setAspectRatio((prev) => (prev === '3:2' ? '2:3' : '3:2'))}
     />
   );

   // Photo Recognition
   const { recognizedConcert, reset: resetRecognition, debugInfo } = usePhotoRecognition(stream, {
     recognitionDelay: 3000,
     enableDebugInfo: isEnabled('test-mode'),
     aspectRatio: aspectRatio, // NEW
   });
   ```

3. Optional: Add aspect ratio toggle to secret settings or as a floating button

**Files to Modify:**

- `src/App.tsx`

---

### Phase 4: Update Documentation

**Files to Update:**

1. **ARCHITECTURE.md**: Explain how framing guide now functionally crops
2. **DOCUMENTATION_INDEX.md**: Add note about aspect ratio support
3. **Module READMEs**: Update camera-view and photo-recognition contracts
4. **README.md**: Mention dual aspect ratio support in features list

---

## Acceptance Criteria

- [ ] Camera view displays 3:2 framing guide by default (landscape)
- [ ] Camera view can switch to 2:3 framing guide (portrait)
- [ ] Framing guide toggle works (button or secret settings)
- [ ] Photo recognition only analyzes pixels **inside** the framing guide
- [ ] Cropping calculations are mathematically correct for both aspect ratios
- [ ] Debug overlay shows cropped region dimensions
- [ ] Debug logs display aspect ratio and crop coordinates
- [ ] All tests pass (camera-view, photo-recognition)
- [ ] No regression in recognition accuracy (should improve!)
- [ ] Documentation updated (READMEs, ARCHITECTURE.md)
- [ ] Type safety maintained (no `any` types)
- [ ] Code follows project style (ESLint, Prettier)

---

## Testing Checklist

### Manual Testing

- [ ] Test landscape photo (3:2) recognition with cropping
- [ ] Test portrait photo (2:3) recognition with cropping
- [ ] Toggle between aspect ratios and verify overlay updates
- [ ] Verify cropped region matches visual framing guide
- [ ] Test with background clutter - should ignore it now
- [ ] Test with fingers at edges - should not interfere
- [ ] Test different camera resolutions (480p, 720p, 1080p)
- [ ] Test on mobile devices (iOS Safari, Android Chrome)
- [ ] Test on desktop (Chrome, Firefox, Safari)

### Automated Testing

- [ ] Write tests for `calculateFramedRegion()` function:
  - Test 3:2 aspect ratio calculation
  - Test 2:3 aspect ratio calculation
  - Test with various video dimensions (16:9, 4:3, 1:1)
  - Test edge cases (very wide, very tall videos)
- [ ] Update `CameraView.test.tsx` to test aspect ratio prop
- [ ] Update `usePhotoRecognition.test.ts` to test cropping

### Visual Regression Testing

- [ ] Framing guide renders correctly in landscape mode
- [ ] Framing guide renders correctly in portrait mode
- [ ] Aspect ratio toggle button visible and functional
- [ ] Corner markers align with cropped region
- [ ] No layout shifts when switching aspect ratios

---

## Implementation Notes

### Design Decisions

1. **Default to Landscape (3:2)**:
   - Most concert photos are likely landscape
   - Maintains backward compatibility
   - User can switch if needed

2. **Centered Cropping**:
   - Crop region is centered in viewport
   - Matches user expectation (framing guide is centered)
   - Simplifies math

3. **80% of Viewport**:
   - Framing guide uses ~80% of available space
   - Leaves room for instructions and UI
   - Matches current CSS implementation

4. **Toggle Location Options**:
   - **Option A**: Floating button near camera view
   - **Option B**: Secret settings menu (requires triple-tap)
   - **Option C**: Auto-detect from photo dimensions (advanced)

   **Recommendation**: Start with Option A or B for simplicity.

### Performance Considerations

- **Cropping is Fast**: `drawImage()` with source rectangle is GPU-accelerated
- **Smaller Canvas**: Cropped region means less data to process
- **Should Improve Speed**: Less pixels → faster hash computation
- **No Extra Overhead**: Cropping happens in existing frame processing loop

### Edge Cases to Handle

1. **Very Wide Video** (e.g., 21:9):
   - Crop horizontally, fit height
   - Center the cropped region

2. **Very Tall Video** (e.g., 9:16):
   - Crop vertically, fit width
   - Center the cropped region

3. **Square Video** (e.g., 1:1):
   - Crop to either 3:2 or 2:3 based on selected aspect ratio
   - Center the cropped region

4. **Low Resolution**:
   - Ensure minimum canvas size (e.g., 300×200)
   - May need to scale up before hashing

---

## Code Quality Requirements

- [ ] **Type Safety**: All new functions and props are fully typed
- [ ] **No `any` Types**: Use proper TypeScript types throughout
- [ ] **ESLint Pass**: `npm run lint` passes with zero errors
- [ ] **Prettier Format**: `npm run format` applied to all files
- [ ] **Type Check**: `npm run type-check` passes
- [ ] **Build Success**: `npm run build` completes without errors
- [ ] **Tests Pass**: `npm run test:run` exits with code 0
- [ ] **No Console Errors**: No errors in browser console (only debug logs)

---

## Security Considerations

- **No New Permissions**: Uses existing camera access
- **No Data Leakage**: All processing remains client-side
- **No External Calls**: Cropping is pure canvas operation
- **Same Privacy Guarantees**: Still 100% offline recognition

---

## Documentation Updates Required

### Module READMEs

**`src/modules/camera-view/README.md`**:

````markdown
## Features

- Full viewport video display
- **3:2 aspect ratio guide overlay (landscape)**
- **2:3 aspect ratio guide overlay (portrait)**
- **Aspect ratio toggle support**
- Corner markers for alignment
- Instruction text
- Permission error handling

## API Contract

### Component: `CameraView`

**Input**:

\```typescript
{
stream: MediaStream | null;
error: string | null;
hasPermission: boolean | null;
onRetry?: () => void;
aspectRatio?: '3:2' | '2:3'; // NEW: Default '3:2'
onAspectRatioToggle?: () => void; // NEW: Toggle callback
}
\```
````

**`src/modules/photo-recognition/README.md`**:

````markdown
## Implementation: Functional Framing with Dual Aspect Ratios

The photo recognition module now **functionally crops** the camera frame to only analyze the region inside the framing guide. This eliminates background noise and improves accuracy.

### Cropping Behavior

- **3:2 Landscape**: Crops to 3:2 aspect ratio, centered in viewport
- **2:3 Portrait**: Crops to 2:3 aspect ratio, centered in viewport
- **80% Viewport**: Framed region uses ~80% of available space
- **GPU Accelerated**: Uses hardware-accelerated `drawImage()` cropping

### Configuration

\```typescript
export interface PhotoRecognitionOptions {
recognitionDelay?: number;
enabled?: boolean;
similarityThreshold?: number;
checkInterval?: number;
enableDebugInfo?: boolean;
aspectRatio?: '3:2' | '2:3'; // NEW: Default '3:2'
}
\```
````

### ARCHITECTURE.md

Add section about functional framing:

```markdown
## Functional Framing Guides

The camera view displays a framing guide to help users align photos. This guide is **functionally meaningful** - the photo recognition module only analyzes pixels within the framed region.

**Benefits**:

- ✅ Eliminates background noise and clutter
- ✅ Reduces false positives from unrelated objects
- ✅ Improves recognition accuracy
- ✅ Makes framing guide intuitive and trustworthy
- ✅ Supports both landscape (3:2) and portrait (2:3) photos

**Aspect Ratios**:

- **3:2 (Landscape)**: Default, for horizontal photos
- **2:3 (Portrait)**: For vertical photos
```

---

## Success Metrics

After implementation, measure:

1. **Recognition Accuracy**: Should increase by 5-10% (less background interference)
2. **False Positive Rate**: Should decrease (fewer accidental matches)
3. **User Satisfaction**: Framing guide now feels "correct" and trustworthy
4. **Performance**: Should be same or slightly faster (smaller canvas)

---

## References

- **Current Issue**: [Issue #XXX](link)
- **Photo Recognition Module**: `src/modules/photo-recognition/README.md`
- **Camera View Module**: `src/modules/camera-view/README.md`
- **dHash Algorithm**: `src/modules/photo-recognition/algorithms/dhash.ts`
- **Architecture Guide**: `ARCHITECTURE.md`

---

## AI Agent Guidelines

This issue is **AI agent-ready** and follows the project's modular architecture principles.

### Module Isolation

- ✅ Changes are isolated to 2 modules: `camera-view` and `photo-recognition`
- ✅ No coupling with other modules
- ✅ Clear contracts defined via TypeScript interfaces

### Development Workflow

1. **Read module READMEs first** to understand current contracts
2. **Make changes within module directories** only
3. **Update module READMEs** when contracts change
4. **Update DOCUMENTATION_INDEX.md** if files are added/removed
5. **Run quality checks** before committing:
   ```bash
   npm run lint:fix
   npm run format
   npm run type-check
   npm run test:run
   npm run build
   ```

### Testing Requirements

- Write unit tests for `calculateFramedRegion()` function
- Update existing tests for modified components
- Test manually with printed photos (both orientations)
- Verify debug overlay shows correct cropped dimensions

### Commit Messages

Use conventional commits format:

```
feat(photo-recognition): implement functional framing with dual aspect ratios
feat(camera-view): add aspect ratio toggle support (3:2 and 2:3)
test(photo-recognition): add tests for frame cropping calculations
docs(modules): update READMEs for functional framing
```

---

## Questions?

If you have questions about this implementation:

1. Check `ARCHITECTURE.md` for system design
2. Read module READMEs for API contracts
3. Review `AI_AGENT_GUIDE.md` for collaboration patterns
4. Check `CONTRIBUTING.md` for code quality standards

---

**Last Updated**: 2025-11-13
