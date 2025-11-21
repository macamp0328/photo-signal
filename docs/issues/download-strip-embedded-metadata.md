# Issue: Trim Downloaded Opus Containers Without Losing Cover Assets

## Summary

We want every freshly downloaded track to land as a lean audio container that excludes embedded thumbnails or yt-dlp metadata blobs, while still saving the standalone `.webp` artwork next to the audio file. The current defaults in `scripts/audio-workflow/download/download-yt-song.config.json` instruct yt-dlp to embed thumbnails and add metadata directly into the `.opus`, which inflates file size and later needs to be stripped back out during encoding.

## Requirements

- Update the download config (and README) so the defaults disable **embedded** thumbnails/metadata in the audio container while leaving `.metadata.json` and `.info.json` generation untouched.
- Keep the `.webp` cover file alongside the download for gallery tooling (`write-thumbnail` must stay true, but `embed-thumbnail`/`add-metadata` should default to false).
- Ensure `download-yt-song.js` honors the new defaults when no CLI flags are supplied (sanity-check the `metadata`/`write-thumbnail`/`embed-thumbnail`/`add-metadata`/`no-*` logic around lines ~150-220).
- Document the new behavior in `scripts/audio-workflow/download/README.md`, including how to re-enable embedding if someone really wants it.

## Definition of Done

- `download-yt-song.config.json` ships with `embed-thumbnail` and `add-metadata` disabled (and any other knobs necessary to ensure thumbnails stay external).
- Running `npm run download-song -- --item 1` produces:
  - `01 - Track.opus` **without** attached pictures (verify via `ffprobe -show_streams`).
  - `01 - Track.webp` still present next to the audio file.
  - `.metadata.json` + `.info.json` files unchanged.
- README documents the new defaults and rationale ("keeps containers small; metadata still captured in JSON").
- No regression to other download flags (archive file, cookies, etc.).
- Tests/verification notes in PR show a before/after `ffprobe` snippet proving the container no longer reports `attached_pic`.
