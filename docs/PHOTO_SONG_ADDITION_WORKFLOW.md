# One-Off Photo + Song Workflow

Use this runbook when you want to temporarily add a single photo + song reveal without reprocessing the full catalog.

## Prerequisites

- A photo file available under `public/assets/test-images/` (or another public path).
- A song source URL or a prepared audio file.
- A unique numeric `concertId` not currently used in `public/data.app.v2.json`.

## Quick Add Flow

1. Add media files:
   - Photo preview file (optional but recommended): `public/assets/test-images/<name>.jpg`
   - Recognition source photo: `public/assets/test-images/<name>-anniversary.jpg` (or same file)
   - Audio file: `public/audio/<name>.opus`
   - Optional cover art: `public/audio/<name>-cover.webp`
2. Add one artist/photo/track/entry tuple in `public/data.app.v2.json`:
   - `artists[]`: add temporary artist id/name.
   - `photos[]`: add photo row with:
     - `imageFile` for recognition input (`/assets/...` path style)
     - `photoUrl` for matched preview image (`/assets/...` path style)
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

- `imageFile` and `photoUrl` should be public-root paths like `/assets/...` (not `/public/assets/...`).
- Matched preview uses `photoUrl`; if omitted, UI falls back to placeholder.
- Keep one-off scripts/data out of long-term mainline unless intentionally permanent.

## Cleanup (Remove One-Off Feature)

1. Remove temporary rows from:
   - `public/data.app.v2.json` (`artists`, `photos`, `tracks`, `entries`)
   - `public/data.recognition.v2.json` (`entries` by `concertId`)
2. Delete temporary media files from `public/assets/test-images/` and `public/audio/`.
3. Remove temporary npm scripts from `package.json`.
4. Re-run `npm run pre-commit`.
