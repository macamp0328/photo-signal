# Organize + Encode Stage

This combined stage ingests the raw downloads gathered in `scripts/audio-workflow/download/`, organizes them into gallery-aware folders, and produces production-ready audio masters for the `update/` phase. The guiding intent is to make every track behave identically in the browser—levels, tags, filenames, manifests, and photo IDs should be deterministic so the site can stream ~100 songs without surprises.

## Metadata Philosophy: Read from JSON, Embed Minimally

**The encode stage reads all metadata from `.metadata.json` files**, not from audio container tags. This follows the "capture once, store outside" principle:

- **Source of truth**: `.metadata.json` contains structured data (`ytInfo` with complete yt-dlp payload)
- **Opus files stay lean**: Only essential tags (title, artist, album, date) are embedded for media player compatibility
- **Rich data in manifests**: `audio-index.json` exposes full metadata (genre, credits, tags, categories, distributor, label) sourced from `.metadata.json`
- **No container parsing**: Encode stage never calls ffprobe to extract tags from input Opus files

This approach avoids double work, prevents metadata bloat, and preserves structured data (arrays, objects, URLs) that Vorbis comments can't represent.

## Quick Start

```bash
# Encode all downloads in the default directory
npm run encode-audio

# Encode with custom input directory
npm run encode-audio -- --input-dir ~/Downloads/music

# Preview what would be encoded (dry run)
npm run encode-audio -- --dry-run

# Show all options
npm run encode-audio -- --help
```

## Prerequisites

- **ffmpeg** ≥ 6.0 (includes ffprobe and libopus)
- **Node.js** 20+ (project requirement)
- Downloaded audio files from the download stage with `.metadata.json` files

The script will check for ffmpeg/ffprobe automatically and exit with instructions if not found. Use `--skip-prereq-check` to bypass this check.

## Goals

- All files exported as **Opus (.opus)** using a shared bitrate/complexity profile
- Honor the **source bitrate** so encodes never exceed the configured ceiling (160 kbps) and never dip below 96 kbps unless the source truly is that low
- Consistent **perceived loudness** so back-to-back playback never forces the listener to adjust volume
- Predictable **filenames, metadata tags, and directory layout** for direct use by the website
- Automated **report/index** describing every encoded asset (duration, LUFS, checksum, CDN path, etc.)
- Repeatable tooling that can be re-run whenever a song is re-mastered or new material is added

## Inputs & Outputs

| Item              | Description                                                                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input directory   | `scripts/audio-workflow/download/output/` (or whatever `download-yt-song.js` uses). Expect mixed file types (MP3, FLAC, WAV) plus `.metadata.json`. |
| Photo map         | `assets/example-real-photos/index.json` (or similar) describing printed photo IDs, captions, and gallery order.                                     |
| Config            | `encode.config.json` (planned) covering target LUFS, Opus quality, fades, metadata defaults, filename templates, and gallery mapping rules.         |
| Working directory | `scripts/audio-workflow/encode/work/` temporary space for normalized WAVs, gain logs, and QA artifacts.                                             |
| Output directory  | `scripts/audio-workflow/encode/output/` with one subfolder per track containing `.opus`, intermediate `.wav`, QC logs, and checksum file.           |
| Manifest          | `scripts/audio-workflow/encode/audio-index.json` plus optional CSV/Markdown for humans + `photo-audio-map.json` linking gallery IDs to audio IDs.   |

## Toolchain (suggested)

- `ffmpeg` ≥ 6.0 for decoding, normalization (`loudnorm` filter), tagging, fades
- `opusenc` (libopus) if we want more control than ffmpeg’s built-in encoder
- `loudgain` or `ffmpeg` two-pass loudnorm for EBU R128 compliance
- `ffprobe` for duration/BPM/sample-rate inspection
- `node` scripts for orchestration + manifest + gallery mapping

## Organization Responsibilities

Before any encoding happens, every download should be normalized into a consistent filesystem/object model:

- **Folder layout**: `organize.js` (future) moves each raw download under `work/<band>/<date>/source.*` and copies the yt-dlp `.metadata.json` alongside.
- **Canonical filenames**: Derive `slug = <YYYYMMDD>-<band>-<venue>` once and reuse for intermediate WAV, final Opus, and manifest IDs.
- **Photo linking**: Cross-reference the slug (or explicit playlist index) against the printed photo manifest so each track has a `photoId`, `frameLocation`, and `qrCodeId` stored in the metadata file before encode starts.
- **Completion checklist**: Emit a Markdown/CSV summary flagging missing assets (no photo yet, needs re-record, metadata incomplete). The encode script reads this output and skips anything not marked `status=ready`.

