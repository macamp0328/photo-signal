# Audio Workflow

The Photo Signal audio workflow bundles every step required to take a YouTube Music playlist and ship production-ready audio. The process spans four stages:

1. **Download** - pull source audio, metadata, and thumbnails with yt-dlp
2. **Organize** - normalize filenames, tag assets, and prepare folders (planned)
3. **Encode** - convert to final codecs/bitrates and package source masters (planned)
4. **Update** - publish audio to the CDN and validate the resulting URLs

All related scripts live under `scripts/audio-workflow/` so the end-to-end process stays isolated from the rest of the project.

## Directory Structure

```
scripts/audio-workflow/
├── README.md                  # This file
├── download/                  # yt-dlp helpers + config presets
│   ├── download-yt-song.js
│   ├── download-yt-song.config.example.json
│   └── download-yt-song.config.json
├── organize/                  # Future workspace for file cataloging tools
├── encode/                    # Future workspace for transcoding/packaging tools
└── update/                    # CDN migration + validation scripts
    ├── migrate-audio-to-cdn.js
    └── validate-audio-urls.js
```

## Stage 1: Download (Ready)

Run the downloader with:

```bash
npm run download-song -- [flags]
```

Key features:

- Prioritizes `.opus` streams and falls back to `.mp3` automatically (configurable with `--format` or `--format-order`)
- Emits `.metadata.json` index files next to every downloaded track that capture playlist context, yt-dlp `.info.json` data, codec details, and filesystem paths
- Supports cookies, proxies, retries, throttling, and `--update-yt-dlp`
- Loads defaults from `download/download-yt-song.config.json` (edit this file to set playlist URL, output dir, archive path, etc.)
- Uses the `webremix` YouTube client by default; when forcing the `android` or `tv` clients you must also provide `--po-token` (or set it in the config) to satisfy yt-dlp's new PO token requirement

See the [helper script docs](../README.md#audio-workflowdownloaddownload-yt-songjs---download-one-track-with-yt-dlp) for the full option list.

## Stage 2: Organize (Planned)

Placeholder workspace for upcoming utilities that will:

- Inspect newly downloaded metadata indexes
- Normalize filenames/folders for printing sessions
- Generate manifests that tie photo IDs to audio IDs

## Stage 3: Encode (Planned)

Future scripts will live here to:

- Transcode raw downloads into archival and playback-friendly formats
- Apply loudness normalization/limiter chains
- Package assets for long-term storage

## Stage 4: Update (Ready)

Two scripts ship today:

### `update/migrate-audio-to-cdn.js`

```bash
npm run migrate-audio -- [options]
```

- Rewrites `public/data.json` entries to point at GitHub Releases or Cloudflare R2
- Preserves local fallbacks (`audioFileFallback`) and annotates the CDN provider (`audioFileSource`)
- Provides dry-run previews, change summaries, and backups

### `update/validate-audio-urls.js`

```bash
npm run validate-audio -- [options]
```

- Verifies that every `audioFile` (and optional fallback) in `data.json` loads successfully
- Works with both local `/audio/*.mp3` files and remote CDN URLs
- Supports adjustable timeouts plus optional fallback checks

Refer to the corresponding sections inside [scripts/README.md](../README.md) for detailed flag descriptions, sample output, and troubleshooting tips.
