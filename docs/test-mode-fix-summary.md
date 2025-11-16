# Test Mode Fix Summary

## Problem

The Test Data Mode feature was not working because:

1. **Assets not accessible at runtime**: Test data files existed in `assets/test-data/` but weren't served by Vite (which only serves files from `public/`)
2. **Missing photo hashes**: Production data had no `photoHash`/`photoHashes` values, making photo recognition impossible
3. **Insufficient feedback**: No console logging to help users debug what was failing
4. **Poor discoverability**: Unclear documentation on how to use test mode

## Solution

### 1. Vite Plugin for Asset Copying

Created a Vite plugin that automatically copies test assets to `public/assets/` during build and dev server startup:

```typescript
// vite.config.ts
function copyTestAssetsPlugin() {
  return {
    name: 'copy-test-assets',
    buildStart() {
      // Copy assets/test-data/ → public/assets/test-data/
      // Copy assets/test-audio/ → public/assets/test-audio/
      // Copy assets/test-images/ → public/assets/test-images/
    },
  };
}
```

**Benefits:**

- No manual copying needed
- Works in both dev and production
- Auto-regenerates on every build
- `public/assets/` is git-ignored (clean repo)

### 2. Enhanced Logging

Added comprehensive console logging to DataService:

```javascript
console.log('[DataService] Test mode ENABLED');
console.log('[DataService] Loading concert data from: /assets/test-data/concerts.json');
console.log('[DataService] Successfully loaded 4 concerts');
console.log('[DataService] Concerts with photo hashes: 4');
```

**Benefits:**

- Users can verify test mode is active
- Clear error messages with troubleshooting hints
- Warnings for missing data or hashes
- Helps debug photo recognition issues

### 3. Comprehensive Testing

Added test suite for test mode functionality:

- Test mode switching
- Data source URL changes
- Cache invalidation on mode switch
- Subscriber notifications
- Console logging verification

**Benefits:**

- Ensures test mode works correctly
- Prevents regressions
- Documents expected behavior

### 4. Documentation

Updated and consolidated comprehensive documentation:

- **docs/TEST_DATA_MODE_GUIDE.md**: Enhanced user guide with auto-copy mechanism details and new console logging examples
- **docs/test-mode-fix-summary.md**: Technical implementation summary for developers
- **assets/test-data/README.md**: Technical details on test assets
- **public/README.md**: Auto-generated assets explanation
- **scripts/README.md**: Script documentation
- **DOCUMENTATION_INDEX.md**: Updated with consolidated guide reference

**Benefits:**

- Users know how to enable and use test mode
- Developers understand the implementation
- Troubleshooting guides available
- No duplicate documentation

## How to Use Test Mode

### Quick Start

1. **Enable Test Mode**
   - Triple-tap the screen to open Secret Settings
   - Toggle ON "Test Data Mode"
   - Click "Send It 🚀" to reload

2. **Verify It's Working**
   - Open browser console (F12)
   - Look for `[DataService] Test mode ENABLED`
   - Check for "Concerts with photo hashes: 4"

3. **Test Photo Recognition**
   - Display a test image from `assets/test-images/` on another device
   - Point your camera at it
   - Watch the Debug Overlay for recognition status
   - Concert info should appear after ~1 second

### Test Images

Located in `assets/test-images/`:

- `concert-1.jpg` - The Midnight Echoes
- `concert-2.jpg` - Electric Dreams
- `concert-3.jpg` - Velvet Revolution
- `concert-4.jpg` - Sunset Boulevard

Each has a corresponding `photoHashes` entry (plus legacy `photoHash`) in `assets/test-data/concerts.json`.

## Technical Details

### Data Flow

```
Production Mode:
  fetch('/data.json') → No photoHashes → Photo recognition doesn't work

Test Mode:
  fetch('/assets/test-data/concerts.json') → Has photoHashes → Photo recognition works
```

### Asset Generation

```
Build/Dev Startup:
  assets/test-data/concerts.json → public/assets/test-data/concerts.json
  assets/test-audio/*.mp3        → public/assets/test-audio/*.mp3
  assets/test-images/*.jpg       → public/assets/test-images/*.jpg
```

### Photo Hash Format

```json
{
  "id": 1,
  "band": "The Midnight Echoes",
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
```

Each `photoHashes` entry stores both **pHash** (16-char) and **dHash** (32-char) arrays for three exposure variants (dark, normal, bright). The legacy `photoHash` array mirrors the `phash` values until older clients are retired.

## Files Changed

### Core Implementation

- `vite.config.ts` - Vite plugin for copying assets
- `src/services/data-service/DataService.ts` - Enhanced logging
- `.gitignore` - Ignore `public/assets/`

### Tests

- `src/services/data-service/DataService.test.ts` - Test mode tests

### Documentation

- `docs/TEST_DATA_MODE_GUIDE.md` - Comprehensive user guide
- `assets/test-data/README.md` - Updated
- `public/README.md` - Updated
- `scripts/README.md` - Updated
- `scripts/copy-test-assets.sh` - Updated
- `DOCUMENTATION_INDEX.md` - Updated
- `src/modules/secret-settings/featureFlagConfig.ts` - Better description

## Verification Checklist

- [x] Vite plugin copies assets on build/dev
- [x] Test data loads correctly in test mode
- [x] Photo hashes are present in test data
- [x] Console logging provides clear feedback
- [x] Debug overlay shows recognition details
- [x] Tests cover test mode functionality
- [x] Documentation explains usage
- [ ] Manual testing with dev server
- [ ] Manual testing with test images
- [ ] Type checking passes
- [ ] Linting passes
- [ ] All tests pass

## Next Steps

1. Run type checking: `npm run type-check`
2. Run linting: `npm run lint:fix`
3. Run tests: `npm run test:run`
4. Manual testing:
   - Start dev server: `npm run dev`
   - Enable test mode via Secret Settings
   - Test photo recognition with test images
   - Verify debug overlay shows correct information

## References

- [Test Data Mode Guide](./TEST_DATA_MODE_GUIDE.md) - Complete user guide with setup, testing, and troubleshooting
- [Test Data README](../assets/test-data/README.md) - Technical details on test data files
- [Photo Recognition Module](../src/modules/photo-recognition/README.md) - Photo recognition implementation
- [DataService README](../src/services/data-service/README.md) - Data service contract and usage
