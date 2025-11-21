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
- `write-thumbnail` – keep a `.webp` cover next to the audio (default: on)
- `embed-thumbnail` – attach artwork to the container (default: off to keep Opus lean)
- `add-metadata` – inject tags into the container (default: off; metadata lives in JSON)
- `player-client` / `po-token` – control which YouTube client yt-dlp impersonates
- `archive` – path to the `.yt-dlp-archive.txt` file for duplicate protection

CLI flags always override config values, so you can keep long-term defaults committed and tweak per run.

## Metadata and Artwork Defaults

The downloader now leaves thumbnails and tags **outside** the Opus container by default to keep the downloaded audio small. You still get:

- `.webp` artwork saved alongside the audio file
- `.metadata.json` + `.info.json` sidecars with the full yt-dlp metadata payload

If you really need embedded art and tags, pass both flags when running the script:

```bash
npm run download-song -- --item 1 --embed-thumbnail --add-metadata
```

To verify a download stayed lean, inspect the streams and confirm there's no `attached_pic` entry:

```bash
ffprobe -v error -show_streams "downloads/yt-music/01 - Track.opus" | grep attached_pic
```

## What You Get

For each track the script can optionally emit:

- The encoded audio file (prefers native Opus, falls back per `format-order`)
- `*.metadata.json` with playlist context, codecs, and filesystem paths
- yt-dlp `.info.json` (when `--write-info-json` is enabled)
- Thumbnail image saved as `.webp` (embedding disabled by default; toggle with flags as needed)

These artifacts feed directly into the Organize + Encode stage, which expects the metadata JSON files to sit alongside the raw downloads.
