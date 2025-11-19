# Audio Encode Script Testing Guide

This document provides instructions for testing the audio encode script with real downloads.

## Prerequisites

Install ffmpeg (required for encoding):

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows (with Chocolatey)
choco install ffmpeg

# Verify installation
ffmpeg -version
ffprobe -version
```

## Test Workflow

### 1. Download Sample Audio

First, download a track using the download script:

```bash
# Download track #1 from the default playlist
npm run download-song -- --item 1
```

This will create files in `downloads/yt-music/`:

- `01 - Track Title.opus` (or `.mp3`)
- `01 - Track Title.opus.metadata.json`

### 2. Verify Download Output

Check that the metadata file was created:

```bash
# List download output
ls -lh downloads/yt-music/

# View metadata
cat downloads/yt-music/*.metadata.json | jq .
```

The metadata file should contain:

- `playlist` info (URL, index, title)
- `track` info (title, artist, duration)
- `download` info (filePath, codec, bitrate)

### 3. Run the Encode Script

Process the downloaded file:

```bash
# Encode with default settings
npm run encode-audio -- --input-dir downloads/yt-music

# Or with custom output directory
npm run encode-audio -- \
  --input-dir downloads/yt-music \
  --output-dir encoded-output
```

### 4. Verify Encoded Output

Check the output directory:

```bash
# List encoded files
ls -lh scripts/audio-workflow/encode/output/

# Should contain:
# - ps-YYYYMMDD-band-name-venue-name.opus
# - audio-index.json
# - photo-audio-map.json
# - encode-report.md
```

### 5. Inspect the Manifests

**audio-index.json** - Track database:

```bash
cat scripts/audio-workflow/encode/output/audio-index.json | jq .
```

Should include:

- `config`: Encoding parameters used
- `tracks[]`: Array of track objects with:
  - `id`, `band`, `venue`, `date`
  - `durationMs`, `bitrateKbps`, `sampleRate`
  - `lufsIntegrated`, `truePeakDb`, `lra`
  - `checksum`, `fileName`

**encode-report.md** - Human-readable summary:

```bash
cat scripts/audio-workflow/encode/output/encode-report.md
```

Should include:

- Summary statistics
- Table of successful encodings with LUFS values
- Quality checklist

### 6. Verify Audio Quality

Test the encoded Opus file:

```bash
# Play the encoded file (macOS)
afplay scripts/audio-workflow/encode/output/ps-*.opus

# Or use ffplay (cross-platform)
ffplay scripts/audio-workflow/encode/output/ps-*.opus

# Inspect audio properties
ffprobe -hide_banner \
  scripts/audio-workflow/encode/output/ps-*.opus
```

Check for:

- ✅ Opus codec
- ✅ 48000 Hz sample rate
- ✅ Stereo (2 channels)
- ✅ ~160 kbps bitrate
- ✅ Metadata tags (title, artist, album, etc.)

### 7. Verify Loudness Normalization

Check LUFS values in the report:

```bash
grep "LUFS" scripts/audio-workflow/encode/output/encode-report.md
```

Expected: Values should be close to -14.0 LUFS (within ±0.3)

### 8. Verify Checksums

Verify file integrity:

```bash
# Get checksum from manifest
CHECKSUM=$(jq -r '.tracks[0].checksum' \
  scripts/audio-workflow/encode/output/audio-index.json)

# Calculate actual checksum
sha256sum scripts/audio-workflow/encode/output/ps-*.opus

# Compare values
echo "Expected: $CHECKSUM"
```

## Dry Run Testing

Test without actually encoding:

```bash
npm run encode-audio -- --dry-run
```

This will:

- ✅ Find all downloads
- ✅ Extract metadata
- ✅ Generate slugs and filenames
- ✅ Show what would be processed
- ❌ Skip actual encoding
- ❌ Skip manifest generation

## Batch Processing Test

Download and encode multiple tracks:

```bash
# Download tracks 1-3
for i in 1 2 3; do
  npm run download-song -- --item $i
done

# Encode all at once
npm run encode-audio
```

The script will:

- Process all `.metadata.json` files found
- Encode each track sequentially
- Generate combined manifests
- Report success/failure for each

## Troubleshooting Tests

### Test: Missing ffmpeg

```bash
npm run encode-audio -- --skip-prereq-check
```

Should fail with clear error about missing ffmpeg.

### Test: Empty Input Directory

```bash
npm run encode-audio -- --input-dir /tmp/empty
```

Should warn: "No downloads found in input directory."

### Test: Invalid Metadata

Create a broken metadata file and verify error handling.

### Test: Corrupted Audio

Provide an invalid audio file and verify graceful failure.

## Expected Output Example

```
🎵 Audio Encode Script

Configuration:
  Input:  downloads/yt-music
  Output: scripts/audio-workflow/encode/output
  Work:   scripts/audio-workflow/encode/work
  Target LUFS: -14
  Opus bitrate: 160 kbps

Found 1 download(s) to process

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Processing: 01 - The Midnight Echoes @ The Fillmore.opus

  Band:  The Midnight Echoes
  Title: The Midnight Echoes @ The Fillmore
  Date:  2023-08-15
  Venue: The Fillmore
  Slug:  20230815-the-midnight-echoes-the-fillmore

  1. Converting to WAV...
  2. Measuring loudness...
     Integrated: -16.2 LUFS
     True Peak:  -0.8 dB
  3. Normalizing loudness...
  4. Applying fades...
  5. Encoding to Opus...
  6. Calculating checksum...
  7. Cleaning up...
✅ Successfully processed: ps-20230815-the-midnight-echoes-the-fillmore.opus

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generating manifests...

  ✓ Audio index: .../output/audio-index.json
  ✓ Photo-audio map: .../output/photo-audio-map.json
  ✓ Report: .../output/encode-report.md
✅ Manifests generated

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Summary:
  Total:      1
  Successful: 1
  Failed:     0

✅ All files processed successfully!
```

## Performance Benchmarks

Expected processing time per track:

- Short track (2-3 min): ~15-30 seconds
- Long track (5+ min): ~45-90 seconds

Factors affecting speed:

- CPU speed (loudnorm and Opus encoding are CPU-intensive)
- Input file format (some codecs decode faster)
- Complexity setting (10 = slowest/best quality)

## Integration Tests

### Full Workflow Test

```bash
# 1. Clean slate
rm -rf downloads/yt-music/*
rm -rf scripts/audio-workflow/encode/output/*

# 2. Download
npm run download-song -- --item 1

# 3. Encode
npm run encode-audio

# 4. Verify manifests exist
test -f scripts/audio-workflow/encode/output/audio-index.json
test -f scripts/audio-workflow/encode/output/photo-audio-map.json
test -f scripts/audio-workflow/encode/output/encode-report.md

# 5. Verify at least one Opus file exists
ls scripts/audio-workflow/encode/output/ps-*.opus

echo "✅ Full workflow test passed!"
```

### Multiple Formats Test

Download tracks in different formats and verify they all encode correctly:

```bash
# Download opus
npm run download-song -- --item 1 --format opus

# Download mp3
npm run download-song -- --item 2 --format mp3

# Encode both
npm run encode-audio

# Verify both tracks in manifest
jq '.tracks | length' scripts/audio-workflow/encode/output/audio-index.json
# Should output: 2
```

## Quality Assurance Checklist

After encoding, manually verify:

- [ ] Files are named according to convention: `ps-YYYYMMDD-band-venue.opus`
- [ ] All files play without errors
- [ ] LUFS values are within -14.3 to -13.7 range
- [ ] True peak values are below -1.5 dB
- [ ] Metadata tags are present and correct (artist, title, album, date, venue)
- [ ] Checksums in manifest match actual files
- [ ] Encode report shows 100% success rate
- [ ] No warnings in script output (except for missing photo IDs - expected)

## Cleanup

After testing:

```bash
# Remove test outputs
rm -rf scripts/audio-workflow/encode/output/*
rm -rf scripts/audio-workflow/encode/work/*

# Optionally remove downloads
rm -rf downloads/yt-music/*
```
