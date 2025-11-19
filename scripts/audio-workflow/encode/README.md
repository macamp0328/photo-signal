# Organize + Encode Stage

This combined stage ingests the raw downloads gathered in `scripts/audio-workflow/download/`, organizes them into gallery-aware folders, and produces production-ready audio masters for the `update/` phase. The guiding intent is to make every track behave identically in the browser—levels, tags, filenames, manifests, and photo IDs should be deterministic so the site can stream ~100 songs without surprises.

## Goals

- All files exported as **Opus (.opus)** using a shared bitrate/complexity profile
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
   - Rename to `ps-<year><month><day>-<band-slug>-<venue-slug>.opus` (see naming spec) and store under `output/<photoId>/` for easy gallery sync.
10. **Manifest + QC report**
    - Write/update `audio-index.json` with per-track object and link to CDN-ready path.
    - Emit `photo-audio-map.json` summarizing 1:1 relationships for gallery UI.
    - Generate Markdown report summarizing stats, warnings, and TODOs for re-runs.

## Configuration Sketch

```json
{
  "targetLUFS": -14,
  "truePeakLimit": -1.5,
  "lraTarget": 11,
  "opus": {
    "bitrateKbps": 160,
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

Pattern: `ps-<YYYYMMDD>-<band>-<venue>.opus`

- Lowercase, ASCII-only, hyphen separators
- Slugify `band` and `venue` (spaces → hyphen, punctuation stripped)
- `YYYYMMDD` pulled from concert date; use `unknown` when missing
- Store file under `output/<photoId>/ps-<...>.opus` to keep gallery mapping obvious.

Example: `ps-20190814-car-seat-headrest-bowery-ballroom.opus`

## Metadata Requirements

| Tag           | Source                                          |
| ------------- | ----------------------------------------------- |
| `title`       | `<Band> — <Venue> (<Date>)`                     |
| `artist`      | Band name                                       |
| `album`       | Config default or per-track override            |
| `date`        | ISO date string (YYYY-MM-DD)                    |
| `location`    | Venue + city/state if available                 |
| `comment`     | "Encoded for Photo Signal" + optional notes     |
| `website`     | `https://photosignal.app` (ensures provenance)  |
| `PHOTO_ID`    | Custom Vorbis tag linking to gallery photo      |
| `PHOTO_PANEL` | Optional custom tag referencing wall column/row |

Apply tags directly during ffmpeg encode or via `opusinfo --set-...` equivalent.

## Report / Index Contents

Each entry in `audio-index.json` should include:

- `id`: slugified identifier matching filename
- `band`, `venue`, `date`
- `photoId`, `photoPanel`, `galleryPosition`
- `durationMs`, `bitrateKbps`, `sampleRate`
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
- [ ] Opus file size + duration stored in manifest
- [ ] Checksums verified
- [ ] Report generated with zero "blocking" warnings

## Future Enhancements

- Batch parallelization using worker pool (ffmpeg is CPU-heavy)
- Built-in comparison tool to detect when a source file changed and only re-encode delta
- Optional stem export / multichannel support
- Visual LUFS trend graphs per track to spot outliers before deployment

Once this stage completes, the `update/` scripts can trust that every asset is ready for CDN upload with zero additional processing.
