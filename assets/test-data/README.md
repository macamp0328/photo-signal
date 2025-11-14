# Test Data Files

This directory contains sample structured data files for testing data service functionality.

## Files

- `concerts.json` - JSON format concert data matching the structure in `public/data.json`
- `concerts.csv` - CSV format concert data for alternative data loading scenarios

## License

All data files in this directory are generated test files created specifically for this project and are released under CC0 (Public Domain). See [ASSET_LICENSES.md](../../ASSET_LICENSES.md) for details.

## Purpose

These data files are used for:

- Testing data service loading and parsing
- Testing data transformations and validation
- Module-level testing of concert info display
- Development and testing with consistent, version-controlled data
- **Runtime test mode**: When "Test Data Mode" is enabled in Secret Settings, the app loads this data instead of production data

## Runtime Access

**Important**: These test assets are automatically copied to `public/assets/test-data/` during build and dev server startup by a Vite plugin. This makes them accessible at runtime when test mode is enabled.

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
      "audioFile": "/assets/test-audio/audio.mp3",
      "imageFile": "/assets/test-images/image.jpg",
      "photoHash": "hexadecimal-hash-string"
    }
  ]
}
```

**Key differences from production data**:

- `audioFile` and `imageFile` paths point to `/assets/test-*` directories
- `photoHash` values are included for photo recognition testing

### concerts.csv

CSV format with headers:

```csv
id,band,venue,date,audioFile,imageFile,photoHash
1,Band Name,Venue Name,YYYY-MM-DD,/assets/test-audio/audio.mp3,/assets/test-images/image.jpg,hexadecimal-hash-string
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
4. The app will now use test data with working photo hashes
5. Point your camera at the test images in `assets/test-images/` to trigger recognition
