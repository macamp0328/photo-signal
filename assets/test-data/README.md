# Test Data Files

This directory contains sample structured data files for testing data service functionality.

## Files

- `concerts.json` - JSON format concert data matching the structure in `public/data.json`
- `concerts.csv` - CSV format concert data (same dataset, includes legacy `photoHash` column for backwards compatibility)

## License

All data files in this directory are generated test files created specifically for this project and are released under CC0 (Public Domain). See [ASSET_LICENSES.md](../../ASSET_LICENSES.md) for details.

## Purpose

These data files are used for:

- Testing data service loading and parsing
- Testing data transformations and validation
- Module-level testing of concert info display
- Development and testing with consistent, version-controlled data
- **Runtime test mode**: When "Test Data Mode" is enabled in Secret Settings, the app loads this data instead of production data

> **Temporary default dataset (Nov 2025):** Until the full 100-photo production batch ships, the main app now uses this dataset even when Test Mode is OFF. The toggle still matters for unlocking debug overlays and telemetry exports, but the data source remains the same either way.

## Runtime Access

**Important**: These test assets are automatically copied to `public/assets/test-data/` during build and dev server startup by a Vite plugin. This makes them accessible at runtime (regardless of test mode).

The `public/assets/` directory is git-ignored because it's auto-generated from the source assets in this directory.

## Format Specifications

### concerts.json

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
      },
      "photoHash": ["dark-exposure-phash", "normal-exposure-phash", "bright-exposure-phash"]
    }
  ]
}
```

**Key characteristics**:

- `audioFile` paths now standardize on `/assets/example-real-songs/*`, leveraging the 30-second real clip pack for every test entry
- `imageFile` paths point to `/assets/test-images/*` or `/assets/example-real-photos/*`
- `photoHashes` provides both **pHash** (default runtime choice) and **dHash** arrays so you can toggle algorithms via Secret Settings without editing data
- The legacy `photoHash` array mirrors the `phash` values to keep older builds functional until they can be fully migrated

### concerts.csv

CSV format with headers:

```csv
id,band,venue,date,audioFile,imageFile,photoHash
1,Band Name,Venue Name,YYYY-MM-DD,/assets/example-real-songs/track-clip.opus,/assets/test-images/image.jpg,normal-exposure-phash
```

## Usage in Tests

These files can be loaded in tests to simulate data service responses without requiring network access or a backend API.

Example:

```typescript
import testData from '../../../assets/test-data/concerts.json';
```

## Using Test Mode

1. Triple-tap the center of the screen to open Secret Settings
2. Enable "Test Data Mode" under Feature Flags
3. Click "Send It 🚀" to reload the app
4. The app will now use test data with working photo hashes (same dataset even if you leave the toggle OFF)
5. Point your camera at whichever printed assets you prefer (gradients, high-contrast PNGs, or example real photos)
