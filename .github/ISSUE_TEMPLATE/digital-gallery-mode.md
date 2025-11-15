---
name: Digital Gallery Mode - Remote Experience via Blog
about: Enable remote users to experience Photo Signal by pointing camera at campmiles.com blog images
title: '[FEATURE]: Digital Gallery Mode - Support Photo Recognition from campmiles.com Blog'
labels: feature, photo-recognition, ux-enhancement, priority-medium
assignees: ''
---

## Feature Overview

Enable users to experience Photo Signal remotely by opening the app on their phone and pointing the camera at images displayed on the **campmiles.com** blog on their computer screen.

### User Story

**As a remote visitor** who cannot physically visit the gallery space,  
**I want to** point my phone's camera at concert photos displayed on campmiles.com,  
**So that** I can still experience the Photo Signal magic of music-triggered memories.

### Use Case

1. User opens **Photo Signal app** on their mobile phone
2. User opens **campmiles.com** on their computer (laptop/desktop)
3. User points phone camera at concert photo displayed on computer screen
4. Photo Signal **recognizes the digital image** (via photo hash matching)
5. Concert information appears and corresponding audio plays
6. User moves to next photo on blog, repeats the experience

**Key Benefit**: Democratizes the gallery experience - anyone can try it without needing printed photos or physical gallery access.

---

## Problem Statement

### Current State ❌

- Photo Signal is designed for **in-gallery use only** with printed photographs
- Remote users cannot experience the app without:
  - Visiting the physical gallery space
  - OR printing photos themselves (high barrier)
- This limits adoption and makes it hard to demo the app remotely

### Desired State ✅

- Users anywhere can experience Photo Signal by:
  1. Opening app on phone
  2. Visiting campmiles.com on computer
  3. Pointing phone at screen images
- **Same photo hashes** work for both physical prints AND digital screens
- **Same concert data** supports both use cases
- **Minimal code changes** - leverage existing photo recognition infrastructure

---

## Technical Background

### Why This Should Work

The **photo recognition module already uses perceptual hashing (dHash)**, which is designed to match images across different mediums:

- ✅ Same `photoHash` works for:
  - Printed photo on paper
  - Digital image on computer screen
  - Photo displayed on tablet/iPad
- ✅ dHash is **robust** to:
  - Screen brightness variations
  - Glare from screen (to some extent)
  - Different screen resolutions
  - Camera-to-screen distance

### What Already Exists

1. **Photo hashes** - All gallery photos already have computed `photoHash` values in `data.json`
2. **Blog images** - All photos on campmiles.com are the **same images** used in the gallery
3. **Recognition algorithm** - dHash implementation in `photo-recognition` module works with any camera input
4. **Concert data** - `dataService` already loads concert metadata

### What Needs to Change

**Minimal changes required**:

1. **Detection improvements** - Tune for screen display (brightness, contrast)
2. **User guidance** - Add UI hints for optimal camera-to-screen positioning
3. **Documentation** - Update guides to explain digital gallery mode
4. **Testing** - Verify recognition works reliably with various screen types

---

## Objectives

### Primary Goals

1. ✅ **Enable screen-based recognition** - Photo recognition works when camera points at computer screens
2. ✅ **Maintain compatibility** - Existing physical print recognition continues working
3. ✅ **Provide user guidance** - Clear instructions for optimal setup
4. ✅ **Document workflow** - Complete user guide for digital gallery mode

### Success Metrics

- **Recognition Accuracy**: ≥ 75% success rate when pointing at laptop/desktop screens
- **User Experience**: Clear instructions, smooth workflow
- **Compatibility**: Works on common screen types (LED, LCD, OLED, Retina)
- **Lighting**: Works in typical indoor lighting conditions

---

## Tasks

### Phase 1: Research & Testing 🔬

- [ ] **Test current recognition with screens**
  - [ ] Point phone camera at campmiles.com images on MacBook Pro screen
  - [ ] Test with external monitor (LED)
  - [ ] Test with different screen brightness levels (25%, 50%, 75%, 100%)
  - [ ] Test in various lighting conditions (bright room, dim room, natural light)
  - [ ] Document success/failure cases

- [ ] **Identify challenges**
  - [ ] Screen glare/reflections causing false negatives
  - [ ] Screen refresh rate interference (visible scan lines)
  - [ ] Moiré patterns from screen pixels
  - [ ] Color temperature differences (warm vs cool screens)
  - [ ] Auto-brightness adjustments on phone camera

