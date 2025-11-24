# Example Real Songs Library

This directory now stores a lightweight library of **30-second Opus clips**
trimmed from user-provided concert recordings. The clips pair with the example
photo set whenever Test Data Mode is enabled, giving you realistic audio cues
without shipping 170 MB worth of full-length tracks.

> **License / Usage**
>
> These stems remain user-provided and are intended **only** for Photo Signal
> development and regression testing. Do not redistribute outside this
> repository without the contributor's explicit permission.

## Clip Inventory

Each original recording has been sliced into four clips (128 kbps, 44.1 kHz)
using `ffmpeg`. Filenames follow the pattern
`<track-number>-<slug>-clip-0X.opus`.

| Base Recording   | Duration | Clip Files                              | Start Offsets (s) | Default Test Data Mapping |
| ---------------- | -------- | --------------------------------------- | ----------------- | ------------------------- |
| Mass Romantic    | 4m 04s   | `01-mass-romantic-clip-0{1..4}.opus`    | 0, 60, 120, 180   | Concert ID 8 (R0043343)   |
| Ocelot           | 9m 32s   | `06-ocelot-clip-0{1..4}.opus`           | 0, 150, 300, 450  | Concert ID 9 (R0055333)   |
| 1999             | 14m 38s  | `13-1999-clip-0{1..4}.opus`             | 0, 180, 360, 540  | Concert ID 10 (R0055917)  |
| You Enjoy Myself | 24m 01s  | `16-you-enjoy-myself-clip-0{1..4}.opus` | 0, 300, 600, 900  | Concert ID 11 (R0060632)  |
| Meatstick        | 10m 00s  | `18-meatstick-clip-0{1..4}.opus`        | 0, 150, 300, 450  | Concert ID 12 (R0060861)  |
| Possum           | 10m 50s  | `20-possum-clip-0{1..4}.opus`           | 0, 150, 330, 510  | Concert ID 7 (Monochrome) |

> **Current data mapping**: `assets/test-data/concerts.dev.json` and `.csv` point to
> the `clip-01` version of each recording by default. Feel free to swap to other
> clips locally if you want additional variety.

## Runtime Behavior

- During `npm run dev` / `npm run build`, the Vite asset copier mirrors the clip
  files to `public/assets/example-real-songs/`, so they can be streamed via
  `/assets/example-real-songs/<filename>.opus`.
- The helper script `./scripts/copy-test-assets.sh` performs the same copy if you
  ever need to sync assets manually.
- Test data references the clip filenames directly, so no code changes were
  required.

## Regenerating the Clips

You can recreate the clip pack at any time with `ffmpeg`. Example snippet:

```bash
ffmpeg -hide_banner -loglevel error -ss 150 -t 30 -i "18 Meatstick.mp3" \
  -c:a libopus -b:a 128k assets/example-real-songs/18-meatstick-clip-02.opus
```

Adjust `-ss` to the desired start time and repeat for each clip. The `clip-0X`
suffix should remain consistent so downstream data files do not need to change.

## Tips

- Short clips load faster, making motion-triggered fades snappier during manual
  testing.
- Keep at least one clip per recording committed so the test photo set always
  has a deterministic audio companion.
- When adding new recordings, follow the naming pattern above, update this
  README plus `ASSET_LICENSES.md`, and refresh the test data references to keep
  everything aligned.