Retiring the standalone `organize/` scripts keeps the workflow linear—run one command, get both catalog + masters.

## Processing Pipeline

1. **Inventory & checksum**
   - Scan the download directory, denormalize file metadata (band, venue, date) from the source manifest and photo map.
   - Compute SHA256 on source to detect later drift.
2. **Photo + gallery alignment**
   - Attach `photoId`, `frameNumber`, and `wallPosition` from the gallery manifest; verify every photo referenced actually has audio.
   - Generate `organize-report.md` showing missing links or duplicates.
3. **Pre-flight validation**
   - Reject files with sample rate < 44.1 kHz, mono sources, or DR (dynamic range) below configurable threshold.
   - Log warnings for clipping detected via `ffmpeg volumedetect`.
4. **Intermediate WAV render**
   - `ffmpeg -i input -ar 48000 -ac 2 -sample_fmt s32` → `.wav` ensures a clean baseline before normalization.
5. **Loudness normalization (double pass)**
   - Pass 1: `ffmpeg -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json` capture measured stats.
   - Pass 2: re-run with `loudnorm` using `measured_*` values for true peak safe normalization.
   - Store LUFS/TPL/LRA metrics in the manifest.
6. **Optional tails/fades**
   - Apply configurable fade-in/out durations to mask hard edits: `afade=t=in:ss=0:d=0.5` and `afade=t=out:st=duration-1.0:d=1.0`.
7. **Opus encoding**
   - `opusenc --bitrate <config.bitrateKbps> --comp 10 normalized.wav track.opus` or equivalent ffmpeg command.
   - Keep peak observed bitrate in report for budgeting.
8. **Metadata tagging**
   - Apply ID tags using ffmpeg `-metadata` flags. Required fields listed below. Include `PHOTO_ID` custom tag for gallery linkage.
9. **File naming & structure**

- Rename to `ps-<band-slug>-<track-slug>-<album-slug>.opus` (see naming spec) and store under `output/<photoId>/` for easy gallery sync.

10. **Manifest + QC report**
    - Write/update `audio-index.json` with per-track object and link to CDN-ready path.
    - Emit `photo-audio-map.json` summarizing 1:1 relationships for gallery UI.
    - Generate Markdown report summarizing stats, warnings, and TODOs for re-runs.

## Bitrate Guardrails

- `opus.bitrateKbps` in `encode.config.json` is treated as a **ceiling** (default 160 kbps).
- Each track inspects the source bitrate from `.metadata.json` (and falls back to `ffprobe`) to avoid upsampling.
- A configurable `opus.minBitrateFloorKbps` (default 96) prevents the encoder from dipping below transparent bitrates unless the source truly is lower.
- The CLI now prints both the detected source bitrate and the chosen target per track, and `audio-index.json` stores both values for auditing.

### Verifying a Track

After encoding, confirm the manifest and the file agree:

```bash
ffprobe -v error -select_streams a:0 -show_entries stream=bit_rate -of default=noprint_wrappers=1:nokey=1 scripts/audio-workflow/encode/output/ps-<slug>.opus
```

Divide the printed value by 1000 to get kbps (e.g. `124500` → `124.5 kbps`) and compare it to `audio-index.json -> tracks[].bitrateKbps`. Record these spot checks in PR notes for manual verification.

## Configuration Sketch

```json
{
  "targetLUFS": -14,
  "truePeakLimit": -1.5,
  "lraTarget": 11,
  "opus": {
    "bitrateKbps": 160,
    "minBitrateFloorKbps": 96,
    "complexity": 10,
    "frameSizeMs": 20
  },
  "fades": {
    "fadeInSeconds": 0.5,
    "fadeOutSeconds": 1.0
  },
  "metadataDefaults": {
    "album": "Photo Signal Playlist",
    "genre": "Live Recording",
    "copyright": "Photo Signal"
  }
}
```

The orchestration script should read this config once and pass values into every ffmpeg/opusenc call so rerunning the stage with altered targets is trivial.

## Naming Convention

Pattern: `ps-<band>-<track>-<album>.opus`

- Lowercase, ASCII-only, hyphen separators
- Slugify band name, track title, and album (spaces → hyphen, punctuation stripped)
- Missing segments are skipped automatically; if everything is missing the slug falls back to `unknown-track`
- Store file under `output/<photoId>/ps-<...>.opus` to keep gallery mapping obvious.

Example: `ps-20190814-car-seat-headrest-bowery-ballroom.opus`

## Metadata Requirements

### What Gets Embedded in Opus Files (Minimal)