- [ ] **Benchmark current performance**
  - [ ] Recognition success rate: X% (document baseline)
  - [ ] Time to recognition: Xs (document baseline)
  - [ ] False positive rate: X% (document baseline)
  - [ ] Document optimal camera-to-screen distance (inches)
  - [ ] Document optimal viewing angle (degrees)

### Phase 2: Algorithm Tuning (If Needed) ⚙️

**Note**: Only proceed if Phase 1 testing shows <75% success rate.

- [ ] **Analyze failure cases**
  - [ ] Review console logs from failed recognition attempts
  - [ ] Identify common patterns (e.g., always fails on OLED screens)
  - [ ] Determine if issue is brightness, contrast, or pattern-based

- [ ] **Tune photo recognition parameters**
  - [ ] Experiment with `similarityThreshold` (currently 10)
    - Try: 8, 12, 15 (stricter vs looser matching)
  - [ ] Adjust `recognitionDelay` (currently 3000ms)
    - May need longer delay for screen-based recognition
  - [ ] Test `checkInterval` optimization (currently 1000ms)

- [ ] **Add preprocessing for screen images** (optional)
  - [ ] **Brightness normalization** - Adjust frame brightness before hashing
  - [ ] **Contrast enhancement** - Increase contrast to reduce glare impact
  - [ ] **Deglare filter** - Detect and reduce specular highlights
  - [ ] Create `src/modules/photo-recognition/algorithms/screen-preprocessing.ts`
  - [ ] Add feature flag: `digital-gallery-mode` to toggle preprocessing

- [ ] **Test improvements**
  - [ ] Re-run benchmark tests from Phase 1
  - [ ] Document new success rate (target: ≥ 75%)
  - [ ] Verify physical print recognition still works (no regression)

### Phase 3: User Guidance & UI Enhancements 🎨

- [ ] **Add Digital Gallery Mode indicator**
  - [ ] Create toggle in Secret Settings menu (triple-tap)
  - [ ] Add to `featureFlagConfig.ts`:
    ```typescript
    {
      id: 'digital-gallery-mode',
      category: 'development',
      name: 'Digital Gallery Mode',
      description: 'Optimize photo recognition for pointing at computer screens',
      enabled: false
    }
    ```
  - [ ] When enabled, show indicator: "📺 Screen Mode Active"

- [ ] **Add on-screen setup guidance**
  - [ ] Create `DigitalGalleryGuide` component
  - [ ] Display when digital-gallery-mode is enabled
  - [ ] Show tips:
    - "Point camera at computer screen"
    - "Keep 12-18 inches from screen"
    - "Reduce screen brightness if glare occurs"
    - "Avoid harsh overhead lighting"
  - [ ] Auto-hide after 10 seconds (with "Show Tips" button to re-display)

- [ ] **Visual camera alignment guide**
  - [ ] Enhance existing 3:2 overlay with screen-specific hints
  - [ ] Add subtle border highlight when good alignment detected
  - [ ] Consider adding distance indicator (too close / too far / just right)

- [ ] **Styling**
  - [ ] Create `DigitalGalleryGuide.module.css`
  - [ ] Non-intrusive overlay (top or bottom)
  - [ ] Mobile-friendly, responsive design

### Phase 4: Documentation 📚

- [ ] **Create user guide**
  - [ ] New file: `docs/DIGITAL_GALLERY_MODE_GUIDE.md`
  - [ ] Sections:
    - Overview of Digital Gallery Mode
    - Required setup (phone + computer)
    - Step-by-step instructions with screenshots
    - Optimal positioning (distance, angle, lighting)
    - Troubleshooting common issues
    - Supported screen types
    - Tips for best experience

- [ ] **Update existing documentation**
  - [ ] **README.md**: Add "Digital Gallery Mode" section
  - [ ] **TEST_DATA_MODE_GUIDE.md**: Reference digital gallery mode for testing
  - [ ] **photo-recognition/README.md**: Document screen preprocessing (if added)
  - [ ] **DOCUMENTATION_INDEX.md**: Add link to new guide

- [ ] **Update campmiles.com blog** (external task)
  - [ ] Add banner: "Experience these photos with Photo Signal"
  - [ ] Link to Photo Signal app
  - [ ] Brief instructions for digital gallery mode
  - [ ] Note: This is an EXTERNAL task (blog is separate from this repo)

