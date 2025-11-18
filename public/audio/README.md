# Audio Files

This directory contains Opus audio files used by the application for audio playback.

## Current Files

### Short Test Files (Quick Testing)

- `concert-1.opus` - Audio for "The Midnight Echoes" (220Hz tone, 5 seconds)
- `concert-2.opus` - Audio for "Electric Dreams" (440Hz tone, 5 seconds)
- `concert-3.opus` - Audio for "Velvet Revolution" (880Hz tone, 5 seconds)
- `concert-4.opus` - Audio for "Sunset Boulevard" (C-E-G chord, 5 seconds)

### Full-Length Song Files (Performance Testing)

- `concert-song-1.opus` - Full-length layered composition (2 minutes)
- `concert-song-2.opus` - Full-length chord progression (2 minutes)

These are CC0 licensed test audio files. See [ASSET_LICENSES.md](../ASSET_LICENSES.md) for details.

## Adding Your Own Audio

To use your own Opus files:

1. Place your Opus files in this directory
2. Update the `audioFile` paths in `public/data.json` to reference your files

Example:

```json
{
  "id": 1,
  "band": "Your Band",
  "venue": "Your Venue",
  "date": "2024-01-01",
  "audioFile": "/audio/your-file.opus"
}
```

## Source

The current test audio files are copied from `assets/test-audio/` for easy development and testing.
