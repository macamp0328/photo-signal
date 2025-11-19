# Download Stage

Companion scripts in this directory pull source audio, thumbnails, and metadata from YouTube Music (or individual track URLs) so the rest of the Photo Signal pipeline can stay deterministic. The `download-yt-song.js` entry point handles duplicate protection, throttling, metadata capture, and client selection so the raw assets that land in `downloads/` are immediately ready for the combined organize + encode process.

## Quick Start

Run the downloader through the npm script (adds node flags and resolves paths automatically):

```bash
npm run download-song -- [options]
```

Examples:

```bash
# Download the default playlist item 1 into downloads/yt-music
npm run download-song -- --item 1

# Pull a specific playlist with custom output folder
npm run download-song -- --playlist-url "<playlist-url>" --output-dir ~/Music/photo-signal

# Download by direct track URL
npm run download-song -- --track-url "https://music.youtube.com/watch?v=..."
```

Add `--dry-run` to inspect the underlying yt-dlp command without downloading anything.

## Prerequisites

- `yt-dlp` available on your PATH (container image already includes it)
- `ffmpeg` for audio extraction/Opus remuxing
- Node.js 20+ (matches the project engines field)

The script will sanity-check these requirements unless you pass `--skip-prereq-check`.

## Configuration

Defaults live in `download-yt-song.config.json` (copyable from the `.example` file). Common keys:

- `playlist-url` – primary playlist to monitor
- `output-dir` – local folder for downloaded assets (default `downloads/yt-music`)
- `format-order` – preference list such as `opus,wav,mp3`
- `player-client` / `po-token` – control which YouTube client yt-dlp impersonates
- `archive` – path to the `.yt-dlp-archive.txt` file for duplicate protection

CLI flags always override config values, so you can keep long-term defaults committed and tweak per run.

## What You Get

For each track the script can optionally emit:

- The encoded audio file (prefers native Opus, falls back per `format-order`)
- `*.metadata.json` with playlist context, codecs, and filesystem paths
- yt-dlp `.info.json` (when `--write-info-json` is enabled)
- Thumbnail image and embedded metadata (configurable via flags)

These artifacts feed directly into the Organize + Encode stage, which expects the metadata JSON files to sit alongside the raw downloads.