### Phase 5: Testing & Validation ✅

- [ ] **Cross-device testing**
  - [ ] Test with iPhone (11, 12, 13, 14, 15) pointing at:
    - MacBook Pro (Retina)
    - External monitor (Dell, LG, Samsung)
    - iPad Pro (if available)
  - [ ] Test with Android phone (Pixel, Samsung) pointing at:
    - Windows laptop
    - External monitor
  - [ ] Document device compatibility matrix

- [ ] **Lighting condition testing**
  - [ ] Bright room (overhead LED lights)
  - [ ] Dim room (lamp only)
  - [ ] Natural daylight (near window)
  - [ ] Mixed lighting
  - [ ] Evening/night (indoor lights only)

- [ ] **campmiles.com integration testing**
  - [ ] Open campmiles.com on laptop
  - [ ] Open Photo Signal on phone
  - [ ] Enable Digital Gallery Mode
  - [ ] Point at each photo on blog
  - [ ] Verify recognition triggers correctly
  - [ ] Verify audio plays
  - [ ] Verify concert info displays

- [ ] **Quality checks**

  ```bash
  npm run lint:fix
  npm run format
  npm run type-check
  npm run test:run
  npm run build
  ```

- [ ] **User acceptance testing**
  - [ ] Recruit 3-5 users unfamiliar with Photo Signal
  - [ ] Have them follow DIGITAL_GALLERY_MODE_GUIDE.md
  - [ ] Observe pain points, confusion, success rate
  - [ ] Iterate on guidance/UI based on feedback

---

## Acceptance Criteria

### Core Functionality ✅

- [ ] Photo recognition works when pointing at computer screen displaying campmiles.com photos
- [ ] Recognition success rate ≥ 75% across common screen types (LED, LCD, Retina)
- [ ] Physical print recognition continues working (no regression)
- [ ] Works on at least 3 different screen types (MacBook, external monitor, iPad)
- [ ] Works in typical indoor lighting conditions

### User Experience ✅

- [ ] Digital Gallery Mode can be toggled via Secret Settings
- [ ] Clear on-screen guidance when mode is enabled
- [ ] Setup instructions are easy to follow
- [ ] Recognition happens within 3-5 seconds on average
- [ ] Audio playback and concert info display work identically to physical mode

### Documentation ✅

- [ ] Complete user guide: `docs/DIGITAL_GALLERY_MODE_GUIDE.md`
- [ ] README.md updated with Digital Gallery Mode overview
- [ ] photo-recognition module README documents any algorithm changes
- [ ] DOCUMENTATION_INDEX.md includes new guide
- [ ] Troubleshooting section addresses common screen-related issues

### Code Quality ✅

- [ ] All quality checks pass (lint, format, type-check, test, build)
- [ ] Feature flag added for digital-gallery-mode
- [ ] TypeScript types updated if new interfaces added
- [ ] CSS Modules used for any new components
- [ ] Code follows architecture principles (module isolation)
- [ ] Bundle size remains under 150KB

### Testing ✅

- [ ] Tested on minimum 2 phone models (iPhone + Android)
- [ ] Tested on minimum 3 screen types
- [ ] Tested in minimum 3 lighting conditions
- [ ] Manual testing confirms ≥ 75% success rate
- [ ] User acceptance testing completed (3+ users)

---

## Files to Create

### New Files

- `docs/DIGITAL_GALLERY_MODE_GUIDE.md` - User guide for digital gallery mode
- `src/modules/photo-recognition/algorithms/screen-preprocessing.ts` - (Optional) Screen image preprocessing
- `src/components/DigitalGalleryGuide.tsx` - (Optional) Setup guidance component
- `src/components/DigitalGalleryGuide.module.css` - (Optional) Guide styling

**Alternative Structure** (if creating module):

- `src/modules/digital-gallery-guide/DigitalGalleryGuide.tsx`
- `src/modules/digital-gallery-guide/DigitalGalleryGuide.module.css`
- `src/modules/digital-gallery-guide/types.ts`
- `src/modules/digital-gallery-guide/index.ts`
- `src/modules/digital-gallery-guide/README.md`

---

## Files to Modify

### Configuration

- `src/modules/secret-settings/featureFlagConfig.ts` - Add `digital-gallery-mode` feature flag

