# Test Data Mode - User Guide

## Overview

The Test Data Mode feature allows you to test the complete Photo Signal workflow using pre-configured test data. This is particularly useful for:

- **Testing on mobile devices** - Point your camera at the included test images to experience the full app flow
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

### Step 3: Close the Menu

Click the X button or click outside the modal to close the Secret Settings menu. Your preference is automatically saved.

## Using Test Data Mode

### What Changes When Test Mode is Active?

When Test Data Mode is enabled, the app uses data from these directories instead of production data:

- **Concert data**: `assets/test-data/concerts.json` (instead of `/data.json`)
- **Audio files**: `assets/test-audio/*.mp3` (instead of `/audio/*.mp3`)
- **Photo hashes**: Links to test images in `assets/test-images/*.jpg`

### Testing the Photo Recognition Workflow

#### Required Materials

Print the test images located in `assets/test-images/`:
- `concert-1.jpg`
- `concert-2.jpg`
- `concert-3.jpg`
- `concert-4.jpg`

**Tip**: For best results, print these images at 4x6" or larger on standard photo paper.

#### Testing Steps

1. **Enable Test Data Mode** (see instructions above)
2. **Grant camera permissions** when prompted
3. **Point your camera at a printed test image**
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
- Audio playback with smooth crossfading
- Motion detection for audio fade-out
- Concert information display overlay
- Data persistence across page reloads

### What's Still Missing (Features to Identify)

When testing, you may discover features that are **planned but not yet implemented**:

❓ **Photo Hash Generation**
- Currently, test data has pre-computed photo hashes
- Real photos need a way to generate and store their hashes
- **Impact**: Cannot add new photos without manually computing hashes

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

❓ **Photo Hash Computation Tools**
- No built-in tool to compute dHash for new photos
- Requires external processing
- **Impact**: Adding photos requires technical knowledge

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
1. Verify Test Data Mode is enabled (check for 🧪 badge)
2. Ensure good lighting on the printed photo
3. Hold camera steady for 3+ seconds
4. Try adjusting distance (6-12 inches usually works best)
5. Check that the image is printed clearly (not on a screen)

### Audio Not Playing

**Problem**: Photo is recognized but no sound plays

**Solutions**:
1. Check device volume
2. Ensure you've interacted with the page (browsers block autoplay until user interaction)
3. Check browser console for audio loading errors
4. Verify test audio files exist in `assets/test-audio/`

### Mode Not Persisting

**Problem**: Test mode resets to Production mode on page reload

**Solutions**:
1. Check that localStorage is enabled in your browser
2. Ensure cookies/site data is not being cleared on close
3. Try a different browser

## Technical Details

### How Photo Recognition Works

1. **Frame Capture**: Camera feed is sampled every 1000ms
2. **Hash Computation**: Each frame is converted to an 8x8 grayscale dHash
3. **Comparison**: Frame hash is compared to all concert photo hashes
4. **Threshold Matching**: If Hamming distance ≤ 10 (similarity ≥ 84%), it's a match
5. **Stability Check**: Match must persist for 1000ms to trigger recognition
6. **Audio Trigger**: Matched concert's audio file begins playing

### Data Sources by Mode

| Resource | Production Mode | Test Mode |
|----------|----------------|-----------|
| Concert Data | `/data.json` | `/assets/test-data/concerts.json` |
| Audio Files | `/audio/*.mp3` | `/assets/test-audio/*.mp3` |
| Photo Hashes | (stored in concert data) | (stored in test concert data) |

### Test Data Contents

The test dataset includes:
- **4 concerts** with complete metadata (band, venue, date)
- **4 audio samples** (concert recordings/songs)
- **4 photo images** with pre-computed dHash values
- **Full recognition workflow** ready to test

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
