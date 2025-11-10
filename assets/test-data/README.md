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
      "audioFile": "/path/to/audio.mp3",
      "imageFile": "/path/to/image.jpg"
    }
  ]
}
```

### concerts.csv

CSV format with headers:

```csv
id,band,venue,date,audioFile,imageFile
1,Band Name,Venue Name,YYYY-MM-DD,/path/to/audio.mp3,/path/to/image.jpg
```

## Usage in Tests

These files can be loaded in tests to simulate data service responses without requiring network access or a backend API.

Example:

```typescript
import testData from '../../../assets/test-data/concerts.json';
```