The encode stage embeds **only essential tags** for media player compatibility:

| Tag         | Source                                         |
| ----------- | ---------------------------------------------- |
| `title`     | `<Band> — <Venue> (<Date>)`                    |
| `artist`    | Band name                                      |
| `album`     | Config default or per-track override           |
| `date`      | ISO date string (YYYY-MM-DD)                   |
| `genre`     | Derived from tags/categories or config default |
| `publisher` | Record label (if available)                    |
| `label`     | Distributor (if available)                     |
| `comment`   | "Encoded for Photo Signal"                     |
| `copyright` | Config default (e.g., "Photo Signal")          |
| `website`   | `https://photosignal.app` (ensures provenance) |

**Why so minimal?** Opus files are meant to be lean and portable. Rich metadata lives in `audio-index.json` where the web app can access it efficiently.

### What Lives in audio-index.json (Rich Metadata)

The `audio-index.json` manifest contains **all metadata** sourced from `.metadata.json`:

- **Basic info**: id, band, album, date, releaseDate
- **Music metadata**: genre, recordLabel, distributor
- **Structured data**: tags (array), categories (array), credits (object)
- **Audio specs**: durationMs, bitrateKbps, sourceBitrateKbps, sampleRate
- **Quality metrics**: lufsIntegrated, truePeakDb, lra
- **File info**: fileName, checksum

Example entry:

```json
{
  "id": "20230815-the-midnight-echoes-the-fillmore",
  "band": "The Midnight Echoes",
  "album": "Live at The Fillmore",
  "date": "2023-08-15",
  "releaseDate": "2023-08-20",
  "genre": "Indie Rock",
  "recordLabel": "Indie Records",
  "distributor": "DistroKid",
  "tags": ["indie", "rock", "live", "2023"],
  "categories": ["Music"],
  "credits": {
    "Producer": ["John Smith"],
    "Composer": ["Jane Doe", "The Midnight Echoes"]
  },
  "durationMs": 245000,
  "bitrateKbps": 128,
  "sourceBitrateKbps": 125,
  "sourceBitrateSource": "metadata",
  "sampleRate": 48000,
  "lufsIntegrated": -14.1,
  "truePeakDb": -1.3,
  "lra": 10.8,
  "fileName": "ps-20230815-the-midnight-echoes-the-fillmore.opus",
  "checksum": "a1b2c3d4e5f6..."
}
```

### Reading Metadata from .metadata.json

The encode stage demonstrates how to extract rich metadata from the `ytInfo` field:

```javascript
// Load metadata
const metadata = JSON.parse(readFileSync('track.metadata.json', 'utf-8'));
const ytInfo = metadata?.ytInfo ?? {};

// Extract distributor from description
const description = ytInfo.description ?? '';
const distributorMatch = description.match(/^Provided to YouTube by\s+(.+)$/im);
const distributor = distributorMatch?.[1]?.trim() ?? null;

// Extract record label
const labelMatch = description.match(/^℗\s*(.+)$/m);
const recordLabel = labelMatch?.[1]?.trim() ?? null;

// Get all tags
const tags = Array.isArray(ytInfo.tags) ? ytInfo.tags : [];

// Parse credits from description lines like "Producer: John Smith"
const credits = {};
description.split(/\r?\n/).forEach((line) => {
  const match = line.match(/^([^:]+):\s*(.+)$/);
  if (match) {
    const [, role, name] = match;
    if (!credits[role]) credits[role] = [];
    credits[role].push(name.trim());
  }
});
```

**Key principle**: The encode stage never extracts metadata from the downloaded Opus container. It reads exclusively from `.metadata.json` (which contains the complete `ytInfo` payload from yt-dlp).

### Legacy: Why We Stopped Using --add-metadata

The old workflow would:

1. ❌ Run yt-dlp with `--add-metadata` to inject tags into downloaded Opus
2. ❌ Run ffprobe during encode to extract those tags back out
3. ❌ Re-tag the normalized master with updated metadata
4. ❌ Result: double work, bloated containers, lost structured data

The new workflow:

1. ✅ yt-dlp captures complete metadata into `.info.json`
2. ✅ Download stage copies entire payload to `.metadata.json` (`ytInfo` field)
3. ✅ Encode stage reads JSON, embeds minimal tags
4. ✅ Result: single source of truth, lean containers, preserved structure

### Music Metadata Enrichment

