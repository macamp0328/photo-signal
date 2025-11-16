---
name: Fix Test Mode Photo Recognition
about: Fix Test Mode to enable photo recognition with test-images and add debug logging
title: '[BUG]: Test Mode Missing Photo Hashes - Cannot Recognize Test Images'
labels: bug, priority-high, feature-flags, photo-recognition, testing
assignees: ''
---

## Problem Statement

**Test Mode is currently non-functional for its primary purpose**: enabling users to point the camera at printed test images and have them recognized and trigger audio playback.

The issue is that the test data in `assets/test-data/concerts.json` **does NOT include `photoHashes` (and legacy `photoHash`) values**, which are required by the photo recognition module to match camera frames to concert photos and enable runtime algorithm switching.

### Current State vs. Expected State

**Current State** ❌:

```json
{
  "id": 1,
  "band": "The Midnight Echoes",
  "venue": "The Fillmore",
  "date": "2023-08-15",
  "audioFile": "/assets/test-audio/concert-1.mp3",
  "imageFile": "/assets/test-images/concert-1.jpg"
  // ❌ NO photoHashes/photoHash fields!
}
```

**Expected State** ✅:

```json
{
  "id": 1,
  "band": "The Midnight Echoes",
  "venue": "The Fillmore",
  "date": "2023-08-15",
  "audioFile": "/assets/test-audio/concert-1.mp3",
  "imageFile": "/assets/test-images/concert-1.jpg",
  "photoHashes": {
    "phash": ["9853660d98d36f26", "98d2662d98d26f26", "98f2662c98d26f26"],
    "dhash": [
      "00000000000001600acc000000000000",
      "00000000000001600acc000000000000",
      "00000000000001600acc000000000000"
    ]
  },
  "photoHash": ["9853660d98d36f26", "98d2662d98d26f26", "98f2662c98d26f26"] // ✅ Legacy mirror for older builds
}
```

### What Breaks Without Photo Hashes

When Test Mode is enabled:

1. ✅ Data service correctly loads test concert data
2. ✅ Camera access works
3. ✅ Motion detection works
4. ❌ **Photo recognition SILENTLY FAILS** - skips concerts without `photoHashes`
5. ❌ User points camera at test images but **nothing happens**
6. ❌ No clear indication to user WHY it's not working

### User's Vision for Test Mode

Test Mode should provide a **quick and easy way to manually verify the core functionality** is working:

1. Enable Test Mode via Secret Settings (triple-tap)
2. Print the 4 test images from `assets/test-images/`
3. Point camera at each printed photo
4. **See the photo recognized** and corresponding audio play
5. **See on-screen debug information** showing recognition happening
6. **See detailed logging in console** for troubleshooting

**This should be the PRIMARY use case for Test Mode** - enabling rapid manual testing of the complete workflow.

---

## Objective

Fix Test Mode to fully enable photo recognition with test images and add comprehensive debugging information.

### Goals

1. ✅ **Generate photo hashes** for all 4 test images
2. ✅ **Add hashes to test data** in `assets/test-data/concerts.json`
3. ✅ **Add on-screen debug UI** showing recognition state
4. ✅ **Add detailed console logging** for troubleshooting
5. ✅ **Update TEST_DATA_MODE_GUIDE.md** with hash generation process
6. ✅ **Create hash generation utility** for future test images

---

## Tasks

### Phase 1: Generate Photo Hashes ⚙️

- [ ] **Create hash generation script**
  - [ ] Create `scripts/generate-photo-hashes.ts` (or `.js`)
  - [ ] Load each image from `assets/test-images/`
  - [ ] Use existing `computeDHash()` from `photo-recognition/algorithms/dhash.ts`
  - [ ] Output hashes in JSON format for easy copy-paste
  - [ ] Add to `scripts/README.md`

- [ ] **Generate hashes for all 4 test images**
  - [ ] Run script on `concert-1.jpg` → `hash1`
  - [ ] Run script on `concert-2.jpg` → `hash2`
  - [ ] Run script on `concert-3.jpg` → `hash3`
  - [ ] Run script on `concert-4.jpg` → `hash4`
  - [ ] Document hashes in issue comment for review

- [ ] **Update test data with hashes**
  - [ ] Add `photoHashes` (with `phash` + `dhash`) and legacy `photoHash` arrays to all 4 concerts in `assets/test-data/concerts.json`
  - [ ] Verify JSON is valid
  - [ ] Commit changes

