# Public Assets

This directory contains static assets served directly by Vite.

## Contents

### Favicon Files

The following favicon files are required for the site to display properly across all devices and browsers:

- **`favicon.svg`** ✅ - SVG favicon (modern browsers)
- **`favicon-16x16.png`** ⚠️ - 16×16 px favicon (legacy browsers)
- **`favicon-32x32.png`** ⚠️ - 32×32 px favicon (standard)
- **`apple-touch-icon.png`** ⚠️ - 180×180 px iOS home screen icon
- **`android-chrome-192x192.png`** ⚠️ - 192×192 px Android icon
- **`android-chrome-512x512.png`** ⚠️ - 512×512 px Android icon (high res)
- **`site.webmanifest`** ✅ - Web app manifest (PWA support)
- **`og-image.svg`** ✅ - Open Graph / social media share image

### Generating Missing PNG Favicons

To generate the PNG favicon files marked with ⚠️:

1. Open `scripts/generate-favicons.html` in your browser
2. Click "Generate All Favicons"
3. Download each PNG file
4. Place them in this `public/` directory

See [scripts/README.md](../scripts/README.md#generate-faviconshtml---generate-favicon-images) for detailed instructions.

### Audio Files

Audio files are stored in the `audio/` subdirectory. See [audio/README.md](./audio/README.md).

### Data Files

- **`data.json`** - Concert metadata (band, venue, date, audio file paths)

### Other Assets

- **`vite.svg`** - Original Vite logo (can be removed)
- **`backgrounds/`** - Background images/videos (optional)

## File Size Guidelines

To maintain fast load times:

- **Favicons**: PNGs should be compressed (use TinyPNG or similar)
- **Open Graph image**: Should be < 300 KB for social media compatibility
- **Audio files**: MP3 format, target < 5 MB per file
- **Background images**: WebP format preferred, < 500 KB

## Notes

- All files in this directory are publicly accessible
- Paths are relative to the domain root (e.g., `/favicon.svg`)
- Files are not processed by Vite (served as-is)
- Use `public/` for assets referenced in HTML or that need stable URLs
