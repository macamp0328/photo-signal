# Test Data Files

This directory contains sample structured data files for testing data service functionality.

## Files

- `concerts.dev.json` - Full dev/test dataset with calibration targets and real-photo entries
- `concerts.prod.json` - Snapshot of production-ready data (mirrors `public/data.json` for convenience)
- `concerts.csv` - CSV format concert data (same dataset as `concerts.dev.json`, excludes hash columns to keep the format simple)

## License

All data files in this directory are generated test files created specifically for this project and are released under CC0 (Public Domain). See [ASSET_LICENSES.md](../../ASSET_LICENSES.md) for details.

## Purpose

These data files are used for:

- Testing data service loading and parsing
- Testing data transformations and validation
- Module-level testing of concert info display
- Development and testing with consistent, version-controlled data
- **Runtime test mode**: When "Test Data Mode" is enabled in Secret Settings, the app loads this data instead of production data

> **Data source overview (Nov 2025):** Production builds load `public/data.json`. Local development, Test Mode, and automated tests load `assets/test-data/concerts.dev.json` so the calibration fixtures stay available without polluting production data.

## Runtime Access

**Important**: These test assets are automatically copied to `public/assets/test-data/` during build and dev server startup by a Vite plugin. This makes them accessible at runtime (regardless of test mode).

The `public/assets/` directory is git-ignored because it's auto-generated from the source assets in this directory.

## Format Specifications

### concerts.dev.json

Standard JSON format matching the application's data structure:

```json
{
  "concerts": [
    {
      "id": 1,
      "band": "Band Name",
      "venue": "Venue Name",
      "date": "YYYY-MM-DD",
      "audioFile": "/assets/example-real-songs/track-clip.opus",
      "imageFile": "/assets/test-images/image.jpg",
      "photoHashes": {
        "phash": ["dark-exposure-phash", "normal-exposure-phash", "bright-exposure-phash"],
        "dhash": ["dark-exposure-dhash", "normal-exposure-dhash", "bright-exposure-dhash"]
      }
    }
  ]
}
```

**Key characteristics**:

- `audioFile` paths now standardize on `/assets/example-real-songs/*`, leveraging the 30-second real clip pack for every test entry
- `imageFile` paths point to `/assets/test-images/*` or `/assets/example-real-photos/*`
- `photoHashes` provides both **pHash** (default runtime choice) and **dHash** arrays so you can toggle algorithms via Secret Settings without editing data
- Legacy `photoHash` mirrors have been retired; only `photoHashes` is required now

### concerts.csv

CSV format with headers (aligned with the dev/test dataset):

```csv
id,band,venue,date,audioFile,imageFile
1,Band Name,Venue Name,YYYY-MM-DD,/assets/example-real-songs/track-clip.opus,/assets/test-images/image.jpg
```

## Usage in Tests

These files can be loaded in tests to simulate data service responses without requiring network access or a backend API.

Example:

```typescript
import testData from '../../../assets/test-data/concerts.dev.json';
```

## Using Test Mode

1. Triple-tap the center of the screen to open Secret Settings
2. Enable "Test Data Mode" under Feature Flags
3. Click "Send It 🚀" to reload the app
4. The app will now use test data with working photo hashes (same dataset even if you leave the toggle OFF)
5. Point your camera at whichever printed assets you prefer (gradients, high-contrast PNGs, or example real photos)
