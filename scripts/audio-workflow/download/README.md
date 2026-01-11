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
- `format-order` – preference list (default `opus,webm,m4a,mp3`) so yt-dlp grabs the best native Opus/WebM audio before falling back
- `write-thumbnail` – keep a `.webp` cover next to the audio (default: on)
- `embed-thumbnail` – attach artwork to the container (default: off to keep Opus lean)
- `add-metadata` – inject tags into the container (default: off; metadata lives in JSON)
- `player-client` / `po-token` – control which YouTube client yt-dlp impersonates
- `archive` – path to the `.yt-dlp-archive.txt` file for duplicate protection

CLI flags always override config values, so you can keep long-term defaults committed and tweak per run.

### Format Priority

The default config forces yt-dlp to try `opus` (and the Opus-in-WebM container) before touching lossy fallbacks. That keeps the pipeline lossless up to the encode stage. Pair this with the encode guardrail—which caps output at 160 kbps and refuses to upsample past the detected source bitrate—and every track stays lean without sacrificing fidelity.

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

## Metadata Structure: Single Source of Truth

**The `.metadata.json` file is the single source of truth for all track metadata.** It contains:

1. **Structured metadata** (`playlist`, `track`, `download`, `source`) - normalized fields used by the encode stage
2. **Complete yt-dlp payload** (`ytInfo`) - the entire `.info.json` content for deep access to all YouTube Music metadata

### Why Keep Metadata Outside the Audio Container?

Following the principle of "capture once, store outside," we:

- **Avoid double work**: No need to re-tag during normalization/encoding
- **Preserve complete data**: Vorbis comments can't hold structured data (arrays, nested objects, artwork URLs)
- **Keep containers lean**: Opus files stay small without embedded metadata bloat
- **Enable manifest-driven playback**: The web app reads from `audio-index.json`, never from file tags

The encode stage reads from `.metadata.json` and embeds only **essential tags** (title, artist, album, date) for media player compatibility. Everything else lives in the JSON manifests.

### Structure Example

This example is intentionally truncated. Ellipses (`...`) and placeholder strings show omitted data; remove them and use the actual fields from your `.info.json` to keep the file valid JSON.

```json
{
  "schemaVersion": 1,
  "generatedAt": "2024-01-15T10:30:00.000Z",
  "playlist": {
    "url": "https://music.youtube.com/playlist?list=...",
    "id": "PLqTokna7EJXf...",
    "title": "My Playlist",
    "index": 1
  },
  "track": {
    "id": "abc123xyz",
    "title": "Band Name @ Venue Name",
    "album": "Album Name",
    "artist": "Band Name",
    "description": "Full description...",
    "releaseDate": "2023-08-15",
    "uploadDate": "2023-08-20",
    "channelId": "UCxyz...",
    "durationSeconds": 245,
    "thumbnails": [
      {
        "url": "https://i.ytimg.com/vi/abc123/maxresdefault.jpg",
        "width": 1280,
        "height": 720
      }
    ],
    "webpageUrl": "https://music.youtube.com/watch?v=abc123xyz",
    "tags": ["indie", "rock", "live"],
    "categories": ["Music"]
  },
  "download": {
    "filePath": "/path/to/01 - Track.opus",
    "fileName": "01 - Track.opus",
    "ext": "opus",
    "originalExt": "opus",
    "codec": "opus",
    "bitrateKbps": 125,
    "fileSizeBytes": 3840000,
    "formatAttempted": "opus",
    "formatPreference": ["opus", "mp3"],
    "archivePath": "/path/to/.yt-dlp-archive.txt"
  },
  "source": {
    "playlistUrl": "https://music.youtube.com/playlist?list=...",
    "trackUrl": null,
    "requestedUrl": "https://music.youtube.com/playlist?list=..."
  },
  "infoJsonPath": "/path/to/01 - Track.info.json",
  "ytInfo": {
    "_type": "video",
    "id": "abc123xyz",
    "title": "Band Name @ Venue Name",
    "description": "Full description with credits...",
    "uploader": "Band Name - Topic",
    "channel": "Band Name",
    "channel_id": "UCxyz...",
    "duration": 245,
    "webpage_url": "https://music.youtube.com/watch?v=abc123xyz",
    "categories": ["Music"],
    "tags": ["indie", "rock", "live"],
    "artists": ["Band Name"],
    "album": "Album Name",
    "track": "Track Name",
    "release_date": "20230815",
    "upload_date": "20230820",
    "acodec": "opus",
    "abr": 125,
    "ext": "opus",
    "format": "251 - audio only (medium)",
    "format_id": "251",
    "thumbnails": ["…"],
    "automatic_captions": {"…": "…"},
    "subtitles": {"…": "…"},
    "additionalFields": "Additional yt-dlp fields omitted for brevity"
  }
}
```

### Accessing Rich Metadata

The **`ytInfo` field contains the complete, unmodified yt-dlp metadata**. Use it when you need:

- **Auto-generated credits**: `ytInfo.description` often contains "Producer: ...", "Composer: ...", etc.
- **Distributor/label**: Description may include "Provided to YouTube by ..." and "℗ Record Label"
- **All available tags**: `ytInfo.tags` is the full array, not just what we cherry-picked
- **Format details**: `ytInfo.format`, `ytInfo.format_id`, `ytInfo.format_note` show what container/codec was used
- **Artwork URLs**: `ytInfo.thumbnails` array with all resolutions
- **Channel metadata**: `ytInfo.channel_follower_count`, `ytInfo.view_count`, etc.
- **Any other yt-dlp field**: 100+ fields available for custom processing

The encode stage (`scripts/audio-workflow/encode/encode-audio.js`) demonstrates how to consume this:

```javascript
const ytInfo = metadata?.ytInfo ?? {};
const description = ytInfo.description ?? '';

// Parse distributor from "Provided to YouTube by ..." line
const distributorMatch = description.match(/^Provided to YouTube by\s+(.+)$/im);
const distributor = distributorMatch?.[1]?.trim() ?? null;

// Extract record label from "℗ Label Name" line
const labelMatch = description.match(/^℗\s*(.+)$/m);
const recordLabel = labelMatch?.[1]?.trim() ?? null;

// Access all tags
const allTags = Array.isArray(ytInfo.tags) ? ytInfo.tags : [];

// Get artist list
const artists = Array.isArray(ytInfo.artists) ? ytInfo.artists : [];
```

**Important**: The structured `track` and `download` fields are convenience accessors for common fields, but **always prefer `ytInfo` when you need the complete, authoritative data** from YouTube Music.

### Why Not Embed Metadata in Opus?

The old approach (yt-dlp `--add-metadata`) would:

1. ❌ Inject tags during download (work #1)
2. ❌ Re-tag during encoding (work #2)
3. ❌ Bloat containers with verbose comments
4. ❌ Lose structured data (arrays, URLs, nested objects)
5. ❌ Require ffprobe to read tags during encode

The new approach:

1. ✅ Capture once into `.metadata.json`
2. ✅ Encode stage reads JSON, embeds minimal tags
3. ✅ Manifests (`audio-index.json`) expose rich metadata to web app
4. ✅ Containers stay lean (~3-5 MB per track)
5. ✅ Structured data preserved (arrays, objects, URLs)
