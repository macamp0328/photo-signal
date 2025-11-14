# Test Images

This directory contains sample JPEG images for testing photo recognition and display functionality.

## Files

- `concert-1.jpg` - Test image for "The Midnight Echoes" concert (37KB)
- `concert-2.jpg` - Test image for "Electric Dreams" concert (31KB)
- `concert-3.jpg` - Test image for "Velvet Revolution" concert (29KB)
- `concert-4.jpg` - Test image for "Sunset Boulevard" concert (27KB)
- `easy-target-bullseye.png` - High-contrast bullseye with layered rings (generated via canvas)
- `easy-target-diagonals.png` - Bold diagonal bands with text overlay
- `easy-target-checker.png` - Checkerboard grid with central label

## License

All images in this directory are generated test files created specifically for this project and are released under CC0 (Public Domain). See [ASSET_LICENSES.md](../../ASSET_LICENSES.md) for details.

## Purpose

These images are used for:

- Testing photo recognition logic
- Testing camera view and overlay display
- Module-level testing of image processing features
- Development without requiring real concert photos

## Specifications

- **Formats**: JPEG + PNG
- **Dimensions**: 640x480 pixels
- **Size**: ~30KB average per file
- **Color Space**: RGB
- **Easy targets**: Generated programmatically with `npm run create-easy-images`
