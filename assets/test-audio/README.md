# Test Audio Files

This directory contains sample Opus audio files for testing audio playback functionality.

## Files

### Short Test Files (Quick Testing)

- `concert-1.opus` - Test audio for "The Midnight Echoes" (220Hz tone, 5 seconds)
- `concert-2.opus` - Test audio for "Electric Dreams" (440Hz tone, 5 seconds)
- `concert-3.opus` - Test audio for "Velvet Revolution" (880Hz tone, 5 seconds)
- `concert-4.opus` - Test audio for "Sunset Boulevard" (chord C-E-G, 5 seconds)

### Full-Length Song Files (Performance Testing)

- `concert-song-1.opus` - Full-length layered composition (2 minutes)
- `concert-song-2.opus` - Full-length chord progression (2 minutes)

## License

All audio files in this directory are generated test files created specifically for this project and are released under CC0 (Public Domain). See [ASSET_LICENSES.md](../../ASSET_LICENSES.md) for details.

## Purpose

These audio files are used for:

- Testing audio playback with Howler.js
- Testing audio fade in/out on motion detection
- Module-level testing of audio controls
- Performance testing with realistic song-length files
- Development without requiring real concert recordings
- Pairing with generated photo assets when Test Data Mode is active

Looking for full concert recordings for the real example photos? See
[`assets/example-real-songs`](../example-real-songs/README.md) for the
user-provided Opus audio library that now ships with test mode.

## Specifications

### Short Test Files

- **Format**: Opus
- **Duration**: 5 seconds each
- **Bitrate**: 128 kbps
- **Sample Rate**: 48 kHz

### Full-Length Song Files

- **Format**: Opus
- **Duration**: 2 minutes each
- **Bitrate**: 128 kbps
- **Sample Rate**: 48 kHz

## Notes

### Short Files

Each short audio file uses a different frequency to make them distinguishable during testing:

- Concert 1: Low bass tone (220Hz - A3)
- Concert 2: Mid-range tone (440Hz - A4)
- Concert 3: High tone (880Hz - A5)
- Concert 4: Musical chord (C-E-G major triad)

### Full-Length Files

The full-length files simulate real song files for performance testing:

- Song 1: Layered bass and melody pattern (multi-frequency mix)
- Song 2: Chord progression simulation (4-note harmonic blend)
