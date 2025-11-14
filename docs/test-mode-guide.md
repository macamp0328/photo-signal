# Moved to TEST_DATA_MODE_GUIDE.md

This guide has been consolidated into [TEST_DATA_MODE_GUIDE.md](./TEST_DATA_MODE_GUIDE.md).

Please use the main Test Data Mode guide which now includes all the information from this file plus comprehensive screenshots, workflow testing, and troubleshooting.


### Photo not being recognized

Verify:
1. Test mode is enabled
2. Debug overlay shows frame hashes changing
3. Best match shows a concert with reasonable similarity
4. Threshold is set correctly (≤ 40 for test images)
5. Image is well-lit and in focus
6. Image fills most of the frame overlay

## Switching Back to Production Mode

1. Triple-tap to open Secret Settings
2. Toggle OFF "Test Data Mode"
3. Click "Send It 🚀"
4. App will reload with production data

## Technical Details

### How Test Assets Work

1. Source files are in `assets/test-*` directories (version controlled)
2. Vite plugin copies them to `public/assets/` during build/dev (auto-generated)
3. `public/assets/` is git-ignored (not committed)
4. When test mode is enabled, DataService loads from `/assets/test-data/concerts.json`

### File Structure

```
assets/
├── test-data/
│   └── concerts.json         # Source test data (with photoHash)
├── test-audio/
│   └── concert-*.mp3         # Source test audio files
└── test-images/
    └── concert-*.jpg         # Source test images

public/assets/                # Auto-generated (git-ignored)
├── test-data/
│   └── concerts.json         # Copied from assets/
├── test-audio/
│   └── concert-*.mp3         # Copied from assets/
└── test-images/
    └── concert-*.jpg         # Copied from assets/
```

### Console Logging

Test mode provides detailed console logging:
- Data source switching
- File loading progress
- Concert count and hash availability
- Photo recognition algorithm details
- Frame-by-frame matching results

Use the browser console (F12) to monitor these messages.

## See Also

- [assets/test-data/README.md](../assets/test-data/README.md) - Test data file specifications
- [assets/test-images/README.md](../assets/test-images/README.md) - Test image details
- [assets/test-audio/README.md](../assets/test-audio/README.md) - Test audio file details
- [public/README.md](../public/README.md) - Public assets directory documentation
