# Example Real Photos

This directory contains real concert/event photos for testing the Photo Signal gallery and photo recognition features.

## Contents

- `R0043343.jpg` - Concert photo
- `R0055333.jpg` - Concert photo
- `R0055917.jpg` - Concert photo
- `R0060632.jpg` - Concert photo
- `R0060861.jpg` - Concert photo

**Total**: 5 JPEG images

## Purpose

These photos are used for:

- Testing the photo recognition algorithm with real-world concert photos
- Validating the gallery layout and display
- Generating perceptual hashes (dHash) for concert matching
- End-to-end testing of the camera-to-audio workflow

## Usage

### Generate Photo Hashes

To generate dHash perceptual hashes for these photos:

**Browser-based (recommended)**:

```bash
# Open the hash generator in your browser
open scripts/generate-photo-hashes.html
# Then drag and drop the images from this folder
```

**Node.js script**:

```bash
npm run generate-hashes assets/example-real-photos/*.jpg
```

The generated hashes should be added to `public/data.json` to enable photo recognition for these concerts.

### Testing Photo Recognition

1. Generate hashes for these photos
2. Add the hashes to concert entries in `public/data.json`
3. Print the photos (3:2 aspect ratio recommended)
4. Point the camera at the printed photos to test recognition

## Notes

- Photos should maintain consistent lighting and framing for best recognition results
- The dHash algorithm is robust to minor brightness/contrast variations
- For optimal recognition, photos should be printed at least 4x6 inches
- Keep photos in this directory for regression testing and algorithm improvements

## Related Documentation

- [Photo Recognition Research](../../docs/photo-recognition-research.md) - Algorithm selection and evaluation
- [Hash Generation Scripts](../../scripts/README.md) - Tools for generating photo hashes
- [Data Service](../../src/services/data-service/README.md) - How photo hashes are stored and used
- [Photo Recognition Module](../../src/modules/photo-recognition/README.md) - Recognition implementation details
