# Migration Notes: Old → New Architecture

📚 **See also**: [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) for a complete list of all project documentation.

## Summary

The old monolithic components have been replaced with a modular architecture. This document explains the migration and what can be safely removed.

---

## What's New

### New Modules (Keep These!)

```
src/
├── modules/                    # NEW: Feature modules
│   ├── camera-access/         # Replaces camera logic from Camera.tsx
│   ├── camera-view/           # Replaces UI from Camera.tsx
│   ├── motion-detection/      # Replaces motion detection from Camera.tsx
│   ├── photo-recognition/     # Replaces recognition from Camera.tsx
│   ├── audio-playback/        # Replaces AudioPlayer.tsx
│   └── concert-info/          # Replaces InfoDisplay.tsx
│
├── services/                   # NEW: Business logic layer
│   └── data-service/          # Centralizes data fetching
│
└── types/                      # NEW: Shared types
    └── index.ts               # All type definitions
```

### Updated Files

- ✅ `src/App.tsx` - Now orchestrates modules instead of managing state

---

## What Can Be Removed (Optional)

### Old Components Directory

The `src/components/` directory is **no longer used** but kept for reference:

```
src/components/              # OLD: Can be deleted
├── Camera.tsx              # → Replaced by camera-access + camera-view + motion-detection + photo-recognition
├── AudioPlayer.tsx         # → Replaced by modules/audio-playback
└── InfoDisplay.tsx         # → Replaced by modules/concert-info
```

**Migration mapping:**

| Old Component                | New Module(s)                                                                                                                  | Notes                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `Camera.tsx` (179 lines)     | `camera-access/` (65 lines)<br>`camera-view/` (88 lines)<br>`motion-detection/` (105 lines)<br>`photo-recognition/` (75 lines) | Split into 4 focused modules        |
| `AudioPlayer.tsx` (73 lines) | `audio-playback/` (113 lines)                                                                                                  | Enhanced with better controls       |
| `InfoDisplay.tsx` (36 lines) | `concert-info/` (54 lines)                                                                                                     | Slightly expanded with more options |

---

## Safe Deletion Steps

If you want to clean up the old code:

### Step 1: Verify New Architecture Works

```bash
npm run dev      # Test locally
npm run build    # Ensure build succeeds
npm run lint     # Check for errors
```

### Step 2: Remove Old Components (Optional)

```bash
# Back up first (just in case)
git tag backup-before-cleanup

# Remove old components directory
rm -rf src/components/

# Update .gitignore if needed
echo "src/components/" >> .gitignore  # (optional)

# Commit
git add .
git commit -m "Remove old monolithic components"
```

### Step 3: Test Again

```bash
npm run build    # Should still work!
npm run dev      # Should still work!
```

---

## Why Keep Old Components (Temporarily)?

**Reasons to keep them for now:**

1. **Reference** - Easy to compare old vs new implementation
2. **Documentation** - Shows how code was refactored
3. **Rollback** - If issues found, can reference old code
4. **Learning** - Helps understand modular migration

**When to delete:**

- After testing new architecture in production
- After confirming no regressions
- After team is comfortable with new structure
- Whenever you feel confident! (The new code is complete)

---

## Functional Equivalence

The new modular architecture has **100% feature parity** with the old:

| Feature           | Old Implementation | New Implementation   | Status      |
| ----------------- | ------------------ | -------------------- | ----------- |
| Camera access     | `Camera.tsx`       | `camera-access/`     | ✅ Same     |
| Motion detection  | `Camera.tsx`       | `motion-detection/`  | ✅ Same     |
| Photo recognition | `Camera.tsx`       | `photo-recognition/` | ✅ Same     |
| Audio playback    | `AudioPlayer.tsx`  | `audio-playback/`    | ✅ Enhanced |
| Info display      | `InfoDisplay.tsx`  | `concert-info/`      | ✅ Same     |
| 3:2 overlay       | `Camera.tsx`       | `camera-view/`       | ✅ Same     |
| Permissions       | `Camera.tsx`       | `camera-access/`     | ✅ Same     |

