# Encode Stage

This stage converts downloaded source tracks into normalized Opus outputs and generates the manifests used by the runtime data pipeline.

## Command

```bash
npm run encode-audio -- [options]
```

Common examples:

```bash
# Encode using default config paths
npm run encode-audio

# Preview work without writing outputs
npm run encode-audio -- --dry-run

# Re-encode all tracks even when outputs already exist
npm run encode-audio -- --force-reencode
```

## Prerequisites

- `ffmpeg` + `ffprobe` available on PATH
- Download stage completed (audio + metadata files present)
- Node.js 20+

## Inputs

Default paths are read from `scripts/audio-workflow/encode/encode.config.json`.

- Input directory: downloaded audio + sidecar metadata
- Metadata source: `*.metadata.json` (falls back to `*.info.json` when metadata sidecars are absent)
- Optional overrides: `--metadata-overrides <path>`

## Outputs

By default, outputs are written under `scripts/audio-workflow/encode/output/` and temp files under `scripts/audio-workflow/encode/work/`.

Primary artifacts:

- Encoded `*.opus` files
- `audio-index.json`
- `photo-audio-map.json`
- `encode-report.md`

## What the script does

1. Validates prerequisites and loads config
2. Discovers download entries from metadata files
3. Normalizes audio and encodes Opus output
4. Computes checksums and metadata fields
5. Writes manifests and summary report

## CLI options

```text
--input-dir <path>
--output-dir <path>
--work-dir <path>
--config <path>
--metadata-overrides <path>
--skip-existing[=true|false]
--force-reencode
--skip-prereq-check
--dry-run
--help
--version
```

## Notes

- `--skip-existing` defaults to `true` to keep reruns incremental.
- Use `--force-reencode` for full rebuilds after config changes.
- Runtime dataset generation is handled by update-stage scripts (`audio:build-data`, `apply-cdn-to-data`).
