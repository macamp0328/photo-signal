# Audio Workflow

This directory contains the end-to-end audio pipeline used to download source tracks, encode Opus outputs, and update runtime data/CDN URLs.

## Main flow

```bash
# 1) Download source tracks + metadata
npm run download-song -- --item 1

# 2) Encode outputs and generate manifests
npm run encode-audio

# 3) Build runtime data artifacts from CSV + audio index
npm run audio:build-data -- --base-url=https://<worker-host> --prefix=prod/audio

# 4) Validate dataset audio URLs
npm run validate-audio
```

## Deterministic clean-slate flow

```bash
# Reset generated artifacts (and optionally R2 objects)
npm run audio:reset

# Run pipeline with checkpoints
npm run audio:clean-slate -- --base-url=https://<worker-host>

# Verify consistency
npm run audio:verify
```

Checkpoint reports are written under `scripts/audio-workflow/output/`.

## Directory map

- `download/` — yt-dlp download script + config
- `encode/` — normalization/Opus encoding + manifests
- `update/` — CDN upload and dataset rewrite/validation tools
- `run-clean-slate.js` — orchestrates deterministic phases
- `reset-clean-slate.js` / `verify-clean-slate.js` — reset and verification helpers

## Useful phase commands

```bash
npm run audio:phase:download
npm run audio:phase:encode
npm run audio:phase:upload
npm run audio:phase:build-data
npm run audio:phase:validate
```

## Data inputs

- Photo metadata CSV: `assets/prod-photographs/prod-photographs-details.csv`
- Runtime datasets: `public/data.app.v2.json`, `public/data.recognition.v2.json`
- Encode manifest source: `scripts/audio-workflow/encode/output/audio-index.json`

## Notes

- Download metadata (`*.metadata.json`) is the source of truth for track metadata.
- Encoded files stay lean; rich metadata is surfaced via manifests.
- Use each script’s `--help` for full option details.