### Code (if preprocessing needed)

- `src/modules/photo-recognition/usePhotoRecognition.ts` - Integrate screen preprocessing
- `src/modules/photo-recognition/algorithms/utils.ts` - Add brightness/contrast helpers
- `src/App.tsx` - Add DigitalGalleryGuide component (conditional)

### Documentation

- `README.md` - Add Digital Gallery Mode section
- `docs/TEST_DATA_MODE_GUIDE.md` - Reference digital mode for testing
- `src/modules/photo-recognition/README.md` - Document screen-specific features
- `DOCUMENTATION_INDEX.md` - Add link to new guide

### Tests (if applicable)

- `src/modules/photo-recognition/algorithms/__tests__/screen-preprocessing.test.ts` - (Optional) Test preprocessing
- Update existing tests if algorithm behavior changes

---

## Technical Implementation Details

### 1. Feature Flag Configuration

```typescript
// src/modules/secret-settings/featureFlagConfig.ts

export const featureFlagConfig: FeatureFlagDefinition[] = [
  // ... existing flags ...
  {
    id: 'digital-gallery-mode',
    category: 'development',
    name: 'Digital Gallery Mode',
    description: 'Optimize photo recognition for computer screens (campmiles.com)',
    enabled: false,
  },
];
```

### 2. Screen Preprocessing (Optional)

**Only implement if Phase 1 testing shows <75% success rate.**

```typescript
// src/modules/photo-recognition/algorithms/screen-preprocessing.ts

/**
 * Preprocess camera frame for better screen recognition
 * Reduces glare, normalizes brightness, enhances contrast
 */
export function preprocessScreenImage(imageData: ImageData): ImageData {
  // 1. Normalize brightness (target midpoint)
  const normalized = normalizeBrightness(imageData, 0.5);

  // 2. Enhance contrast (reduce glare impact)
  const enhanced = enhanceContrast(normalized, 1.2);

  // 3. Reduce specular highlights (screen glare)
  const deglared = reduceGlare(enhanced);

  return deglared;
}

function normalizeBrightness(imageData: ImageData, target: number): ImageData {
  // Implementation: Calculate average brightness, adjust to target
  // ...
}

function enhanceContrast(imageData: ImageData, factor: number): ImageData {
  // Implementation: Apply contrast curve
  // ...
}

function reduceGlare(imageData: ImageData): ImageData {
  // Implementation: Detect and reduce bright spots
  // ...
}
```

### 3. Integration with Photo Recognition

```typescript
// src/modules/photo-recognition/usePhotoRecognition.ts

import { preprocessScreenImage } from './algorithms/screen-preprocessing';
import { useFeatureFlags } from '../secret-settings';

export function usePhotoRecognition(stream, options) {
  const { isEnabled } = useFeatureFlags();
  const isDigitalMode = isEnabled('digital-gallery-mode');

  // Inside recognition loop:
  const processFrame = () => {
    let imageData = getFrameFromStream(stream);

    // Apply preprocessing if digital mode enabled
    if (isDigitalMode) {
      imageData = preprocessScreenImage(imageData);
    }

    const hash = computeDHash(imageData);
    // ... rest of recognition logic
  };
}
```

### 4. User Guidance Component

```typescript
// src/components/DigitalGalleryGuide.tsx

import { useState, useEffect } from 'react';
import styles from './DigitalGalleryGuide.module.css';

interface DigitalGalleryGuideProps {
  enabled: boolean;
}

export function DigitalGalleryGuide({ enabled }: DigitalGalleryGuideProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (enabled) {
      setIsVisible(true);
      // Auto-hide after 10 seconds
      const timer = setTimeout(() => setIsVisible(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [enabled]);

  if (!enabled || !isVisible) return null;

  return (
    <div className={styles.guide}>
      <div className={styles.header}>
        <span className={styles.icon}>📺</span>
        <h3>Digital Gallery Mode</h3>
      </div>
      <ul className={styles.tips}>
        <li>Point camera at concert photo on your computer screen</li>
        <li>Keep 12-18 inches from the screen</li>
        <li>Reduce screen brightness if you see glare</li>
        <li>Avoid harsh overhead lighting</li>
      </ul>
      <button onClick={() => setIsVisible(false)} className={styles.close}>
        Got it
      </button>
    </div>
  );
}
```