### Phase 2: Add Debug UI (On-Screen Information) 🖥️

Create a new debug overlay component that shows when Test Mode is active:

- [ ] **Create `DebugOverlay` component**
  - [ ] Location: `src/modules/debug-overlay/DebugOverlay.tsx`
  - [ ] Only renders when Test Mode is enabled
  - [ ] Semi-transparent overlay in corner (non-intrusive)
  - [ ] Shows real-time recognition state

- [ ] **Display recognition information**
  - [ ] Current recognition status: `IDLE` | `CHECKING` | `MATCHING` | `RECOGNIZED`
  - [ ] Last computed frame hash (truncated, e.g., `a5b3...0486`)
  - [ ] Best match concert name (if any)
  - [ ] Best match distance and similarity percentage
  - [ ] Threshold setting (current `similarityThreshold` value)
  - [ ] Time since last frame check

- [ ] **Visual indicators**
  - [ ] 🔴 Red: No match
  - [ ] 🟡 Yellow: Potential match (below threshold)
  - [ ] 🟢 Green: Confirmed match
  - [ ] Pulse animation when checking frames

- [ ] **Styling**
  - [ ] Create `DebugOverlay.module.css`
  - [ ] Position: bottom-right corner
  - [ ] Font: monospace for hashes
  - [ ] Opacity: 0.8 background
  - [ ] Responsive: hide on very small screens

- [ ] **Integration**
  - [ ] Import in `App.tsx`
  - [ ] Pass `recognizedConcert`, `isRecognizing`, `stream` as props
  - [ ] Only render when `isTestMode === true`

### Phase 3: Enhanced Console Logging 📝

Upgrade logging in `photo-recognition` module:

- [ ] **Enhance existing dev logs**
  - [ ] Currently logs: frame hash, similarity scores, match events
  - [ ] Add: timestamp, frame number, threshold value
  - [ ] Add: visual separators (e.g., `=== FRAME 42 ===`)
  - [ ] Add: color coding if possible (via `console` styling)

- [ ] **Add new Test Mode specific logs**
  - [ ] When Test Mode activates: log loaded concert count and hashes
  - [ ] When camera initializes: log video dimensions, FPS target
  - [ ] When recognition starts: log all configuration options
  - [ ] When threshold is crossed: log **why** it matched or didn't

- [ ] **Create log format examples**
  - [ ] Document expected log output in PR description
  - [ ] Include "successful recognition" example
  - [ ] Include "no match" example
  - [ ] Include "partial match" example

### Phase 4: Documentation Updates 📚

- [ ] **Update TEST_DATA_MODE_GUIDE.md**
  - [ ] Add section: "How Photo Hashes Are Generated"
  - [ ] Document hash generation script usage
  - [ ] Add troubleshooting: "Photo Not Recognized" section
  - [ ] Add screenshots of debug overlay (if possible)
  - [ ] Update "What Should Work" section with debug UI mention

- [ ] **Update photo-recognition README.md**
  - [ ] Add section: "Generating Photo Hashes"
  - [ ] Link to hash generation script
  - [ ] Document hash format (16 hex chars, dHash algorithm)
  - [ ] Add note about Test Mode debug UI

- [ ] **Update DOCUMENTATION_INDEX.md**
  - [ ] Add entry for `scripts/generate-photo-hashes.ts`
  - [ ] Add entry for `debug-overlay/DebugOverlay.tsx` (if new module)

- [ ] **Create hash generation README**
  - [ ] Document in `scripts/README.md`
  - [ ] Usage: `npm run generate-hashes`
  - [ ] Output format explanation

### Phase 5: Testing & Validation ✅

