# Audio Files

This directory contains MP3 files used by the application for audio playback.

## Current Files

- `concert-1.mp3` - Audio for "The Midnight Echoes" (220Hz tone, 5 seconds)
- `concert-2.mp3` - Audio for "Electric Dreams" (440Hz tone, 5 seconds)
- `concert-3.mp3` - Audio for "Velvet Revolution" (880Hz tone, 5 seconds)
- `concert-4.mp3` - Audio for "Sunset Boulevard" (C-E-G chord, 5 seconds)

These are CC0 licensed test audio files. See [ASSET_LICENSES.md](../ASSET_LICENSES.md) for details.

## Adding Your Own Audio

To use your own MP3 files:

1. Place your MP3 files in this directory
2. Update the `audioFile` paths in `public/data.json` to reference your files

Example:
```json
{
  "id": 1,
  "band": "Your Band",
  "venue": "Your Venue",
  "date": "2024-01-01",
  "audioFile": "/audio/your-file.mp3"
}
```

## Source

The current test audio files are copied from `assets/test-audio/` for easy development and testing.
