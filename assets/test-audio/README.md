# Test Audio Files

This directory contains sample MP3 audio files for testing audio playback functionality.

## Files

- `concert-1.mp3` - Test audio for "The Midnight Echoes" (220Hz tone, 5 seconds, 40KB)
- `concert-2.mp3` - Test audio for "Electric Dreams" (440Hz tone, 5 seconds, 40KB)
- `concert-3.mp3` - Test audio for "Velvet Revolution" (880Hz tone, 5 seconds, 40KB)
- `concert-4.mp3` - Test audio for "Sunset Boulevard" (chord C-E-G, 5 seconds, 40KB)

## License

All audio files in this directory are generated test files created specifically for this project and are released under CC0 (Public Domain). See [ASSET_LICENSES.md](../../ASSET_LICENSES.md) for details.

## Purpose

These audio files are used for:

- Testing audio playback with Howler.js
- Testing audio fade in/out on motion detection
- Module-level testing of audio controls
- Development without requiring real concert recordings

## Specifications

- **Format**: MP3
- **Duration**: 5 seconds each
- **Bitrate**: 64 kbps
- **Sample Rate**: 44.1 kHz
- **Size**: ~40KB per file

## Notes

Each audio file uses a different frequency to make them distinguishable during testing:
- Concert 1: Low bass tone (220Hz - A3)
- Concert 2: Mid-range tone (440Hz - A4)
- Concert 3: High tone (880Hz - A5)
- Concert 4: Musical chord (C-E-G major triad)
