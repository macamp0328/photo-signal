# Audio Streaming Setup Guide

> **Purpose**: This guide explains how to set up and manage audio streaming for Photo Signal using CDN delivery (GitHub Releases or Cloudflare R2).

## Overview

Photo Signal supports streaming audio from a CDN while maintaining local file fallbacks for offline development. This approach enables:

- 🚀 **Scalability**: Support 100+ tracks without bloating the git repository
- 💰 **Cost-Effective**: Free tier options (GitHub Releases or Cloudflare R2)
- ⚡ **Fast Loading**: <1s playback start on fast wifi
- 🔄 **Offline Support**: Automatic fallback to local files when CDN unavailable
- 🤖 **Automation**: Scriptable migration and validation tools

## Quick Start

### 1. Choose Your CDN Provider

**For MVP/Small Libraries (<50 tracks):**

- **GitHub Releases** (Recommended)
- Free unlimited bandwidth for public repos
- 2GB per file limit
- No configuration needed

**For Large Libraries (50+ tracks):**

- **Cloudflare R2**
- 10GB storage free
- No egress fees
- S3-compatible API

### 2. Upload Audio Files to CDN

#### Option A: GitHub Releases (Recommended for MVP)

1. Create a new release:

   ```bash
   # Go to your repository on GitHub
   # Click "Releases" → "Create a new release"
   # Tag: audio-v1
   # Title: Audio Files v1
   ```

