# Issue: Capture Original Metadata Once and Store It Outside the Opus Container

## Summary

Right now we rely on yt-dlp to inject tags into the intermediate `.opus` files **and** we re-tag the normalized masters during encoding. This double work still misses some of the nuanced data yt-dlp exposes (full Vorbis comments, auto-generated credits, etc.), and it bloats every container. We want to harvest every metadata field exactly once (during the download stage) and surface it through our manifests so the encode stage no longer needs to stuff the Opus file with verbose tags.

## Requirements

- Extend `createMetadataIndex` inside `scripts/audio-workflow/download/download-yt-song.js` to persist the complete set of yt-dlp tags/credits that appear in the `.info.json`. Think: keep raw `infoData.tags`, `infoData.categories`, `infoData.artist`, any `format`-level metadata, plus parsed cover art URLs.
- Store those details under a new top-level key (e.g. `sourceMetadata` or `originalTags`) in the `.metadata.json` file so downstream stages can trust that document as the single source of truth.
- Update the encode stage (`scripts/audio-workflow/encode/encode-audio.js`) to read the richer metadata from `.metadata.json` rather than relying on whatever tags happen to be present in the downloaded `.opus` container.
- Add documentation to `scripts/audio-workflow/README.md` (and the encode README) explaining that Opus files are intentionally minimal and that team members should look at `.metadata.json`/`audio-index.json` for the full metadata payload.

## Implementation Hints

- Re-use `infoData` that’s already loaded in `createMetadataIndex`. Instead of cherry-picking a few fields, copy the structured data into a namespaced object and include the exact list of Vorbis comments if yt-dlp exposes them.
- Consider adding a helper (e.g. `extractOriginalTags(infoData)`) to keep the metadata shape consistent and TypeScript-friendly.
- The encode stage should continue to embed essential tags (title/artist/date/album) for media player friendliness, but everything else can live in the manifests.

## Acceptance Criteria

- `.metadata.json` now contains a `sourceMetadata` (or similar) object holding:
  - All yt-dlp tag arrays (tags, categories, genres, credits, etc.).
  - The original container’s codec/bitrate info.
  - Artwork URLs (so we can re-fetch later if necessary).
- `audio-index.json` gains fields sourced from the enriched metadata (no manual string parsing in the encode step).
- Encoding no longer depends on the original Opus Vorbis comments (prove by deleting embedded metadata from inputs and showing the run still succeeds with the same manifest output).
- Documentation updated and linked in `DOCUMENTATION_INDEX.md`.
