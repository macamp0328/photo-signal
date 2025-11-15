# Test Asset Licenses

This document provides attribution and licensing information for all test assets included in this repository.

## Overview

- All synthetic test assets (images, audio files, data files) in the `assets/` directory are **generated files** created specifically for this project and released under CC0.
- The `assets/example-real-photos/` directory contains user-provided photos that ship with the repository for recognition testing. These images remain the property of the contributor and are licensed for Photo Signal development use only (see section below).
- The `assets/example-real-songs/` directory contains user-provided MP3 recordings that may contain copyrighted material. These tracks are licensed for internal Photo Signal development/testing only.

## License

All test assets are released under the **Creative Commons Zero (CC0) Public Domain Dedication**.

[![CC0](https://licensebuttons.net/p/zero/1.0/88x31.png)](https://creativecommons.org/publicdomain/zero/1.0/)

This means:

- The assets are dedicated to the public domain
- You can copy, modify, distribute and perform the work, even for commercial purposes
- No attribution is required (though appreciated)
- No permission is needed to use these assets

## Asset Details

### Test Images (`assets/test-images/`)

| File                        | Description                         | Generation Method                           | License |
| --------------------------- | ----------------------------------- | ------------------------------------------- | ------- |
| `concert-1.jpg`             | Blue gradient test image            | Generated with ImageMagick                  | CC0     |
| `concert-2.jpg`             | Red gradient test image             | Generated with ImageMagick                  | CC0     |
| `concert-3.jpg`             | Green gradient test image           | Generated with ImageMagick                  | CC0     |
| `concert-4.jpg`             | Purple gradient test image          | Generated with ImageMagick                  | CC0     |
| `easy-target-bullseye.png`  | Bullseye + glyph design             | Generated with `npm run create-easy-images` | CC0     |
| `easy-target-diagonals.png` | Diagonal stripes with text overlay  | Generated with `npm run create-easy-images` | CC0     |
| `easy-target-checker.png`   | Checkerboard grid with framed label | Generated with `npm run create-easy-images` | CC0     |

**Creation Command**: `convert -size 640x480 gradient:color1-color2 [filename].jpg`

These images are simple gradients and programmatically generated graphics (via ImageMagick or the `create-easy-test-images` canvas script). They contain no copyrighted imagery.

### Example Real Photos (`assets/example-real-photos/`)

| File           | Description              | Source                              | License                   |
| -------------- | ------------------------ | ----------------------------------- | ------------------------- |
| `R0043343.jpg` | Real-world concert photo | Provided by Photo Signal maintainer | Internal testing use only |
| `R0055333.jpg` | Real-world concert photo | Provided by Photo Signal maintainer | Internal testing use only |
| `R0055917.jpg` | Real-world concert photo | Provided by Photo Signal maintainer | Internal testing use only |
| `R0060632.jpg` | Real-world concert photo | Provided by Photo Signal maintainer | Internal testing use only |
| `R0060861.jpg` | Real-world concert photo | Provided by Photo Signal maintainer | Internal testing use only |

These photos are owned by the contributor and included solely for internal testing and manual recognition exercises. Do not redistribute outside this repository without explicit permission.

### Example Real Songs (`assets/example-real-songs/`)

| Clip Pattern                      | Description                               | Source                              | License                   |
| --------------------------------- | ----------------------------------------- | ----------------------------------- | ------------------------- |
| `01-mass-romantic-clip-0X.mp3`    | 30s stems from "Mass Romantic" live take  | Provided by Photo Signal maintainer | Internal testing use only |
| `06-ocelot-clip-0X.mp3`           | 30s stems from "Ocelot" jam-band cut      | Provided by Photo Signal maintainer | Internal testing use only |
| `13-1999-clip-0X.mp3`             | 30s stems from a "1999" synth-heavy cover | Provided by Photo Signal maintainer | Internal testing use only |
| `16-you-enjoy-myself-clip-0X.mp3` | 30s stems from "You Enjoy Myself"         | Provided by Photo Signal maintainer | Internal testing use only |
| `18-meatstick-clip-0X.mp3`        | 30s stems from "Meatstick" crowd favorite | Provided by Photo Signal maintainer | Internal testing use only |
| `20-possum-clip-0X.mp3`           | 30s stems from "Possum" blues-rock closer | Provided by Photo Signal maintainer | Internal testing use only |

Each pattern currently expands to four clips (X = 1…4) encoded at 128 kbps. The
clips dramatically cut repository size while preserving the realism of the
original field recordings. As with the source takes, these derived clips may be
subject to copyright and therefore must not be redistributed outside of this
repository.

### Test Audio Files (`assets/test-audio/`)

| File                 | Description                 | Generation Method     | License |
| -------------------- | --------------------------- | --------------------- | ------- |
| `concert-1.mp3`      | 220Hz sine wave (5s)        | Generated with FFmpeg | CC0     |
| `concert-2.mp3`      | 440Hz sine wave (5s)        | Generated with FFmpeg | CC0     |
| `concert-3.mp3`      | 880Hz sine wave (5s)        | Generated with FFmpeg | CC0     |
| `concert-4.mp3`      | C-E-G chord (5s)            | Generated with FFmpeg | CC0     |
| `concert-song-1.mp3` | Layered composition (2 min) | Generated with FFmpeg | CC0     |
| `concert-song-2.mp3` | Chord progression (2 min)   | Generated with FFmpeg | CC0     |

**Short Files Creation Command**: `ffmpeg -f lavfi -i "sine=frequency=XXX:duration=5" -b:a 64k [filename].mp3`

**Full-Length Files Creation Commands**:

```bash
# Song 1: Layered bass and melody (2 minutes)
ffmpeg -f lavfi -i "sine=frequency=220:duration=120" \
       -f lavfi -i "sine=frequency=330:duration=120" \
       -f lavfi -i "sine=frequency=440:duration=120" \
       -filter_complex "[0:a]volume=0.3[a0];[1:a]volume=0.2[a1];[2:a]volume=0.5[a2];[a0][a1][a2]amix=inputs=3:duration=first:dropout_transition=2" \
       -b:a 128k concert-song-1.mp3

# Song 2: Chord progression (2 minutes)
ffmpeg -f lavfi -i "sine=frequency=262:duration=120" \
       -f lavfi -i "sine=frequency=330:duration=120" \
       -f lavfi -i "sine=frequency=392:duration=120" \
       -f lavfi -i "sine=frequency=523:duration=120" \
       -filter_complex "[0:a]volume=0.25[a0];[1:a]volume=0.25[a1];[2:a]volume=0.25[a2];[3:a]volume=0.25[a3];[a0][a1][a2][a3]amix=inputs=4:duration=first" \
       -b:a 128k concert-song-2.mp3
```

These audio files are simple sine wave tones, chords, and layered compositions generated programmatically using FFmpeg's audio synthesis capabilities. They contain no copyrighted music or samples. The full-length files (2 minutes) simulate realistic song file sizes for performance testing.

### Test Data Files (`assets/test-data/`)

| File            | Description                        | License |
| --------------- | ---------------------------------- | ------- |
| `concerts.json` | Sample concert data in JSON format | CC0     |
| `concerts.csv`  | Sample concert data in CSV format  | CC0     |

These are simple structured data files containing fictional concert information (band names, venues, dates) created for testing purposes only. All data is fictional and does not represent real events.

## Why CC0?

We chose CC0 (Public Domain) licensing for test assets because:

1. **Maximum Compatibility**: Ensures no licensing conflicts with the main project (MIT License)
2. **No Attribution Burden**: Simplifies usage in tests and examples
3. **Clear Legal Status**: Removes any ambiguity about permissions
4. **Derivative Works**: Allows unrestricted modification and redistribution

## Generation Scripts

All test assets can be regenerated using the following commands:

### Images

```bash
cd assets/test-images
convert -size 640x480 gradient:blue-cyan concert-1.jpg
convert concert-1.jpg -pointsize 40 -fill white -gravity center -annotate +0+0 "Concert 1\nThe Midnight Echoes" concert-1.jpg
# Repeat for other concerts with different colors
```

### Audio

#### Short Test Files (5 seconds)

```bash
cd assets/test-audio
ffmpeg -f lavfi -i "sine=frequency=220:duration=5" -b:a 64k concert-1.mp3 -y
# Repeat for other concerts with different frequencies
```

#### Full-Length Song Files (2 minutes)

```bash
cd assets/test-audio
# Song 1: Layered composition
ffmpeg -f lavfi -i "sine=frequency=220:duration=120" \
       -f lavfi -i "sine=frequency=330:duration=120" \
       -f lavfi -i "sine=frequency=440:duration=120" \
       -filter_complex "[0:a]volume=0.3[a0];[1:a]volume=0.2[a1];[2:a]volume=0.5[a2];[a0][a1][a2]amix=inputs=3:duration=first:dropout_transition=2" \
       -b:a 128k concert-song-1.mp3 -y

# Song 2: Chord progression
ffmpeg -f lavfi -i "sine=frequency=262:duration=120" \
       -f lavfi -i "sine=frequency=330:duration=120" \
       -f lavfi -i "sine=frequency=392:duration=120" \
       -f lavfi -i "sine=frequency=523:duration=120" \
       -filter_complex "[0:a]volume=0.25[a0];[1:a]volume=0.25[a1];[2:a]volume=0.25[a2];[3:a]volume=0.25[a3];[a0][a1][a2][a3]amix=inputs=4:duration=first" \
       -b:a 128k concert-song-2.mp3 -y
```

### Data

Data files are simple JSON/CSV files that can be created with any text editor.

## Verification

To verify that these assets were generated locally and not sourced from external repositories:

1. All generation commands are documented above
2. File sizes are minimal (~30-40KB)
3. Content is simple (gradients, tones, structured data)
4. Creation dates match project development timeline
5. Files contain no watermarks or attribution requirements

## External Resources Considered (Not Used)

During development, the following CC0/public domain sources were considered but **not used** in favor of generated content:

- **Unsplash**: Free high-quality images (Unsplash License, similar to CC0)
- **Pixabay**: CC0 images (could not access during development due to network restrictions)
- **Freesound**: CC0 audio samples (could not access during development due to network restrictions)
- **Openverse**: CC0 media search engine (could not access during development due to network restrictions)

We ultimately chose to generate all assets programmatically to:

- Ensure consistent quality and size
- Avoid external dependencies
- Maintain complete control over content
- Guarantee CC0 status without attribution chains

## Questions or Concerns

If you have any questions about the licensing of these test assets, please open an issue in the GitHub repository.

---

**Last Updated**: 2025-11-15
**Asset Count**: 12 images (7 generated, 5 contributor-provided), 12 audio files (6 synthetic + 6 real), 2 data files
**Total Size**: ~175MB (real songs add ~170MB to the repository)