- The encoder inspects YouTube Music descriptions for `Provided to YouTube by ...` and `℗ ...` lines so each manifest entry now exposes the **distributor** and **record label** when available.
- Auto-generated credits (Producer, Composer, Main Artist, etc.) are captured under a `credits` object in `audio-index.json` for downstream UIs.
- `genre` is derived from explicit metadata, playlist categories, or recognizable keywords (indie, funk, cumbia, etc.) with a fallback to the config default, and is also written into the Opus Vorbis comments.
- Manifest entries now include `tags` and `categories` arrays sourced from the download metadata so curators can build filters without re-scraping the source files.

## Report / Index Contents

Each entry in `audio-index.json` should include:

- `id`: slugified identifier matching filename
- `band`, `venue`, `date`
- `photoId`, `photoPanel`, `galleryPosition`
- `durationMs`, `bitrateKbps` (actual encode), `sourceBitrateKbps` (detected), `sampleRate`
- `lufsIntegrated`, `truePeakDb`, `lra`
- `checksum` (SHA256 of final `.opus`)
- `cdnPath` (future upload destination)
- `notes` array for QC warnings (clipping, missing metadata)

Keep the manifest sorted by date so consumers can diff easily. Consider generating a Markdown summary for humans plus CSV for spreadsheets.

## Quality Assurance Checklist

- [ ] No clipping detected after normalization (`truePeak` < target)
- [ ] LUFS within ±0.3 of configured target
- [ ] Metadata fields populated (no `unknown` unless truly missing) and include `PHOTO_ID`
- [ ] Filename matches naming spec and is unique + stored under correct photo folder
- [ ] Spot-check encode bitrate via `ffprobe` and confirm it matches `audio-index.json`
- [ ] Opus file size + duration stored in manifest
- [ ] Checksums verified
- [ ] Report generated with zero "blocking" warnings

## Future Enhancements

- Batch parallelization using worker pool (ffmpeg is CPU-heavy)
- Built-in comparison tool to detect when a source file changed and only re-encode delta
- Optional stem export / multichannel support
- Visual LUFS trend graphs per track to spot outliers before deployment

Once this stage completes, the `update/` scripts can trust that every asset is ready for CDN upload with zero additional processing.

## Implementation Status

✅ **Implemented** (Current Version)

The `encode-audio.js` script implements the core encoding pipeline:

1. **✅ File Discovery**: Scans download directory for `.metadata.json` files
2. **✅ WAV Conversion**: Converts source audio to 48kHz stereo WAV
3. **✅ Loudness Measurement**: Two-pass loudnorm analysis (EBU R128)
4. **✅ Loudness Normalization**: Applies measured values for accurate normalization
5. **✅ Fade Effects**: Configurable fade-in/fade-out
6. **✅ Opus Encoding**: High-quality Opus output with configurable bitrate
7. **✅ Metadata Tagging**: Artist, title, album, date, venue, copyright, website
8. **✅ Checksums**: SHA256 hashing for file integrity
9. **✅ Manifests**: Generates `audio-index.json`, `photo-audio-map.json`, and `encode-report.md`

🚧 **Partial / Future Work**

- **Photo ID Linking**: Currently generates placeholder mappings. Requires photo manifest integration.
- **Gallery Organization**: Files are currently flat in output directory. Future: organize by photoId subdirectories.
- **Advanced Metadata Extraction**: Date/venue extraction uses heuristics. Consider structured metadata input.
- **Parallel Processing**: Currently sequential. Consider worker pool for batch jobs.

## Usage Guide

### Basic Usage

```bash
# Process all downloads in default location
npm run encode-audio
```

The script will:

1. Look for `.metadata.json` files in the input directory (default: `../download/output`)
2. Process each audio file through the full pipeline
3. Save encoded `.opus` files to output directory (default: `./output`)
4. Generate manifests and reports

### Configuration

Edit `scripts/audio-workflow/encode/encode.config.json`:

```json
{
  "targetLUFS": -14, // Target integrated loudness
  "truePeakLimit": -1.5, // Maximum true peak (dB)
  "lraTarget": 11, // Loudness range target
  "opus": {
    "bitrateKbps": 160, // Opus bitrate
    "minBitrateFloorKbps": 96, // Lowest bitrate we’ll use unless the source is lower
    "complexity": 10, // Encoding complexity (0-10)
    "frameSizeMs": 20 // Frame duration
  },
  "fades": {
    "fadeInSeconds": 0.5, // Fade-in duration
    "fadeOutSeconds": 1.0 // Fade-out duration
  },
  "metadataDefaults": {
    "album": "Photo Signal Playlist",
    "genre": "Live Recording",
    "copyright": "Photo Signal",
    "website": "https://photosignal.app"
  }
}
```

### Command-Line Options

