# Test Mode Usage Guide

This guide explains how to use the Test Data Mode feature to test photo recognition with sample images.

## Overview

Test Mode switches the app from using production data (`public/data.json`) to test data (`public/assets/test-data/concerts.json`). The key difference is:

- **Production data**: No `photoHash` values → photo recognition won't work
- **Test data**: Has `photoHash` values → photo recognition works with test images

## Enabling Test Mode

### Step 1: Open Secret Settings
Triple-tap the center of the screen to open the Secret Settings menu.

### Step 2: Enable Test Data Mode
Under "Feature Flags", toggle ON the "Test Data Mode" option.

The description should read:
> "Use test data with working photo hashes and sample audio/images. Test assets are automatically copied to public/assets/ during build. Enable this mode to test photo recognition with the provided test images in assets/test-images/."

### Step 3: Apply Changes
Click the "Send It 🚀" button at the bottom of the menu. This will:
1. Save your settings
2. Reload the page
3. Load test data instead of production data

## Verifying Test Mode is Active

Check the browser console (F12 → Console tab) for these messages:

```
[DataService] Test mode ENABLED
[DataService] Data will be loaded from: /assets/test-data/concerts.json
[DataService] Loading concert data from: /assets/test-data/concerts.json
[DataService] Successfully loaded 4 concerts
[DataService] Concerts with photo hashes: 4
```

You should also see a "🧪 Test Mode" badge in the Secret Settings menu.

## Using Test Images

The test images are located in `assets/test-images/`:

1. **concert-1.jpg** - The Midnight Echoes
2. **concert-2.jpg** - Electric Dreams
3. **concert-3.jpg** - Velvet Revolution
4. **concert-4.jpg** - Sunset Boulevard

### Testing Photo Recognition

1. Display one of the test images on another device (phone, tablet, or monitor)
2. Point your camera at the displayed image
3. Keep the image steady within the 3:2 frame overlay
4. After ~1 second (recognition delay), the app should:
   - Display the concert information (band, venue, date)
   - Start playing the corresponding audio
   - Show the Debug Overlay (if enabled) with recognition details

### Printing Test Images

For the most realistic testing experience:

1. Print the test images from `assets/test-images/`
2. Use standard photo paper (glossy or matte)
3. Print at actual photo size (4×6 inches or similar)
4. Test recognition by pointing your camera at the printed photo

## Debug Overlay

When Test Mode is enabled, the Debug Overlay is automatically shown. It displays:

- **Status**: Current recognition state (IDLE, CHECKING, MATCHING, RECOGNIZED)
- **Frame Hash**: Hash of the current camera frame
- **Best Match**: Concert with closest hash match and similarity percentage
- **Threshold**: Current matching threshold (distance ≤ 40)
- **Recognized Concert**: Details when a match is confirmed

This provides real-time feedback to help understand what the recognition system is doing.

## Troubleshooting

### "No concerts have photoHash values" warning

This means the test assets weren't copied properly. Try:

1. Stop the dev server
2. Delete `public/assets/` directory
3. Restart the dev server (`npm run dev`)
4. The Vite plugin should automatically copy assets

### "Failed to load concert data" error

Check that:
- Test mode is enabled in Secret Settings
- You clicked "Send It 🚀" to reload the page
- The browser console shows the correct data URL
- The file exists at `/assets/test-data/concerts.json`

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