---

## Dependencies

### Blocked By

None - This can be implemented independently.

### Nice to Have (Not Blocking)

- Completion of "Fix Test Mode Photo Recognition" issue would provide better debugging tools
- Completion of "Refactor Feature Flags" issue would simplify feature flag management

### External Dependencies

- **campmiles.com blog** must be accessible with concert photos
- Photos on blog must match photos used in production `data.json`
- Blog photos must be high enough resolution for recognition (recommend ≥ 800px width)

---

## Estimated Effort

**Total: 12-16 hours** (depends on whether preprocessing is needed)

### Fast Track (No Preprocessing Needed): 8-10 hours

If Phase 1 testing shows ≥ 75% success rate with existing algorithm:

- Phase 1 (Research & Testing): 2-3 hours
- Phase 3 (UI Guidance): 2-3 hours
- Phase 4 (Documentation): 2-3 hours
- Phase 5 (Testing & Validation): 2 hours

### Full Implementation (Preprocessing Required): 12-16 hours

If Phase 1 testing shows <75% success rate and preprocessing is needed:

- Phase 1 (Research & Testing): 2-3 hours
- Phase 2 (Algorithm Tuning): 4-6 hours
  - Analysis: 1 hour
  - Preprocessing implementation: 2-3 hours
  - Testing and tuning: 1-2 hours
- Phase 3 (UI Guidance): 2-3 hours
- Phase 4 (Documentation): 2-3 hours
- Phase 5 (Testing & Validation): 2 hours

### Breakdown by Task Type

- Research & Testing: 2-3 hours
- Algorithm Work: 0-6 hours (conditional)
- UI Implementation: 2-3 hours
- Documentation: 2-3 hours
- Validation: 2 hours
- Buffer for iteration: 2 hours

---

## Risks & Mitigation

### Risk 1: Screen Recognition Unreliable

**Risk**: Photo recognition may not work consistently with computer screens due to:

- Screen glare/reflections
- Pixel patterns causing moiré
- Color temperature variations
- Refresh rate interference

