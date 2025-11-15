# Example Real Songs Library

This directory bundles real-world MP3 recordings that can be paired with the
example photo set while Test Data Mode is enabled.

> **License / Usage**
>
> These tracks are user-provided concert recordings intended **only** for Photo
> Signal development and regression testing. Do not redistribute outside this
> repository without the contributor's explicit permission.

## File Inventory

| File                      | Approx. Duration | Notes                            | Default Test Data Mapping      |
| ------------------------- | ---------------- | -------------------------------- | ------------------------------ |
| `01 Mass Romantic.mp3`    | 3m 15s           | High-energy indie rock recording | Concert ID 8 (R0043343)        |
| `06 Ocelot.mp3`           | 9m 20s           | Jam band live cut                | Concert ID 9 (R0055333)        |
| `13 1999.mp3`             | 5m 45s           | Synth-heavy cover                | Concert ID 10 (R0055917)       |
| `16 You Enjoy Myself.mp3` | 17m 32s          | Improvisational suite            | Concert ID 11 (R0060632)       |
| `18 Meatstick.mp3`        | 9m 04s           | Crowd participation favorite     | Concert ID 12 (R0060861)       |
| `20 Possum.mp3`           | 10m 11s          | Blues-rock closer                | Concert ID 7 (Monochrome Grid) |

File sizes range from ~8 MB to ~56 MB per track. Make sure your development
environment has enough disk space (≈170 MB for the full set).

## Runtime Behavior

- During `npm run dev` / `npm run build`, the Vite asset copier mirrors these
  files to `public/assets/example-real-songs/` so they can be streamed via
  `/assets/example-real-songs/<filename>.mp3`.
- The helper script `./scripts/copy-test-assets.sh` now performs the same copy
  when you need to sync assets manually.
- `assets/test-data/concerts.json` and `.csv` reference these file paths for
  the real-photo entries (IDs 8-12) plus the diagonal checker target (ID 7).

## Tips

- Because these tracks are long, they are ideal for stress-testing crossfades,
  motion-triggered fades, and buffering logic.
- If you do not need the real recordings, you can temporarily move this folder
  out of the repo; the app gracefully falls back to synthetic tones.
- When adding new real songs, update this README, `ASSET_LICENSES.md`, and the
  test data files so the entire toolchain stays in sync.
