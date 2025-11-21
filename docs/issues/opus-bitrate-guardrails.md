# Issue: Respect Source Bitrate While Enforcing a 160 kbps Ceiling

## Summary

Our encode stage always re-renders normalized audio at 160 kbps Opus, even if the source download was already a lower bitrate track (e.g. 125 kbps). That upscaling wastes space without improving fidelity. We also want to make sure the download stage keeps prioritizing the highest-quality Opus format that YouTube Music exposes so we start from the best possible input.

## Requirements

- Treat `160 kbps` as the **maximum** encode bitrate. If the source audio’s measured bitrate (from `.metadata.json` or `ffprobe`) is lower, encode at the lower value instead of inflating it.
- Update `scripts/audio-workflow/encode/encode.config.json` and `encode-audio.js` so the final bitrate passed to ffmpeg is `Math.min(config.opus.bitrateKbps, sourceBitrateKbpsRounded)`, with a sensible floor (e.g. don’t go below 96 kbps unless the source truly is).
- Surface the chosen bitrate per track in the CLI output and `audio-index.json` so it’s easy to verify the guardrail is respected.
- Audit the download config to ensure our format priority grabs the best available **Opus** rendition (`format-order` should start with opus/webm). Document that expectation in the download README.

## Acceptance Criteria

- Encoding a 125 kbps source results in a ~125 kbps output (no more 160 kbps files when the input was smaller).
- Encoding a 192 kbps or lossless source still produces a 160 kbps master (ceiling).
- `audio-index.json` records the actual bitrate used, and matches the `ffprobe` inspection of the generated file.
- Download README explicitly states that `format-order` prioritizes highest-quality Opus and that the encoder will never upsample past 160 kbps.
- Manual verification notes (e.g. `ffprobe` output) accompany the PR.