```bash
# Custom input directory
npm run encode-audio -- --input-dir ~/Music/downloads

# Custom output directory
npm run encode-audio -- --output-dir ~/Music/encoded

# Custom work directory (for temporary files)
npm run encode-audio -- --work-dir /tmp/audio-work

# Custom config file
npm run encode-audio -- --config ./my-encode-config.json

# Dry run (preview without encoding)
npm run encode-audio -- --dry-run

# Skip prerequisite checks
npm run encode-audio -- --skip-prereq-check
```

### Output Files

After encoding, you'll find:

```
scripts/audio-workflow/encode/output/
├── ps-20230815-the-midnight-echoes-the-fillmore.opus
├── ps-20230922-electric-dreams-red-rocks-amphitheatre.opus
├── audio-index.json          # Machine-readable track index
├── photo-audio-map.json      # Photo-to-audio mapping (placeholder)
└── encode-report.md          # Human-readable summary
```

### Metadata Extraction

The script extracts metadata from the download `.metadata.json` files:

- **Band/Artist**: From `track.artist` or `track.uploader`
- **Title**: From `track.title`
- **Date**: Extracted from title/description (heuristic pattern matching)
- **Venue**: Extracted from title (common patterns: "@ Venue" or "- Venue")

For best results, ensure your YouTube track titles follow standard concert naming:

- `Artist @ Venue (YYYY-MM-DD)`
- `Artist - Venue, Date`

### Metadata Overrides

If heuristics still can’t find the right date or venue, provide a small override file and point the script at it:

```bash
npm run encode-audio -- --metadata-overrides ./scripts/audio-workflow/encode/metadata-overrides.json
```

The JSON supports lookup by YouTube `track.id` or by downloaded filename. Copy `metadata-overrides.example.json`, drop it next to the script, and fill in fields like `venue`, `date`, `band`, or a nested `track` object. Overrides merge into the parsed metadata before slug generation, so the encode stage—and the resulting manifests—pick up your curated values automatically.

### Quality Assurance

The generated `encode-report.md` includes:

- Summary statistics (total, successful, failed)
- Per-track details (LUFS, duration, checksum)
- Quality checklist for manual verification

The `audio-index.json` provides programmatic access:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2024-...",
  "config": {
    "targetLUFS": -14,
    "truePeakLimit": -1.5,
    "opusBitrate": 160
  },
  "tracks": [
    {
      "id": "20230815-the-midnight-echoes-the-fillmore",
      "band": "The Midnight Echoes",
      "venue": "The Fillmore",
      "date": "2023-08-15",
      "durationMs": 245000,
      "bitrateKbps": 160,
      "sourceBitrateKbps": 125,
      "sampleRate": 48000,
      "lufsIntegrated": -14.1,
      "truePeakDb": -1.3,
      "lra": 10.8,
      "checksum": "a1b2c3...",
      "fileName": "ps-20230815-the-midnight-echoes-the-fillmore.opus",
      "cdnPath": null
    }
  ]
}
```

### Workflow Integration

Complete audio workflow:

```bash
# 1. Download audio from YouTube Music
npm run download-song -- --item 1

# 2. Encode downloaded audio
npm run encode-audio

# 3. Upload to CDN (future: will read from audio-index.json)
npm run upload-audio  # Not yet implemented

# 4. Validate uploaded URLs
npm run validate-audio
```

### Troubleshooting

**"ffmpeg is not installed"**

- Install ffmpeg: `brew install ffmpeg` (Mac), `apt install ffmpeg` (Ubuntu)
- Verify: `ffmpeg -version`

**"No downloads found in input directory"**

- Run download script first: `npm run download-song`
- Check input directory path in config or use `--input-dir`
- Ensure `.metadata.json` files exist alongside audio files

**"Failed to extract loudness stats"**

- Check that input audio file is valid (not corrupted)
- Verify ffmpeg has libopus support: `ffmpeg -codecs | grep opus`

**Processing is slow**

- Normal for high-quality encoding (2-pass loudnorm + Opus complexity 10)
- Future enhancement: parallel processing
- Consider reducing `complexity` in config for faster encoding

### Example Output

```
🎵 Audio Encode Script

Configuration:
  Input:  /path/to/downloads
  Output: /path/to/output
  Work:   /path/to/work
  Target LUFS: -14
  Opus bitrate: 160 kbps

Found 3 download(s) to process

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

  ✓ Audio index: /path/to/output/audio-index.json
  ✓ Photo-audio map: /path/to/output/photo-audio-map.json
  ✓ Report: /path/to/output/encode-report.md
✅ Manifests generated

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Summary:
  Total:      3
  Successful: 3
  Failed:     0

✅ All files processed successfully!
```