- [ ] **Manual testing with printed photos**
  - [ ] Print all 4 test images (4x6" or larger)
  - [ ] Enable Test Mode (triple-tap)
  - [ ] Point camera at each photo in good lighting
  - [ ] Verify debug overlay shows recognition
  - [ ] Verify console logs show matching process
  - [ ] Verify audio plays on recognition
  - [ ] Test in various lighting conditions (bright, dim, mixed)
  - [ ] Test at various distances (6", 12", 24")

- [ ] **Test hash generation script**
  - [ ] Run script on all test images
  - [ ] Verify hashes are consistent (same hash for same image)
  - [ ] Verify hash format (16 hex characters)
  - [ ] Try with a new test image (if available)

- [ ] **Run quality checks**

  ```bash
  npm run lint:fix
  npm run format
  npm run type-check
  npm run test:run
  npm run build
  ```

- [ ] **Test debug UI**
  - [ ] Verify overlay only shows in Test Mode
  - [ ] Verify overlay updates in real-time
  - [ ] Verify styling doesn't break on mobile
  - [ ] Verify overlay doesn't block camera view

---

## Acceptance Criteria

### Core Functionality ✅

- [ ] All 4 test images have `photoHashes` (`phash` + `dhash`) and legacy `photoHash` mirrors in `assets/test-data/concerts.json`
- [ ] Pointing camera at printed test images triggers recognition (with hash match)
- [ ] Audio plays when test photo is recognized
- [ ] Photo recognition works in Test Mode at ≥80% success rate in good lighting

### Debug UI ✅

- [ ] Debug overlay appears ONLY when Test Mode is enabled
- [ ] Overlay shows:
  - [ ] Current recognition status
  - [ ] Last frame hash
  - [ ] Best match concert name
  - [ ] Similarity percentage
  - [ ] Visual indicators (red/yellow/green)
- [ ] Overlay is positioned bottom-right, semi-transparent
- [ ] Overlay doesn't interfere with camera view or main UI

### Logging ✅

- [ ] Console logs show:
  - [ ] Frame-by-frame hash computation
  - [ ] Similarity scores for each concert
  - [ ] Match/no-match decisions with reasons
  - [ ] Timestamps and frame numbers
- [ ] Logs are clear, readable, and helpful for debugging
- [ ] Logs only appear in development mode OR when Test Mode is active

### Documentation ✅

- [ ] TEST_DATA_MODE_GUIDE.md updated with:
  - [ ] Photo hash generation explanation
  - [ ] Debug UI usage guide
  - [ ] Troubleshooting steps
- [ ] photo-recognition README.md documents hash generation
- [ ] DOCUMENTATION_INDEX.md updated with new files
- [ ] Hash generation script documented in scripts/README.md

### Testing ✅

- [ ] All quality checks pass (lint, format, type-check, test, build)
- [ ] Manual testing confirms photo recognition works
- [ ] Hash generation script tested and working
- [ ] No TypeScript errors
- [ ] Bundle size within limits (currently ~140KB, keep under 150KB)

---

## Files to Create

**New Files**:

- `scripts/generate-photo-hashes.ts` (or `.js`) - Hash generation utility
- `src/modules/debug-overlay/DebugOverlay.tsx` - Debug UI component
- `src/modules/debug-overlay/DebugOverlay.module.css` - Debug UI styles
- `src/modules/debug-overlay/types.ts` - TypeScript interfaces
- `src/modules/debug-overlay/index.ts` - Public exports
- `src/modules/debug-overlay/README.md` - Module documentation

**Alternative**: Instead of new module, could add debug component to `photo-recognition` module:

- `src/modules/photo-recognition/DebugOverlay.tsx`
- `src/modules/photo-recognition/DebugOverlay.module.css`

Choose the approach that best fits the architecture (see ARCHITECTURE.md).

---

## Files to Modify

**Data**:

- `assets/test-data/concerts.json` - Add `photoHashes` (and `photoHash` mirrors) to all 4 concerts

**Code**:

- `src/App.tsx` - Add `DebugOverlay` component (conditional on Test Mode)
- `src/modules/photo-recognition/usePhotoRecognition.ts` - Enhance logging
- `package.json` - Add npm script for hash generation (optional)

**Documentation**:

- `docs/TEST_DATA_MODE_GUIDE.md` - Add hash generation and debug UI sections
- `src/modules/photo-recognition/README.md` - Document hash generation
- `DOCUMENTATION_INDEX.md` - Add new files
- `scripts/README.md` - Document hash generation script

**Tests** (if applicable):

- `src/modules/debug-overlay/DebugOverlay.test.tsx` - Unit tests for debug UI
- `src/modules/photo-recognition/usePhotoRecognition.test.ts` - Update if needed

---

## Technical Implementation Details

### 1. Hash Generation Script

**Approach Options**:

**Option A: Node.js script with canvas-based image loading**

```typescript
// scripts/generate-photo-hashes.ts
import { createCanvas, loadImage } from 'canvas'; // npm install canvas
import { computeDHash } from '../src/modules/photo-recognition/algorithms/dhash';
import * as fs from 'fs';
import * as path from 'path';

async function generateHashes() {
  const testImagesDir = path.join(__dirname, '../assets/test-images');
  const images = ['concert-1.jpg', 'concert-2.jpg', 'concert-3.jpg', 'concert-4.jpg'];

  const hashes = [];

  for (const imageName of images) {
    const imagePath = path.join(testImagesDir, imageName);
    const image = await loadImage(imagePath);

    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hash = computeDHash(imageData);

    hashes.push({
      file: imageName,
      hash: hash,
    });

    console.log(`${imageName}: ${hash}`);
  }

  // Output JSON for easy copy-paste
  console.log('\nJSON Output:');
  console.log(JSON.stringify(hashes, null, 2));
}

generateHashes().catch(console.error);
```

**Option B: Browser-based tool (simpler, no dependencies)**

- Create HTML page in `scripts/hash-generator.html`
- Drag-and-drop images to compute hashes
- Use FileReader API to load images
- Display hashes in UI for copy-paste

**Recommendation**: Start with **Option B** (browser-based) for simplicity and zero dependencies. Can upgrade to Option A later if automation is needed.

### 2. Debug Overlay Component Structure

```typescript
// src/modules/debug-overlay/DebugOverlay.tsx
interface DebugOverlayProps {
  recognizedConcert: Concert | null;
  isRecognizing: boolean;
  enabled: boolean; // Test Mode flag
  lastFrameHash?: string;
  bestMatch?: {
    concert: Concert;
    distance: number;
    similarity: number;
  };
  threshold: number;
}

export function DebugOverlay({ ... }: DebugOverlayProps) {
  if (!enabled) return null;

  // Render debug information
  return (
    <div className={styles.overlay}>
      <div className={styles.status}>
        {/* Status indicator */}
      </div>
      <div className={styles.info}>
        {/* Hash, match info, etc. */}
      </div>
    </div>
  );
}
```

### 3. Enhanced Logging Format

```typescript
// Example output in console:
=== FRAME 42 @ 12:34:56.789 ===
Frame Hash: a5b3c7d9e1f20486
Concerts Checked: 4
Threshold: 10 (similarity ≥ 84%)

Results:
  ✓ The Midnight Echoes: distance=6, similarity=90.6% ← BEST MATCH
  ✗ Electric Dreams: distance=24, similarity=62.5%
  ✗ Velvet Revolution: distance=31, similarity=51.6%
  ✗ Sunset Boulevard: distance=28, similarity=56.3%

Match Decision: POTENTIAL MATCH (The Midnight Echoes)
Stability Timer: 1.2s / 3.0s required
```

### 4. Data Structure Update

Before:

```json
{
  "concerts": [
    {
      "id": 1,
      "band": "The Midnight Echoes",
      "venue": "The Fillmore",
      "date": "2023-08-15",
      "audioFile": "/assets/test-audio/concert-1.mp3",
      "imageFile": "/assets/test-images/concert-1.jpg"
    }
  ]
}
```

After:

```json
{
  "concerts": [
    {
      "id": 1,
      "band": "The Midnight Echoes",
      "venue": "The Fillmore",
      "date": "2023-08-15",
      "audioFile": "/assets/test-audio/concert-1.mp3",
      "imageFile": "/assets/test-images/concert-1.jpg",
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

**Note**: The `imageFile` field is currently not used by the app (it's metadata only). The `photoHashes` object (and temporary `photoHash` mirror) is what the recognition algorithm needs.

---

## Dependencies

**None** - This can be implemented independently.

**Nice to have** (not blocking):

- Completion of issue #X (Refactor Feature Flags) would simplify Test Mode detection, but current `FeatureFlagContext` works fine

---

## Estimated Effort

**Total: 8-12 hours**

Breakdown:

- Phase 1 (Hash Generation): 2-3 hours
  - Script creation: 1-2 hours
  - Hash generation and testing: 1 hour
- Phase 2 (Debug UI): 3-4 hours
  - Component creation: 2 hours
  - Styling and integration: 1-2 hours
- Phase 3 (Logging): 1-2 hours
  - Enhanced logging: 1 hour
  - Testing and refinement: 0-1 hour
- Phase 4 (Documentation): 2 hours
  - Guide updates: 1 hour
  - README updates: 1 hour
- Phase 5 (Testing): 1-2 hours
  - Manual testing: 1 hour
  - Quality checks: 0-1 hour

**Parallel work possible**:

- Hash generation (Phase 1) can be done first
- Debug UI (Phase 2) and logging (Phase 3) can be done in parallel
- Documentation (Phase 4) can be done last

---

## Success Indicators

When complete, users should be able to:

1. ✅ Enable Test Mode via Secret Settings
2. ✅ See debug overlay in corner showing recognition state
3. ✅ Print test images and point camera at them
4. ✅ Watch debug overlay update in real-time as recognition happens
5. ✅ Hear audio play when photo is recognized
6. ✅ See detailed console logs explaining recognition process
7. ✅ Troubleshoot recognition issues using debug information

When complete, developers should be able to:

1. ✅ Generate photo hashes for new test images easily
2. ✅ Understand photo recognition process via logs
3. ✅ Debug recognition issues quickly
4. ✅ Verify Test Mode functionality works end-to-end
5. ✅ Use Test Mode as a quality gate for photo recognition changes

---

## References

- [TEST_DATA_MODE_GUIDE.md](../../docs/TEST_DATA_MODE_GUIDE.md) - Current user guide (needs updates)
- [photo-recognition/README.md](../../src/modules/photo-recognition/README.md) - Photo recognition module docs
- [photo-recognition/algorithms/dhash.ts](../../src/modules/photo-recognition/algorithms/dhash.ts) - Hash algorithm implementation
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - Module structure guidelines
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Code quality standards
- [AI_AGENT_GUIDE.md](../../AI_AGENT_GUIDE.md) - AI agent collaboration guide

---

## Notes for AI Agents

### Implementation Order

**Recommended Sequence**:

1. **Start with hash generation** (Phase 1) - This is quick and unblocks testing
2. **Add hashes to test data** - Enables basic recognition immediately
3. **Test photo recognition manually** - Verify hashes work
4. **Add debug UI** (Phase 2) - Provides visual feedback
5. **Enhance logging** (Phase 3) - Adds troubleshooting capability
6. **Update documentation** (Phase 4) - Capture learnings
7. **Final validation** (Phase 5) - Comprehensive testing

### Code Quality Requirements

This issue requires strict adherence to project standards:

- ✅ **All quality checks must pass**:

  ```bash
  npm run lint:fix
  npm run format
  npm run type-check
  npm run test:run
  npm run build
  ```

- ✅ **Module isolation**: If creating `debug-overlay` as a module, follow ARCHITECTURE.md structure
- ✅ **TypeScript strict mode**: No `any` types, proper interfaces
- ✅ **CSS Modules**: Scoped styles for debug overlay
- ✅ **Mobile responsive**: Debug overlay works on mobile
- ✅ **Accessibility**: Debug overlay doesn't break keyboard navigation

### Testing Requirements

- ✅ Manual testing with **real printed photos** is REQUIRED
- ✅ Test in multiple lighting conditions
- ✅ Test on mobile device (primary use case)
- ✅ Verify bundle size stays under 150KB
- ✅ Verify no console errors in production mode

### Documentation Requirements

- ✅ Update DOCUMENTATION_INDEX.md with any new files
- ✅ Add README.md for any new modules
- ✅ Include code examples in documentation
- ✅ Update TEST_DATA_MODE_GUIDE.md with new debug features

---

## Questions to Consider

### For Implementation:

- **Where should debug overlay live?** New module or within photo-recognition?
- **Should hash generation be automated in CI?** Or manual script only?
- **Should debug logs be available in production?** Or dev/test mode only?
- **Should debug overlay be toggleable separately?** Or just follow Test Mode?

### For User Experience:

- **Is debug overlay too distracting?** Should it be collapsible?
- **Are console logs too verbose?** Should they have verbosity levels?
- **Should there be a "Copy Debug Info" button?** For sharing logs easily?

---

**Priority**: HIGH - Test Mode is currently advertised in documentation but doesn't work for its main purpose

**Impact**: HIGH - This enables the primary testing/validation workflow for the entire app

**Complexity**: MEDIUM - Requires image processing, UI component, logging enhancements, and documentation

**Risk**: LOW - Changes are isolated to test data and debug features, no impact on production functionality

---

_Last Updated: 2025-11-13_