2. Upload MP3 files:
   - Drag and drop MP3 files from `public/audio/` directory
   - Or upload via GitHub API (see [Automation](#automation) below)

3. Note the download URL pattern:
   ```
   https://github.com/{username}/{repo}/releases/download/audio-v1/{filename}
   ```

#### Option B: Cloudflare R2

1. Create an R2 bucket:

   ```bash
   # Using Cloudflare dashboard or wrangler CLI
   wrangler r2 bucket create photo-signal-audio
   ```

2. Upload files:

   ```bash
   # Using wrangler
   wrangler r2 object put photo-signal-audio/concert-1.mp3 --file=public/audio/concert-1.mp3

   # Or use the migration script (see below)
   ```

3. Configure public access and CORS:
   - Enable public bucket access in Cloudflare dashboard
   - Add CORS policy to allow your domain

### 3. Migrate data.json

Run the migration script to update `public/data.json` with CDN URLs:

```bash
# Dry run first (preview changes)
npm run migrate-audio -- --dry-run --base-url=https://github.com/username/repo/releases/download/audio-v1

# Apply changes
npm run migrate-audio -- --base-url=https://github.com/username/repo/releases/download/audio-v1
```

This will:

- ✅ Update `audioFile` to CDN URLs
- ✅ Add `audioFileFallback` with local paths
- ✅ Set `audioFileSource` to 'github-release' or 'r2'
- ✅ Create a backup (`data.json.backup`)

### 4. Validate Audio URLs

Check that all audio files are accessible:

```bash
# Check primary URLs only
npm run validate-audio

# Check both primary and fallback URLs
npm run validate-audio -- --check-fallback
```

### 5. Test Locally

Start the dev server and verify audio plays from the CDN:

```bash
npm run dev
```

- Open the app in your browser
- Trigger a photo recognition (or use Test Mode)
- Check browser console for audio loading messages
- Verify audio plays without errors

### 6. Clean Up Git Repository

Once CDN migration is confirmed working:

```bash
# Remove production MP3s from git (keep demo files)
git rm public/audio/my-production-track-*.mp3

# Commit changes
git commit -m "chore: remove production audio files (now on CDN)"

# Update .gitignore to exclude future production files
# (Already configured in .gitignore)
```

## Data Model

### Concert Interface

```typescript
interface Concert {
  id: number;
  band: string;
  venue: string;
  date: string;

  // Primary audio URL (can be local or remote)
  audioFile: string;

  // Optional fallback URL (used when primary fails)
  audioFileFallback?: string;

  // Optional metadata for tracking audio source
  audioFileSource?: 'local' | 'cdn' | 'github-release' | 'r2';

  imageFile?: string;
  photoHash?: string;
}
```

### Example: Local Development

```json
{
  "id": 1,
  "band": "The Midnight Echoes",
  "venue": "The Fillmore",
  "date": "2023-08-15",
  "audioFile": "/audio/concert-1.mp3",
  "photoHash": "00000000000001600acc000000000000"
}
```

### Example: Production with CDN

```json
{
  "id": 1,
  "band": "The Midnight Echoes",
  "venue": "The Fillmore",
  "date": "2023-08-15",
  "audioFile": "https://github.com/username/repo/releases/download/audio-v1/concert-1.mp3",
  "audioFileFallback": "/audio/concert-1.mp3",
  "audioFileSource": "github-release",
  "photoHash": "00000000000001600acc000000000000"
}
```

## Fallback Behavior

The audio playback system automatically handles fallbacks:

1. **Primary URL loads**: Normal playback
2. **Primary URL fails**: Automatically tries `audioFileFallback` (if provided)
3. **Both URLs fail**: Error logged, app continues

This ensures:

- ✅ Production works even if CDN is temporarily down
- ✅ Local development works without CDN
- ✅ Graceful degradation for network issues

## Scripts Reference

### migrate-audio-to-cdn.js

Migrates audio files to CDN and updates `data.json`.

**Usage:**

```bash
npm run migrate-audio -- [options]
```

**Options:**

- `--source=<path>` - Path to data.json (default: `public/data.json`)
- `--cdn=<provider>` - CDN provider: `github-release` | `r2` (default: `github-release`)
- `--base-url=<url>` - Base URL for CDN files (required)
- `--dry-run` - Preview changes without writing files
- `--help` - Show help message

**Examples:**

```bash
# Dry run with GitHub Releases
npm run migrate-audio -- --dry-run --base-url=https://github.com/username/repo/releases/download/audio-v1

# Migrate to GitHub Releases
npm run migrate-audio -- --base-url=https://github.com/username/repo/releases/download/audio-v1

# Migrate to Cloudflare R2
npm run migrate-audio -- --cdn=r2 --base-url=https://audio.example.com
```

### validate-audio-urls.js

Validates that all audio URLs in `data.json` are accessible.

**Usage:**

```bash
npm run validate-audio -- [options]
```

**Options:**

- `--source=<path>` - Path to data.json (default: `public/data.json`)
- `--timeout=<ms>` - Request timeout in milliseconds (default: 10000)
- `--check-fallback` - Also check fallback URLs
- `--help` - Show help message

**Examples:**

```bash
# Validate production data.json
npm run validate-audio

# Validate with fallback URLs
npm run validate-audio -- --check-fallback

# Validate test data
npm run validate-audio -- --source=assets/test-data/concerts.json
```

## Automation

### GitHub Actions Workflow (Optional)

Automate audio uploads on release:

```yaml
name: Upload Audio to GitHub Release

on:
  release:
    types: [published]

jobs:
  upload-audio:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Upload Audio Files
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: ${{ github.event.release.upload_url }}
          asset_path: ./public/audio/*.mp3
          asset_name: audio-files
          asset_content_type: audio/mpeg
```

### Wrangler Upload Script (R2)

Bulk upload to Cloudflare R2:

```bash
#!/bin/bash
# upload-to-r2.sh

BUCKET_NAME="photo-signal-audio"
AUDIO_DIR="public/audio"

for file in $AUDIO_DIR/*.mp3; do
  filename=$(basename "$file")
  echo "Uploading $filename..."
  wrangler r2 object put "$BUCKET_NAME/$filename" --file="$file"
done

echo "Upload complete!"
```

## Cost Analysis

### GitHub Releases (Free Tier)

- **Storage**: Unlimited for public repos
- **Bandwidth**: Unlimited for public repos
- **File Size Limit**: 2GB per file
- **Cost**: $0/month

**Best for**: MVP, small to medium libraries (<500 tracks)

### Cloudflare R2

- **Storage**: 10GB free/month
- **Class A Operations**: 1M free/month (writes)
- **Class B Operations**: 10M free/month (reads)
- **Egress**: Free (no bandwidth charges!)
- **Cost**: $0/month for <200 tracks, ~$0.08/month for 1,000 tracks

**Best for**: Large libraries (50+ tracks), production scale

### Cost Projection

| Tracks | Avg Size | Total Size | GitHub Releases | Cloudflare R2 |
| ------ | -------- | ---------- | --------------- | ------------- |
| 10     | 3MB      | 30MB       | Free            | Free          |
| 50     | 3MB      | 150MB      | Free            | Free          |
| 100    | 3MB      | 300MB      | Free            | Free          |
| 500    | 3MB      | 1.5GB      | Free            | Free          |
| 1,000  | 3MB      | 3GB        | Free            | ~$0.08/month  |

## Troubleshooting

### Audio Doesn't Play

1. **Check browser console** for errors:

   ```
   [Audio] Load error: ...
   [Audio] Failed to load: <url>, fallback: <fallback-url>
   ```

2. **Validate URLs**:

   ```bash
   npm run validate-audio
   ```

3. **Test CDN accessibility**:
   ```bash
   curl -I https://github.com/username/repo/releases/download/audio-v1/concert-1.mp3
   ```

### CORS Errors

If you see CORS errors in console:

**GitHub Releases**: No action needed (CORS enabled by default)

**Cloudflare R2**:

1. Go to R2 bucket settings in Cloudflare dashboard
2. Add CORS policy:
   ```json
   {
     "AllowedOrigins": ["*"],
     "AllowedMethods": ["GET", "HEAD"],
     "AllowedHeaders": ["*"],
     "MaxAgeSeconds": 3600
   }
   ```

### Fallback Not Working

Ensure `audioFileFallback` is set in `data.json`:

```bash
# Check data.json has fallback fields
npm run migrate-audio -- --dry-run --base-url=<your-cdn-url>
```

### Migration Script Errors

**"Error: --base-url is required"**

- Solution: Provide `--base-url` flag with your CDN URL

**"Error: Invalid CDN provider"**

- Solution: Use `--cdn=github-release` or `--cdn=r2`

**"Error: Source file not found"**

- Solution: Check that `public/data.json` exists or specify correct path with `--source`

## Best Practices

### 1. Always Use Dry Run First

```bash
npm run migrate-audio -- --dry-run --base-url=<url>
```

Preview changes before applying them.

### 2. Keep Local Files for Development

Don't delete demo MP3 files (concert-1.mp3, concert-song-1.mp3, etc.) - these are useful for local development and testing.

### 3. Validate After Migration

```bash
npm run validate-audio --check-fallback
```

Ensure both primary and fallback URLs work.

### 4. Use Meaningful Release Tags

For GitHub Releases:

- ✅ `audio-v1`, `audio-v2` (version-based)
- ✅ `audio-2024-11` (date-based)
- ❌ `latest` (not recommended - hard to track)

### 5. Optimize MP3 Files

Before uploading to CDN:

```bash
# Convert to 192kbps VBR (good quality, reasonable size)
ffmpeg -i input.mp3 -codec:a libmp3lame -q:a 2 output.mp3

# Or batch process
for file in public/audio/*.mp3; do
  ffmpeg -i "$file" -codec:a libmp3lame -q:a 2 "optimized/$(basename "$file")"
done
```

**Recommended settings:**

- Bitrate: 192kbps VBR (Variable Bit Rate)
- Sample Rate: 44.1kHz
- Channels: Stereo or Mono (mono for speech)

This reduces file size by ~40% with minimal quality loss.

### 6. Monitor CDN Usage

For Cloudflare R2:

- Check usage in Cloudflare dashboard
- Set up billing alerts
- Monitor bandwidth patterns

For GitHub Releases:

- GitHub doesn't charge for bandwidth on public repos
- Monitor download counts (optional)

## Migration Checklist

Use this checklist when migrating to CDN:

- [ ] Choose CDN provider (GitHub Releases or Cloudflare R2)
- [ ] Upload audio files to CDN
- [ ] Run migration script with `--dry-run` flag
- [ ] Review migration output
- [ ] Run migration script without `--dry-run`
- [ ] Run validation script
- [ ] Test locally with `npm run dev`
- [ ] Verify audio plays in browser
- [ ] Check browser console for errors
- [ ] Test fallback (temporarily disable CDN URL)
- [ ] Remove production MP3s from git (optional)
- [ ] Update .gitignore (already done)
- [ ] Commit changes
- [ ] Deploy to production
- [ ] Verify production audio playback

## Security & Privacy

### Audio File Privacy

**GitHub Releases (Public Repos):**

- ⚠️ Audio files are publicly accessible
- Anyone with the URL can download files
- Not suitable for private/copyrighted content

**Cloudflare R2:**

- ✅ Can be configured for private access
- ✅ Supports signed URLs for time-limited access
- ✅ Better for sensitive content

### CORS Configuration

Both CDN options require CORS to be enabled for browser access:

**GitHub Releases**: Automatic (no configuration needed)

**Cloudflare R2**: Manual configuration required (see Troubleshooting above)

### Content Licensing

Ensure you have proper rights to:

- ✅ Host audio files on CDN
- ✅ Stream audio to end users
- ✅ Use copyrighted music (if applicable)

Consult with legal counsel if unsure.

## See Also

- [Implementation Plan](./mp3-streaming-implementation-plan.md) - Detailed technical plan
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture overview
- [scripts/README.md](../scripts/README.md) - Script documentation
- [DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md) - All documentation

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review [mp3-streaming-implementation-plan.md](./mp3-streaming-implementation-plan.md)
3. Open an issue on GitHub with:
   - Browser console errors
   - Output from `npm run validate-audio`
   - CDN provider and configuration
