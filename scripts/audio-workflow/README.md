# Audio Workflow

The Photo Signal audio workflow bundles every step required to take a YouTube Music playlist and ship production-ready audio. The process spans three stages:

1. **Download** - pull source audio, metadata, and thumbnails with yt-dlp
2. **Organize + Encode** - normalize filenames, link gallery assets, convert to final codecs/bitrates, and package source masters
3. **Update** - publish audio to the CDN and validate the resulting URLs

All related scripts live under `scripts/audio-workflow/` so the end-to-end process stays isolated from the rest of the project.

## Deterministic Clean-Slate Workflow (new)

Use these commands to make the end-to-end pipeline restartable and checkpointed.

```bash
# 1) Reset local generated artifacts
npm run audio:reset

# Optional: also purge uploaded objects from the configured R2 prefix
npm run audio:reset -- --with-r2 --confirm-r2-delete=DELETE

# 2) Run all phases deterministically with checkpoints
npm run audio:clean-slate -- --base-url=https://photo-signal-audio-worker.example.workers.dev

# Fast smoke run (downloads only first 10 songs)
npm run audio:clean-slate:smoke -- --base-url=https://photo-signal-audio-worker.example.workers.dev

# 3) Verify mapping + URL integrity and detect stale placeholders
npm run audio:verify
```

Checkpoint outputs:

- `scripts/audio-workflow/output/clean-slate-reset-report.json`
- `scripts/audio-workflow/output/clean-slate-checkpoints.json`
- `scripts/audio-workflow/output/clean-slate-verify-report.json`

You can also run individual phases via:

- `npm run audio:phase:download`
- `npm run audio:phase:download:smoke`
- `npm run audio:phase:encode`
- `npm run audio:phase:upload`
- `npm run audio:phase:build-data`
- `npm run audio:phase:apply-cdn`
- `npm run audio:phase:validate`

`audio:phase:apply-cdn` is kept as a compatibility alias and currently runs the same behavior as `audio:phase:build-data`.

## Metadata Philosophy: Capture Once, Store Outside

**The workflow captures all metadata exactly once** during the download stage and stores it in `.metadata.json` files. This "single source of truth" approach:

- ✅ **Avoids double work**: No need to re-tag during encoding
- ✅ **Preserves complete data**: Stores the entire yt-dlp payload (`ytInfo` field) with 100+ fields
- ✅ **Keeps containers lean**: Opus files contain minimal tags (title/artist/date/album)
- ✅ **Enables structured data**: Arrays, objects, and URLs that Vorbis comments can't represent
- ✅ **Surfaces rich metadata**: Manifests expose distributor, label, credits, tags, categories

The encode stage reads from `.metadata.json` (never from audio container tags) and generates `audio-index.json` for the web app. **Team members should always look at `.metadata.json` or `audio-index.json` for complete metadata**, not at embedded Opus tags.

## Directory Structure

