# Download Stage

`download-yt-song.js` fetches YouTube Music audio plus sidecar metadata for the audio pipeline.

## Command

```bash
npm run download-song -- [options]
```

Common examples:

```bash
# Download one playlist item
npm run download-song -- --item 1

# Download first 10 items (smoke)
npm run download-song:smoke

# Download a direct track URL
npm run download-song -- --track-url "https://music.youtube.com/watch?v=<id>"

# Dry run
npm run download-song -- --dry-run
```

## Prerequisites

- `yt-dlp` on PATH
- `ffmpeg` on PATH (unless `--keep-video`)
- Node.js 20+

## Defaults

- Output directory: `downloads`
- Archive file: `<output-dir>/.yt-dlp-archive.txt`
- Playlist client fallback: `web -> mweb -> ios -> tv`
- Format preference: Opus-first with fallback

## Generated artifacts

Per track, the downloader can write:

- audio file (prefers Opus when available)
- `*.metadata.json` (structured sidecar used by encode stage)
- `*.info.json` (yt-dlp metadata)
- thumbnail file (`.webp`) when enabled

## High-value options

```text
--playlist-url <url>
--track-url <url>
--item <n|all>
--max-items <n>
--output-dir <path>
--format <ext|list>
--format-order <list>
--player-client <client>
--player-client-order <list>
--po-token <token>
--archive <path>
--no-archive
--metadata / --no-metadata
--dry-run
```

Run `npm run download-song -- --help` for full options.

## Notes

- Metadata sidecars are the source of truth for later encode/update stages.
- `--allow-stale-yt-dlp` is an emergency bypass for freshness guardrails.
