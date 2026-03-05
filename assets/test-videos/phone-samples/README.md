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

For GIF generation, the script automatically chooses the first two single-capture samples and
uses those two videos as the camera feed in sequence.

Before capture, demo generation preprocesses all manifest video clips into half-speed duplicates at:

- `assets/test-videos/phone-samples/half-speed/*.half.webm`

This avoids runtime playback-rate hacks and keeps demo timing stable.

## Demo GIF Timeline Spec (Editable)

Use this section to tune pacing/storyboard behavior in `scripts/visual/generate-demo-gif.js`.

- Scene 0: Landing hold — 1.5s
- Scene 1: Activate camera + search phase on `test_1_overcoats.mp4` at half speed with scan overlay and rectangle-detection visible.
  Duration: event-driven, bounded by `< clipDuration * 2`.
- Scene 2: First match (Overcoats) shown with concert info — 4s.
- Scene 3: Audio controls choreography — tap `Stop/Pause`, `Play`, `Previous`, `Next` with >=4s between taps.
- Scene 4: Close details (`Next pic, please`) and wait until hidden.
- Scene 5: Search phase on `test_5_barna.mp4` at half speed with scan overlay and rectangle-detection visible.
- Scene 6: Second match (Sean Barna) shown with concert info — 3s.
- Scene 7: Tap `Switch Artist` and hold for 4s while new track starts.
- Scene 8: Fade to black

If this spec changes, update this section first, then mirror changes in `scripts/visual/generate-demo-gif.js` constants/flow.

## Shipping safety

These files are intentionally stored under `assets/` (not `public/`), so they are not copied into production build output by Vite.

They are used only by the local/CI demo generation script: `scripts/visual/generate-demo-gif.js`.