**Likelihood**: Medium  
**Impact**: High (feature won't work)

**Mitigation**:

1. **Phase 1 testing identifies issues early** - Can pivot if needed
2. **Preprocessing algorithms** can handle most issues
3. **User guidance** can steer users toward optimal setups
4. **Feature flag** allows disabling if unworkable

**Fallback**: If success rate stays <50% despite tuning, document as "experimental feature" and guide users to print photos instead.

### Risk 2: Performance Impact

**Risk**: Screen preprocessing (if needed) may slow down recognition or increase CPU usage.

**Likelihood**: Low (preprocessing is lightweight)  
**Impact**: Medium (laggy UX)

**Mitigation**:

1. Keep preprocessing simple (brightness/contrast only, no heavy filters)
2. Profile performance before/after
3. Only apply preprocessing when digital-gallery-mode flag is enabled
4. Test on older mobile devices (iPhone 11, Pixel 5)

**Threshold**: If preprocessing adds >100ms per frame, reconsider or optimize.

### Risk 3: User Confusion

**Risk**: Users may not understand how to set up phone + computer for digital mode.

**Likelihood**: Medium  
**Impact**: Low (users can ask for help)

**Mitigation**:

1. **Clear documentation** with step-by-step instructions and screenshots
2. **On-screen guidance** when mode is enabled
3. **User acceptance testing** to catch confusion early
4. **Video tutorial** (future enhancement) showing setup process

### Risk 4: Blog Compatibility

**Risk**: Blog layout changes or photo quality on campmiles.com may break recognition.

**Likelihood**: Low  
**Impact**: Medium

**Mitigation**:

1. Document recommended photo resolution for blog (≥ 800px width)
2. Add note in blog admin guide about Photo Signal compatibility
3. Test recognition when blog is updated
4. Feature is not mission-critical (physical gallery is primary use case)

---

## Success Indicators

When complete, users should be able to:

1. ✅ Enable Digital Gallery Mode via Secret Settings (triple-tap)
2. ✅ See on-screen guidance for optimal setup
3. ✅ Open campmiles.com on computer
4. ✅ Point phone camera at blog photos
5. ✅ Experience photo recognition and audio playback (≥ 75% success rate)
6. ✅ Follow troubleshooting guide if recognition fails

When complete, developers should be able to:

1. ✅ Understand how digital mode differs from physical mode
2. ✅ Toggle feature on/off for testing
3. ✅ Debug recognition issues with existing tools
4. ✅ Extend preprocessing if needed in future

---

## Future Enhancements

**Post-MVP Ideas**:

- [ ] **Auto-detection of screen vs print** - Automatically enable digital mode when screen detected
- [ ] **QR code pairing** - Scan QR on blog to auto-enable digital mode
- [ ] **Video tutorial** - Embedded walkthrough video in guide
- [ ] **Analytics** - Track digital mode usage, success rates (privacy-respecting)
- [ ] **Tablet mode** - Optimize for pointing at iPad/tablet instead of laptop
- [ ] **Projection mode** - Support recognition from projected images (conferences, exhibitions)

---

## References

- [photo-recognition/README.md](../../src/modules/photo-recognition/README.md) - Photo recognition module documentation
- [photo-recognition-research.md](../../docs/photo-recognition-research.md) - dHash algorithm research
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - Module structure and isolation principles
- [AI_AGENT_GUIDE.md](../../AI_AGENT_GUIDE.md) - AI agent collaboration patterns
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Code quality standards and testing requirements
- [secret-settings/DEVELOPER_GUIDE.md](../../src/modules/secret-settings/DEVELOPER_GUIDE.md) - Adding feature flags

**External**:

- campmiles.com - Digital gallery blog (external site)
- dHash Algorithm: http://www.hackerfactor.com/blog/index.php?/archives/529-Kind-of-Like-That.html

---

## Notes for AI Agents

### Implementation Strategy

**Recommended Approach: Test-First, Tune-If-Needed**

1. **Start with Phase 1 testing** - Validate if existing algorithm works
2. **Document findings** - Share baseline metrics in issue comments
3. **Skip Phase 2 if possible** - Only add preprocessing if success rate is <75%
4. **Focus on UX** - User guidance may be more valuable than algorithm tuning
5. **Iterate based on feedback** - Real user testing reveals true pain points

### Code Quality Requirements

- ✅ **Module isolation**: New components should be self-contained
- ✅ **Feature flag pattern**: Follow existing feature flag structure
- ✅ **TypeScript strict**: No `any` types, proper interfaces
- ✅ **CSS Modules**: Scoped styles for components
- ✅ **Mobile-first**: Test on actual mobile devices
- ✅ **Performance**: Profile before/after any preprocessing

### Testing Requirements

- ✅ **Cross-device testing** is CRITICAL - Test on real phones and screens
- ✅ **Document all findings** - Success rates, failure modes, optimal setups
- ✅ **User acceptance testing** - Recruit real users unfamiliar with app
- ✅ **Regression testing** - Verify physical print recognition still works

### Documentation Requirements

- ✅ **User guide must have screenshots** - Visual aids are essential
- ✅ **Troubleshooting section** - Address common failure modes
- ✅ **Update DOCUMENTATION_INDEX.md** - Link to new guide
- ✅ **Code comments** - Explain any preprocessing algorithms

---

## Questions to Consider

### For Implementation

- **Should digital mode be default or opt-in?** (Recommend: opt-in via feature flag)
- **Should on-screen guidance be persistent or auto-hide?** (Recommend: auto-hide with "Show Tips" button)
- **Should preprocessing be always-on or conditional?** (Recommend: only when feature flag enabled)
- **Should we optimize for laptop screens or tablet screens first?** (Recommend: laptops, more common)

### For User Experience

- **What's the optimal camera-to-screen distance?** (Determine in Phase 1 testing)
- **Should we show a success indicator when alignment is good?** (Nice to have)
- **Should we warn users about glare/reflections in real-time?** (Future enhancement)
- **Should we provide a printable checklist for setup?** (Maybe in docs)

### For Compatibility

- **Which screen types should we prioritize?** (Laptops > external monitors > tablets)
- **Should we support dark mode blog pages?** (Test both light and dark)
- **What minimum screen resolution should we recommend?** (≥ 800px photo width)

---

**Priority**: MEDIUM - Expands accessibility but not core functionality

**Impact**: HIGH - Democratizes the experience, enables remote participation

**Complexity**: MEDIUM - Depends on whether preprocessing is needed

**Risk**: MEDIUM - May not work reliably on all screen types, but has good fallback (print photos)

---

_Last Updated: 2025-11-13_
