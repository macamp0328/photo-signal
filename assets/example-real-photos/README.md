# Example Real Photos

This directory contains real concert/event photos for testing the Photo Signal gallery and photo recognition features.

## Contents

- `R0043343.jpg` - Concert photo
- `R0043815.jpg` - Concert photo
- `R0055333.jpg` - Concert photo
- `R0055917.jpg` - Concert photo
- `R0060632.jpg` - Concert photo
- `R0060861.jpg` - Concert photo
- `P3150466.jpg` - Concert photo

**Total**: 7 JPEG images

# Example Real Photos

This directory contains real concert/event photos for testing the Photo Signal gallery and photo recognition features.

## Purpose

These photos are used for:

- Testing the photo recognition algorithm with real-world concert photos
- Validating the gallery layout and display
- Generating perceptual hashes (dHash) for concert matching
- End-to-end testing of the camera-to-audio workflow

## Hash Reference (Precomputed)

| File           | Photo Hash                         |
| -------------- | ---------------------------------- |
| `R0043343.jpg` | `c4f53cf10ccd16675d674cd2555b4b53` |
| `R0043815.jpg` | `23a7a2732335c2ae4c970ee50c9a477e` |
| `R0055333.jpg` | `953f16ff30fb02db0352534504410041` |
| `R0055917.jpg` | `41bb499486698c791cfb9acddacd5538` |
| `R0060632.jpg` | `866f356722d6b4c3319d133c0ab9555a` |
| `R0060861.jpg` | `960bc5ef462e2e8c4e6b566ec2eda7ed` |
| `P3150466.jpg` | `52554edc49ac45ab44d35aca7c23d912` |

Regenerate hashes anytime with `npm run generate-hashes assets/example-real-photos` if the files change.

## Concert Mapping

These photos now ship in both production and test data sets:

| Concert ID | Band Label                   | Image File Path                            |
| ---------- | ---------------------------- | ------------------------------------------ |
| 8          | Ringo Deathstar (R0043343)   | `/assets/example-real-photos/R0043343.jpg` |
| 9          | FANTAAZMA (R0055333)         | `/assets/example-real-photos/R0055333.jpg` |
| 10         | The Tender Things (R0055917) | `/assets/example-real-photos/R0055917.jpg` |
| 11         | Random Band (R0060632)       | `/assets/example-real-photos/R0060632.jpg` |
| 12         | RankyDank (R0060861)         | `/assets/example-real-photos/R0060861.jpg` |
| 25         | White Denim (R0043815)       | `/assets/example-real-photos/R0043815.jpg` |
| 26         | Jo Alice (P3150466)          | `/assets/example-real-photos/P3150466.jpg` |

- **Production**: `public/data.json` now contains the hashes above so the main experience recognizes your printed copies.
- **Dev/Test Mode**: `assets/test-data/concerts.dev.json` and `.csv` include the same entries with `/assets/example-real-photos/...` image paths for on-device previews.

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
