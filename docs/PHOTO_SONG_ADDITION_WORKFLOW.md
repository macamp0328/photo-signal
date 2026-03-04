# One-Off Photo + Song Workflow

Use this runbook when you want to temporarily add a single photo + song reveal without reprocessing the full catalog.

## Prerequisites

- A recognition source photo placed under `assets/` at the **repo root** (e.g., `assets/one-off/<name>.jpg`). This is a local-only file used by the hashing script and is not committed.
- A song source URL or a prepared audio file.
- A unique numeric `concertId` not currently used in `public/data.app.v2.json`.

## Quick Add Flow

1. Add media files:
   - Recognition source photo (hashing input): `assets/one-off/<name>.jpg` — place at the **repo root** `assets/` directory, NOT under `public/`. The hashing script resolves `imageFile` paths against the repo root, so `/assets/one-off/<name>.jpg` maps to `<repo>/assets/one-off/<name>.jpg`.
   - Photo display preview (optional but recommended): `public/assets/test-images/<name>.jpg`
   - Audio file: `public/audio/<name>.opus`
   - Optional cover art: `public/audio/<name>-cover.webp`
2. Add one artist/photo/track/entry tuple in `public/data.app.v2.json`:
   - `artists[]`: add temporary artist id/name.
   - `photos[]`: add photo row with:
     - `imageFile: "/assets/one-off/<name>.jpg"` — repo-root path used by the hashing script (resolves to `<repo>/assets/one-off/<name>.jpg`)
     - `photoUrl: "/assets/test-images/<name>.jpg"` — web-root path for the matched preview image served from `public/`
     - `recognitionEnabled: true`
   - `tracks[]`: add track row with `audioFile` (and optional `albumCoverUrl`).
   - `entries[]`: add one entry using the same numeric `id` as your target `concertId`.
3. Add a matching recognition entry in `public/data.recognition.v2.json`:
   - Append `{ "concertId": <id>, "phash": [] }` first.
4. Generate hashes only for the new entry:
   - `npm run hashes:refresh -- --ids <id> --batch-size 0`

## Validate

Run targeted checks first, then full gate:

- `npm run test:run -- src/services/data-service/DataFilesIntegrity.test.ts`
- `npm run pre-commit`

Manual check:

- Start app with `npm run dev`.
- Scan the target photo and verify:
  - song autoplay starts,
  - info card text/date/venue are correct,
  - matched preview image renders.

## Common Pitfalls

- `imageFile` is a **repo-root filesystem path** used only by the hashing script. Place the source image under `assets/` at the repo root (e.g., `assets/one-off/<name>.jpg`) and set `imageFile: "/assets/one-off/<name>.jpg"`. Do NOT put the hashing source image under `public/` — the script strips the leading slash and resolves against the repo root, so `/assets/...` maps to `<repo>/assets/...`, not `<repo>/public/assets/...`.
- `photoUrl` is a **web-root URL** for the display preview image served by the web server. Point it at a file under `public/` using `/assets/...` style (e.g., `/assets/test-images/<name>.jpg`).
- Matched preview uses `photoUrl`; if omitted, UI falls back to placeholder.
- Keep one-off scripts/data out of long-term mainline unless intentionally permanent.

## Cleanup (Remove One-Off Feature)

1. Remove temporary rows from:
   - `public/data.app.v2.json` (`artists`, `photos`, `tracks`, `entries`)
   - `public/data.recognition.v2.json` (`entries` by `concertId`)
2. Delete temporary media files from `public/assets/test-images/`, `public/audio/`, and the recognition source image from `assets/one-off/` (or wherever you placed it under `assets/`).
3. Remove temporary npm scripts from `package.json`.
4. Re-run `npm run pre-commit`.