```
scripts/audio-workflow/
├── README.md                  # This file
├── download/                  # yt-dlp helpers + config presets
│   ├── download-yt-song.js
│   ├── download-yt-song.config.example.json
│   └── download-yt-song.config.json
├── encode/                    # Catalog + transcoding/packaging tools
└── update/                    # CDN migration + validation scripts
    ├── migrate-audio-to-cdn.js
    ├── upload-to-r2.js
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
- Uses deterministic fallback client order by default (`web -> mweb -> ios -> tv`); when forcing the `android` client you must provide `--po-token` (or set it in config)
- Automatically detects the local Node.js 20+ runtime and passes `--js-runtimes` to yt-dlp; override with `--js-runtime` or disable with `--no-js-runtime`

See the [helper script docs](../README.md#audio-workflowdownloaddownload-yt-songjs---download-one-track-with-yt-dlp) for the full option list.

## Stage 2: Organize + Encode (Ready)

The encoding stage is now implemented in `encode/encode-audio.js`. Run it with:

```bash
npm run encode-audio
```

**What it does:**

- Reads `.metadata.json` files from the download stage
- Converts audio to normalized 48kHz stereo WAV
- Applies two-pass loudness normalization (EBU R128 to -14 LUFS)
- Adds configurable fade-in/fade-out effects
- Encodes to Opus format with metadata tags
- Extracts the best source thumbnail and generates a square WebP album cover (`*-cover.webp`)
- Generates manifests: `audio-index.json`, `photo-audio-map.json`, `encode-report.md`
- Calculates SHA256 checksums for integrity verification

See [`encode/README.md`](./encode/README.md) for complete documentation covering:

- Configuration options (LUFS target, bitrate, fades, metadata defaults)
- Command-line usage and examples
- Output file structure and manifests
- Metadata extraction patterns
- Quality assurance guidelines
- Troubleshooting common issues

**Current implementation:**

- ✅ WAV conversion and normalization
- ✅ Loudness measurement and normalization
- ✅ Opus encoding with metadata
- ✅ Manifest generation
- ✅ Checksum calculation
- 🚧 Photo ID linking (placeholder mappings generated, awaiting photo manifest integration)
- 🚧 Gallery-aware folder organization (currently flat output directory)

## Stage 3: Update (Ready)

Three scripts ship today:

### `update/upload-to-r2.js`

```bash
npm run upload-audio -- [options]
```

- Uploads every `.opus`, `.metadata.json`, manifest, and report generated by the encode stage to Cloudflare R2 using the S3-compatible API
- Accepts credentials via environment variables (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT` or `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`) or CLI flags
- Supports optional prefixes (`R2_PREFIX`) so you can keep `prod/` versus `staging/` uploads isolated
- Understands dry runs, extension filters, concurrency limits, and `--skip-existing` (HEAD checks + SHA-256 metadata) for incremental uploads
- Emits public CDN URLs for every freshly uploaded object when `R2_BASE_URL` (or `--base-url`) is provided, making it easy to paste into `data.json`
- Preserves cache headers (`immutable` audio, short-lived JSON/Markdown) and records SHA-256 checksums in object metadata for later validation

Common env var setup (copy `.env.example` to `.env.local` and fill in the secrets, or export manually):

```bash
export R2_ACCESS_KEY_ID="cf_..."
export R2_SECRET_ACCESS_KEY="..."
export R2_ACCOUNT_ID="bfeeec455b3ba60454d4164afa155ddc"
export R2_BUCKET_NAME="photo-signal-audio"
export R2_PREFIX="prod/audio"
export R2_BASE_URL="https://bfeeec455b3ba60454d4164afa155ddc.r2.cloudflarestorage.com/photo-signal-audio"

npm run upload-audio -- --skip-existing

# Or run the helper that auto-loads .env.local
npm run upload-audio:local -- --skip-existing
```

### `update/migrate-audio-to-cdn.js`

```bash
npm run migrate-audio -- [options]
```

- Rewrites `public/data.json` entries to point at GitHub Releases or Cloudflare R2
- Preserves local fallbacks (`audioFileFallback`) and annotates the CDN provider (`audioFileSource`)
- Provides dry-run previews, change summaries, and backups

### `update/apply-cdn-to-data.js`

```bash
npm run apply-cdn-to-data -- --base-url=https://audio.example.com --prefix=prod/audio
```

- Rewrites `audioFile` entries in `public/data.json` to point at a Cloudflare Worker hostname
- Builds paths using `/<prefix>/<concertId>/<filename>` so R2 keys stay organized by photo ID
- Keeps existing `audioFileFallback` values (or sets them from the previous `audioFile`)
- Supports dry runs and automatic backups before writing

### `update/build-data-from-photo-csv.js`

```bash
npm run audio:build-data -- --base-url=https://photo-signal-audio-worker.example.workers.dev --prefix=prod/audio
```

- Builds `public/data.json` from `assets/prod-photographs/prod-photographs-details.csv`
- Also builds `public/data.app.v2.json` (normalized app metadata)
- Also builds `public/data.recognition.v2.json` (recognition hash index)
- Uses `scripts/audio-workflow/encode/output/audio-index.json` as the audio metadata source
- Applies strict band-name matching (exact + curated alias support; conservative fallback)
- Emits stable, reproducible output so all runtime data artifacts can be regenerated deterministically

### `update/validate-audio-urls.js`

```bash
npm run validate-audio -- [options]
```

- Verifies that every `audioFile` (and optional fallback) in `data.json` loads successfully
- Works with both local `/audio/*.mp3` files and remote CDN URLs
- Supports adjustable timeouts plus optional fallback checks

Refer to the corresponding sections inside [scripts/README.md](../README.md) for detailed flag descriptions, sample output, and troubleshooting tips.

