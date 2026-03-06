# Phone Video Samples (Dev/Test Only)

This folder contains real-world phone-captured recognition samples used by `npm run demo:gif`.
These clips are used as the fake camera feed during demo generation.

## Place your files here

Add square video files in this directory and list each one in `samples.manifest.json` in the exact
deterministic order you want the demo flow to use.

The generator uses all manifest entries (in manifest order).

If your originals are `.mov` or `.webm`, convert/rename them to `.mp4` (preferred) or update `samples.manifest.json` to match.

## Manifest wiring

The manifest uses one schema only:

- each sample must include `sampleId`, `filename`, and `captures`
- each capture must include `captureId`, `concertId`, and `photoId`

`concertId` comes from `public/data.app.v2.json` `entries[].id`.
`photoId` must match the selected entry's `photoId`.

Use this structure for all samples (single-photo videos just have one capture):

```json
{
  "sampleId": "sample-03",
  "filename": "test_3_four_pictures_and_movement.mp4",
  "captures": [
    { "captureId": "01", "concertId": 7, "photoId": "photo-7" },
    { "captureId": "02", "concertId": 9, "photoId": "photo-9" },
    { "captureId": "03", "concertId": 15, "photoId": "photo-15" },
    { "captureId": "04", "concertId": 21, "photoId": "photo-21" }
  ]
}
```

`captures` order is deterministic and is the order used by the demo generator.

For GIF generation, the script automatically chooses the first three single-capture samples with
distinct artists (in manifest order) and uses them as the camera feed in sequence.

Before capture, demo generation preprocesses all demo target clips into 3× half-speed palindrome
(forward + reverse) videos at:

- `assets/test-videos/phone-samples/half-speed/*.3x-palindrome.webm`

This avoids runtime playback-rate hacks, smooths out loop restarts, and gives rectangle detection
more stable frames per loop.

## Demo GIF Timeline Spec

The canonical scene-by-scene spec lives as a comment block in `scripts/visual/generate-demo-gif.js`
(just below `STORY_PACING_MS`). Edit it there — `scripts/visual/generate-demo-gif.js` is the source of truth for pacing values
and storyboard flow.

## Shipping safety

These files are intentionally stored under `assets/` (not `public/`), so they are not copied into production build output by Vite.

They are used only by the local/CI demo generation script: `scripts/visual/generate-demo-gif.js`.
