# Test Data Mode - User Guide

## Overview

The Test Data Mode feature allows you to test the complete Photo Signal workflow using pre-configured test data. This is particularly useful for:

- **Testing on mobile devices** - Point your camera at the included test images (gradients, easy targets, or real photos) to experience the full app flow
- **Development and QA** - Validate functionality without needing production data
- **Feature exploration** - Identify which features are working and which are still in development

## How to Enable Test Data Mode

### Step 1: Access the Secret Settings Menu

1. Open Photo Signal in your browser
2. **Triple-tap in the center of the screen** (quickly tap 3 times in the middle area)
3. The Secret Settings menu will appear

![Secret Settings Menu](https://github.com/user-attachments/assets/83e4a411-1d23-4f36-9f9c-39b502e36192)

### Step 2: Toggle Test Data Mode

1. In the Secret Settings menu, locate the **"Test Data Mode"** toggle under "Feature Flags"
2. Click the toggle switch to turn it ON (it will turn blue)
3. The mode badge at the top will change from "🎯 PRODUCTION MODE" to "🧪 TEST MODE"

![Test Mode Enabled](https://github.com/user-attachments/assets/59a56fe7-97a6-482c-9c01-984aa709bf80)

### Step 3: Apply Changes and Reload

Click the **"Send It 🚀"** button at the bottom of the Secret Settings menu. This will:

1. Save your settings to localStorage
2. Reload the page
3. Load test data instead of production data

Alternatively, you can click the X button or click outside the modal to close the menu. Your preference is automatically saved, but you'll need to manually reload the page for test mode to take effect.

## Using Test Data Mode

### What Changes When Test Mode is Active?

The underlying dataset is now identical in both modes: `/assets/test-data/concerts.json` with audio coming exclusively from `/assets/example-real-songs/*.mp3`. We still recommend enabling Test Mode during development because it unlocks extra tooling:

- **Debug overlay + telemetry export** – live recognition metrics stay visible in the bottom-right corner and you can export telemetry snapshots.
- **Verbose logging** – Photo recognition and data service logs include per-frame breakdowns, helping you reason about similarity scores.
- **Feature flag overrides** – Experimental settings (hash algorithm switches, recognition delay slider, retro audio, etc.) remain available only while the 🧪 flag is on.

> 💡 We will reintroduce a dedicated production dataset once the 100-photo drop is ready. For now, leaving Test Mode off only hides the debug UI—it no longer changes the data source.

### Testing the Photo Recognition Workflow

#### Required Materials

Print whichever asset set you want to exercise:

**Gradient Set (IDs 1-4)** – located in `assets/test-images/`

- `concert-1.jpg`
- `concert-2.jpg`
- `concert-3.jpg`
- `concert-4.jpg`

**High-Contrast Set (IDs 5-7)** – generated with `npm run create-easy-images`

- `easy-target-bullseye.png`
- `easy-target-diagonals.png`
- `easy-target-checker.png`

**Example Real Photos (IDs 8-12)** – located in `assets/example-real-photos/`

- `R0043343.jpg`
- `R0055333.jpg`
- `R0055917.jpg`
- `R0060632.jpg`
- `R0060861.jpg`

**Tips**:

- Print at 4x6" or larger for the most reliable recognition window.
- The easy PNGs are ideal when you just need a guaranteed match while tuning settings.
- The example real photos now ship with both `phash` and `dhash` arrays in production and test data, so you can flip the **Hash Algorithm** custom setting without editing JSON.

#### Testing Steps

1. **Enable Test Data Mode** (optional but recommended so you get the debug overlay)
2. **Grant camera permissions** when prompted
3. **Point your camera at any printed asset from the lists above**
4. **Hold steady** for 2-3 seconds
5. **Listen** - The corresponding audio should begin playing
6. **Move the camera away** - Audio should fade out after detecting movement

### What Should Work

✅ **Currently Implemented Features:**

- Triple-tap to open Secret Settings
- Toggle between Production and Test modes
- Mode indicator badge (🎯/🧪)
- Camera access and permission handling
- Photo recognition using perceptual hashing (dHash algorithm)
- **Photo hash generation tools** (browser-based HTML tool + Node.js script)
- **Debug overlay** showing real-time recognition information
- **Enhanced console logging** for troubleshooting
- Audio playback with smooth crossfading
- Motion detection for audio fade-out
- Concert information display overlay
- Data persistence across page reloads

### Debug Overlay (Test Mode Only)

When Test Mode is enabled, a debug overlay appears in the bottom-right corner showing:

- **Recognition Status**: IDLE 🔵 CHECKING 🟡 MATCHING 🟢 RECOGNIZED
- **Frame Hash**: Last computed hash from camera (e.g., `a5b3c7...0486`)
- **Best Match**: Closest matching concert with similarity percentage
- **Countdown**: Live timer + progress bar describing how long the current frame has stayed above the threshold
- **Threshold & Delay**: Current matching threshold plus the configured recognition delay (defaults to 3 s)
- **Metrics**: Frames processed, concerts evaluated, check interval, aspect ratio, frame size, and the last check timestamp
- **Recognized Concert**: Full details when a photo is successfully recognized

This overlay updates in real-time as the photo recognition system processes frames, making it easy to see what's happening under the hood.

Need a faster or slower confirmation window? Open the Secret Settings menu, scroll to **Custom Settings → Recognition Delay**, and move the slider. The countdown panel immediately reflects the new duration after you tap “Send It 🚀”.

Need something even easier to match? Run `npm run create-easy-images` to regenerate the bold bullseye / diagonal / checkerboard PNGs, then reprint them.

### Console Logging

When Test Mode is enabled, detailed logs are output to the browser console. Because both modes now fetch `/assets/test-data/concerts.json`, the only log difference is whether the `Test mode` line says ENABLED or DISABLED.

**Data Service Logs** (when test mode is toggled):

```
[DataService] Test mode ENABLED
[DataService] Data will be loaded from: /assets/test-data/concerts.json
[DataService] Loading concert data from: /assets/test-data/concerts.json
[DataService] Successfully loaded 12 concerts
[DataService] Concerts with photo hashes: 12
```

**Photo Recognition Logs** (frame-by-frame processing):

```
============================================================
[Photo Recognition] FRAME 42 @ 12:34:56.789
Frame Hash: a5b3c7d9e1f20486
Frame Size: 640 × 480 px
Concerts Checked: 4
Threshold: 40 (similarity ≥ 84.4%)

Results:
  ✓ The Midnight Echoes: distance=6, similarity=90.6% ← BEST MATCH
  ✗ Electric Dreams: distance=24, similarity=62.5%

Match Decision: POTENTIAL MATCH (The Midnight Echoes)
  Stability Timer: 1.2s / 3.0s required
============================================================
```

**Tip**: Use the browser console's filter feature to show only `[DataService]` or `[Photo Recognition]` logs.

### What's Still Missing (Features to Identify)

When testing, you may discover features that are **planned but not yet implemented**:

~~❓ **Photo Hash Generation**~~ ✅ **IMPLEMENTED**

- ✅ Browser-based HTML tool: `scripts/generate-photo-hashes.html`
- ✅ Node.js CLI: `scripts/update-recognition-data.js --paths-mode` (`npm run generate-hashes`)
- ✅ NPM command: `npm run generate-hashes`
- See scripts/README.md for usage instructions

~~❓ **Photo Hash Computation Tools**~~ ✅ **IMPLEMENTED**

- ✅ Built-in tools to compute dHash for new photos
- ✅ Easy-to-use browser interface (drag-and-drop)
- ✅ Command-line script for automation
- **Impact**: Adding photos is now simple for anyone

❓ **Photo Upload/Management**

- No interface to upload new concert photos
- No way to associate photos with concert metadata
- **Impact**: Users cannot add their own concert memories

❓ **Audio Upload/Management**

- No interface to upload custom audio files
- Audio files must be manually placed in `/public/audio/`
- **Impact**: Users cannot upload their own concert recordings

❓ **Concert Data Management**

- No UI to add/edit/delete concert entries
- Must manually edit `data.json` file
- **Impact**: Non-technical users cannot manage their concert library

❓ **Multi-Photo Support Per Concert**

- Each concert currently supports only one photo
- No gallery view for multiple photos from the same event
- **Impact**: Limited storytelling capability

❓ **Sharing Features**

- No way to share recognized concerts with others
- No social media integration
- **Impact**: Experiences remain private

❓ **History/Recently Played**

- No record of which concerts have been recognized
- No playback history
- **Impact**: Cannot revisit past recognitions

❓ **Custom Settings**

- Motion sensitivity adjustment UI (algorithm exists, no UI control)
- Recognition threshold tuning (algorithm exists, no UI control)
- Audio volume control (playback exists, no persistent volume setting)
- **Impact**: Users cannot optimize for their environment

## Troubleshooting

### Camera Not Working

**Problem**: Camera feed doesn't appear or permission is denied

**Solutions**:

1. Ensure you're using HTTPS or localhost (camera requires secure context)
2. Check browser permissions in settings
3. Try a different browser (Chrome, Firefox, Safari all supported)
4. Grant camera permission when prompted

### Photo Not Recognized

**Problem**: Holding camera over test image doesn't trigger audio

**Solutions**:

1. **Check Debug Overlay**: Look at the debug info in bottom-right corner
   - Is the frame hash updating? (should change every ~1 second)
   - Is a best match being shown? What's the similarity percentage?
   - Is the similarity below the threshold? (needs ≥84%)
2. **Check Console Logs**: Open browser DevTools (F12) and look for recognition logs
   - Are frames being processed?
   - What are the similarity scores for each concert?
   - Are there any error messages?
3. Verify Test Data Mode is enabled (check for 🧪 badge)
4. Ensure good lighting on the printed photo
5. Hold camera steady for 3+ seconds
6. Try adjusting distance (6-12 inches usually works best)
7. Check that the image is printed clearly (not on a screen)
8. Verify the test concert has a `photoHashes.phash` array in `assets/test-data/concerts.json`

**Example Debug Info for Successful Recognition**:

- Frame Hash updates every second
- Best Match shows the concert name
- Similarity is ≥84% (e.g., "90.6%")
- Status changes from CHECKING → MATCHING → RECOGNIZED
- Console shows "POTENTIAL MATCH" then "🎵 RECOGNIZED!"

### Adding New Test Images

**Problem**: Want to add your own test images

**Solutions**:

1. **Using Browser Tool** (Easiest):
   - Open `scripts/generate-photo-hashes.html` in your browser
   - Drag and drop your image files
   - Copy the generated hashes
   - Add them to `assets/test-data/concerts.json`

2. **Using Command Line** (For Automation):

   ```bash
   # Place images in assets/test-images/ (default) or pass --paths for other folders
   npm run generate-hashes
   # or
   npm run generate-hashes -- --paths assets/example-real-photos
   # Copy the output hashes to concerts.json
   ```

   > This wraps `scripts/update-recognition-data.js --paths-mode`, so hashes match the data refresh pipeline exactly.

   Need a guaranteed-match calibration target? Run `npm run create-easy-images` to regenerate the bullseye/diagonal/checkerboard PNGs before printing.

3. **Hash Format**:

   ```json
   {
     "id": 5,
     "band": "New Band",
     "venue": "New Venue",
     "date": "2024-01-01",
     "audioFile": "/assets/example-real-songs/new-track.mp3",
     "imageFile": "/assets/test-images/new-image.jpg",
     "photoHashes": {
       "phash": ["dark-exposure-phash", "normal-exposure-phash", "bright-exposure-phash"],
       "dhash": ["dark-exposure-dhash", "normal-exposure-dhash", "bright-exposure-dhash"]
     }
   }
   ```

   > `photoHashes` is the canonical shape for recognition data.

See `scripts/README.md` for detailed hash generation instructions.

### Audio Not Playing

**Problem**: Photo is recognized but no sound plays

**Solutions**:

1. Check device volume
2. Ensure you've interacted with the page (browsers block autoplay until user interaction)
3. Check browser console for audio loading errors
4. Verify the clip pack exists in `assets/example-real-songs/` (those are the files referenced in the dataset). The legacy tones in `assets/test-audio/` remain available if you want to swap them in manually.

### Mode Not Persisting

**Problem**: Test mode resets to Production mode on page reload

**Solutions**:

1. Check that localStorage is enabled in your browser
2. Ensure cookies/site data is not being cleared on close
3. Try a different browser

## Technical Details

### How Test Assets Are Served

Test assets (located in `assets/test-*` directories) are **automatically copied** to `public/assets/` during build and dev server startup by a Vite plugin. This makes them accessible at runtime.

**Auto-Copy Process:**

1. When you run `npm run dev` or `npm run build`, a Vite plugin activates
2. The plugin copies files from source directories to public:
   - `assets/test-data/concerts.json` → `public/assets/test-data/concerts.json`
   - `assets/test-audio/*.mp3` → `public/assets/test-audio/*.mp3`
   - `assets/test-images/*.jpg|png` → `public/assets/test-images/`
   - `assets/example-real-photos/*.jpg` → `public/assets/example-real-photos/`
   - `assets/example-real-songs/*.mp3` → `public/assets/example-real-songs/`
3. The `public/assets/` directory is git-ignored (auto-generated, not committed)
4. Files are accessible at runtime via URLs like `/assets/test-data/concerts.json`

**Troubleshooting Auto-Copy Issues:**

If you see "[DataService] Warning: No concerts expose photoHashes" or test data fails to load:

1. Stop the dev server
2. Delete the `public/assets/` directory
3. Restart the dev server: `npm run dev`
4. The Vite plugin should automatically recreate the assets
5. Check the console for "✓ Test assets copied to public/assets/"

**Manual Copy** (if needed):

```bash
# Run this script to manually copy test assets (including real songs)
./scripts/copy-test-assets.sh
```

### How Photo Recognition Works

1. **Frame Capture**: Camera feed is sampled every 1000ms
2. **Hash Computation**: Each frame is converted to an 8x8 grayscale dHash
3. **Comparison**: Frame hash is compared to all concert photo hashes
4. **Threshold Matching**: If Hamming distance ≤ 10 (similarity ≥ 84%), it's a match
5. **Stability Check**: Match must persist for 1000ms to trigger recognition
6. **Audio Trigger**: Matched concert's audio file begins playing

### Data Sources by Mode

| Resource     | Production Mode                        | Test Mode                              |
| ------------ | -------------------------------------- | -------------------------------------- |
| Concert Data | `/assets/test-data/concerts.json`      | `/assets/test-data/concerts.json`      |
| Audio Files  | `/assets/example-real-songs/*.mp3`     | `/assets/example-real-songs/*.mp3`     |
| Photo Hashes | Embedded in the shared concert dataset | Embedded in the shared concert dataset |

> Note: `/data.json` now mirrors the same entries so non-test builds still have access to hashed photos. We'll restore a dedicated production feed once new assets land.

### Test Data Contents

The shared dataset now includes:

- **24 concerts** with complete metadata (4 gradients, 3 high-contrast targets, 5 real photos, and 12 diagnostic edge cases)
- **All audio references pulled from the 30-second clip pack** in `/assets/example-real-songs/`, giving every entry a realistic playback sample
- **Photo images with pre-computed pHash + dHash values** (JPEG + PNG) so you can toggle algorithms without editing data
- **Full recognition workflow** ready to test, including the challenging edge-case scenarios that gate future releases

## Providing Feedback

When testing, please note:

1. **What worked well** - Which features functioned as expected?
2. **What didn't work** - Any bugs or broken features?
3. **What's missing** - Which features from the "Missing" section above would be most valuable?
4. **User experience** - Was anything confusing or hard to use?

This feedback helps prioritize development efforts and identify the most important missing features.

## Next Steps

After testing with the test data:

1. **Explore the code** - All source is in `src/` directory
2. **Review architecture** - See `ARCHITECTURE.md` for system design
3. **Check issues** - Visit the GitHub Issues page for planned features
4. **Contribute** - See `CONTRIBUTING.md` for contribution guidelines

---

**Need Help?** Check the project README or open an issue on GitHub.

**Developer?** See `ARCHITECTURE.md` and `AI_AGENT_GUIDE.md` for technical details on implementing missing features.