## Photo ↔ Audio Mapping Workflow (deterministic, band-based)

Use this flow to keep photo IDs aligned with encoded tracks. It is intentionally CSV-driven so you can edit in Excel and re-run deterministically.

1. **Generate/refresh photo catalog (optional):**
   - Run `npm run create-photo-csv` to rebuild `assets/prod-photographs/prod-photographs-details.csv` from EXIF in `assets/prod-photographs/` (fills `imageFile`, date, camera fields; `band`/`venue`/`songTitle` remain manual).

2. **Run band-only matcher:**
   - `node scripts/audio-workflow/build-photo-audio-map.js`
   - Inputs (defaults): `assets/prod-photographs/prod-photographs-details.csv`, `scripts/audio-workflow/encode/output/audio-index.json`
   - Output: `assets/prod-photographs/photo-audio-map.csv`

3. **Review `photo-audio-map.csv` statuses:**
   - `matched_single`: one photo ↔ one track (ready)
   - `ambiguous_multi_audio`: one photo, multiple tracks with same band — pick an `audioId`
   - `ambiguous_multi_photo`: multiple photos share band — confirm correct `photoId`
   - `ambiguous_multi_both`: multiple photos and tracks — decide pairing
   - `no_audio_match`: photo band not in audio — add song or leave unmapped
   - `no_photo_for_audio`: audio band lacks photo — add photo row
   - `missing_photo_band`: fill `band` in `prod-photographs.csv`

4. **Fix data and re-run:**
   - Edit `assets/prod-photographs/prod-photographs-details.csv` (add/fix `band`, resolve typos, add new photos)
   - Re-run `node scripts/audio-workflow/build-photo-audio-map.js` until ambiguous/missing rows are resolved to your satisfaction.

5. **Build runtime dataset from CSV:**
   - Run `npm run audio:build-data -- --base-url=<worker-url> --prefix=prod/audio` to regenerate:
     - `public/data.json`
     - `public/data.app.v2.json`
     - `public/data.recognition.v2.json`
     deterministically from `prod-photographs-details.csv` + `audio-index.json`.
   - `songTitle` in `public/data.json` is sourced from CSV (`songTitle`) first, then falls back to `audio-index.json` track title.

6. **Regenerate recognition hashes:**
   - Run `npm run hashes:refresh` (or adjust batch size/paths for your environment).
   - Default sync targets are:
     - `public/data.json`
     - `public/data.app.v2.json`
     - `public/data.recognition.v2.json`

7. **Upload and verify:**
   - Upload generated assets: `npm run upload-audio -- --prefix=prod/audio`
   - Verify consistency: `npm run audio:verify`

## Data + Creative Update Runbook

Use this checklist when you need to refresh production data and gallery creative materials.

1. **Prepare source materials**
   - Add/replace final photos in `assets/prod-photographs/`.
   - Add/replace downloaded tracks + `.metadata.json` in `scripts/audio-workflow/download/output/`.

2. **Regenerate photo metadata CSV**

   ```bash
   npm run create-photo-csv
   ```

   - Review `assets/prod-photographs/prod-photographs-details.csv` and update human-entered fields (`band`, `songTitle`, `venue`) as needed.

3. **Run encode stage (audio + album covers)**

   ```bash
   npm run encode-audio
   ```

   - Outputs include `.opus`, `*-cover.webp`, and `audio-index.json` under `scripts/audio-workflow/encode/output/`.

4. **Rebuild app data from CSV + audio index**

   ```bash
   npm run audio:build-data -- --base-url=https://<your-worker-domain> --prefix=prod/audio
   ```

   - This regenerates `public/data.json`, `public/data.app.v2.json`, and `public/data.recognition.v2.json` deterministically.

5. **Refresh recognition hashes in data.json**

   ```bash
   npm run hashes:refresh
   ```

   - Updates recognition hash fields across legacy + v2 artifacts.

6. **Upload CDN assets (audio + covers + manifests)**

   ```bash
   npm run upload-audio -- --prefix=prod/audio --skip-existing
   ```

7. **Validate URL and mapping integrity**

   ```bash
   npm run audio:verify
   npm run validate-audio
   ```

8. **Final quality gate before PR/merge**

   ```bash
   npm run pre-commit
   ```