---

## Benefits of New Architecture vs Old

### Old Architecture ❌

```
Camera.tsx (179 lines)
├── Camera access logic
├── Motion detection logic
├── Photo recognition logic
├── Data fetching
├── UI rendering
└── Permission handling
```

**Problems:**

- One file does too much
- Hard to test individual features
- Multiple developers would conflict
- Difficult to replace just photo recognition

### New Architecture ✅

```
modules/
├── camera-access/      (65 lines)   ← ONE job
├── camera-view/        (88 lines)   ← ONE job
├── motion-detection/   (105 lines)  ← ONE job
└── photo-recognition/  (75 lines)   ← ONE job
```

**Benefits:**

- Each module has ONE responsibility
- Easy to test in isolation
- Multiple developers work in parallel
- Replace any module without touching others

---

## Rollback Plan (If Needed)

If you need to revert to old components:

```bash
# Revert App.tsx to use old components
git checkout <commit-before-refactor> -- src/App.tsx

# Remove new modules
rm -rf src/modules/ src/services/ src/types/

# Rebuild
npm run build
```

But you shouldn't need this - the new architecture is tested and working! ✅

---

## Recommendation

**For now**: Keep both old and new code

**Reason**: No harm in having old code as reference, and it's tiny (3 files)

**Later** (after 1-2 weeks): Delete `src/components/` directory

**Storage cost**: ~10KB of old code vs. gigabytes of `node_modules` - negligible!

---

## Feature Flag System Consolidation (November 2025)

### What Changed

The duplicate feature flag systems have been consolidated into a single source of truth.

**Before:**
- ❌ Two systems: `FeatureFlagContext` (old) + `secret-settings/useFeatureFlags` (new)
- ❌ Two storage keys: `photo-signal:feature-flags` + `photo-signal-feature-flags`
- ❌ Complex syncing with custom events
- ❌ Confusing for developers

**After:**
- ✅ One system: `secret-settings/useFeatureFlags`
- ✅ One storage key: `photo-signal-feature-flags`
- ✅ No syncing needed
- ✅ Clear, consistent API

### Migration Guide

**Old API:**
```tsx
import { useFeatureFlags } from './contexts';

const { isTestMode, isGrayscaleMode } = useFeatureFlags();
```

**New API:**
```tsx
import { useFeatureFlags } from './modules/secret-settings';

const { isEnabled } = useFeatureFlags();

// Check if flags are enabled
if (isEnabled('test-mode')) { /* ... */ }
if (isEnabled('grayscale-mode')) { /* ... */ }
```

**All 4 feature flags:**
1. `test-mode` - Use test data instead of production
2. `grayscale-mode` - Convert camera frames to B&W
3. `psychedelic-mode` - Enable psychedelic visual effects
4. `retro-sounds` - Play retro system sounds

### Files Removed

- ✅ `src/contexts/FeatureFlagContext.tsx` - Replaced by secret-settings module

### Files Updated

- ✅ `src/modules/photo-recognition/usePhotoRecognition.ts` - Now imports from secret-settings
- ✅ `src/main.tsx` - Removed FeatureFlagProvider wrapper (no longer needed)
- ✅ `src/App.test.tsx` - Removed FeatureFlagProvider wrapper
- ✅ `src/contexts/index.ts` - Now re-exports from secret-settings

### Benefits

1. **Single Source of Truth** - Feature flags defined in one place
2. **Better UI** - Secret Settings menu already exists and works great
3. **Easier Maintenance** - Add flags in one config file
4. **More Extensible** - Categories, descriptions, reset functionality
5. **No Context Needed** - Direct hook usage, no provider wrapper

---

## Questions?

See:

- `ARCHITECTURE.md` - Complete system design
- `AI_AGENT_GUIDE.md` - How to work with modules
- Module READMEs - Individual component docs

The new architecture is **production-ready** and fully tested! 🚀
