# Documentation Audit — April 2026

> Generated 2026-04-09. Items marked **needs-review** require human verification against
> current code. Items marked **stale** have confirmed inaccuracies. This is a point-in-time
> snapshot for the maintainer to work through — not a living document.

## Status Legend

| Status           | Meaning                                     |
| ---------------- | ------------------------------------------- |
| **current**      | Content matches codebase as of audit date   |
| **needs-review** | Likely stale; specific concerns noted below |
| **stale**        | Confirmed inaccurate content identified     |

---

## Core Documentation

| File                     | Last Updated | Status       | Concerns                                                                                                                                                                                                     |
| ------------------------ | ------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `README.md`              | 2026-03-04   | needs-review | 5+ weeks old; recognition pipeline has evolved significantly (blur gate, buffer reuse, adaptive delays, worker crash recovery, preload-on-candidate). Feature descriptions may not reflect current behavior. |
| `SETUP.md`               | 2026-03-04   | needs-review | Verify DevContainer/Codespaces instructions are still accurate. Check Node version requirements and any new prerequisites.                                                                                   |
| `ARCHITECTURE.md`        | 2026-03-25   | current      |                                                                                                                                                                                                              |
| `TESTING.md`             | 2026-03-02   | needs-review | Oldest core doc. Verify coverage thresholds, test patterns, mock inventory, and visual regression approach still match reality.                                                                              |
| `DOCKER.md`              | 2026-03-27   | current      |                                                                                                                                                                                                              |
| `DOCUMENTATION_INDEX.md` | 2026-03-31   | current      | No orphaned or missing entries found.                                                                                                                                                                        |

## AI Agent Instructions

| File                              | Last Updated | Status  | Concerns                                                                                                                                                                                 |
| --------------------------------- | ------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`                       | 2026-03-25   | current | Was missing documentation maintenance rules (added in this PR).                                                                                                                          |
| `.github/copilot-instructions.md` | 2026-03-25   | stale   | Was missing pre-commit step 4 (`node scripts/check-module-readmes.js`), missing "Keeping Module READMEs in sync" section, missing documentation maintenance rules. All fixed in this PR. |

## Technical Guides

| File                                   | Last Updated | Status       | Concerns                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------- | ------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/PHOTO_RECOGNITION_DEEP_DIVE.md`  | 2026-03-04   | needs-review | 26+ commits to `photo-recognition` module since this was written. Changes include: blur gate, buffer reuse, Welford variance, adaptive delays, warm-light luma (added then reverted), worker crash recovery, preload-on-candidate. Algorithm details, thresholds, and pipeline stages likely outdated. **Highest priority for review.** |
| `docs/AUDIO_R2_WORKER.md`              | 2026-03-03   | needs-review | Audio pipeline has changed: Web Audio path, instant playback on match, `createMediaElementSource`, preload-on-candidate. Worker config and CORS rules may be stale.                                                                                                                                                                     |
| `docs/PHOTO_SONG_ADDITION_WORKFLOW.md` | 2026-03-04   | needs-review | Verify workflow steps still match current script behavior and data artifact schema.                                                                                                                                                                                                                                                     |
| `docs/DESIGN_SYSTEM.md`                | 2026-03-27   | current      |                                                                                                                                                                                                                                                                                                                                         |
| `docs/STATES_AND_DESIGN_LANGUAGE.md`   | 2026-04-01   | current      | Most recently updated doc.                                                                                                                                                                                                                                                                                                              |
| `docs/ENVIRONMENTAL_EFFECTS_IDEAS.md`  | 2026-03-27   | current      |                                                                                                                                                                                                                                                                                                                                         |
| `docs/ARCHITECTURE_DECISIONS.md`       | 2026-03-24   | current      | Check whether any recent decisions (post-March 24) should be added as new ADR entries.                                                                                                                                                                                                                                                  |

## Module READMEs

| File                                              | Last Updated | Status       | Concerns                                                                                                                                                           |
| ------------------------------------------------- | ------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/modules/photo-recognition/README.md`         | 2026-03-31   | stale        | Referenced `worker/` subdirectory that doesn't exist; actual file is `recognition.worker.ts` at module root. Fixed in this PR.                                     |
| `src/modules/audio-playback/README.md`            | 2026-03-24   | needs-review | Multiple audio changes since: Web Audio path, instant playback, crossfade simplification, preload-on-candidate. API descriptions may not reflect current behavior. |
| `src/modules/concert-info/README.md`              | 2026-03-26   | needs-review | Concert info layout redesigned (poster-style) and repositioned in recent PRs. Component structure and props may have changed.                                      |
| `src/modules/camera-access/README.md`             | 2026-03-24   | current      |                                                                                                                                                                    |
| `src/modules/camera-view/README.md`               | 2026-03-24   | current      |                                                                                                                                                                    |
| `src/modules/debug-overlay/README.md`             | 2026-03-24   | current      |                                                                                                                                                                    |
| `src/modules/gallery-layout/README.md`            | 2026-03-30   | current      |                                                                                                                                                                    |
| `src/modules/motion-detection/README.md`          | 2026-03-24   | current      |                                                                                                                                                                    |
| `src/modules/photo-rectangle-detection/README.md` | 2026-03-24   | current      |                                                                                                                                                                    |
| `src/modules/secret-settings/README.md`           | 2026-03-24   | current      |                                                                                                                                                                    |

Note: All module READMEs pass the automated `check-module-readmes.js` export validation. The
issues above are about prose accuracy, not missing export mentions.

## Scripts & Workflows

| File                                        | Last Updated | Status       | Concerns                                                             |
| ------------------------------------------- | ------------ | ------------ | -------------------------------------------------------------------- |
| `scripts/audio-workflow/README.md`          | 2026-03-02   | needs-review | Audio pipeline changes may affect documented workflow steps.         |
| `scripts/audio-workflow/download/README.md` | 2026-03-02   | needs-review | Verify yt-dlp options and output paths still match.                  |
| `scripts/audio-workflow/encode/README.md`   | 2026-03-02   | needs-review | Verify encoding parameters, output format, and generated artifacts.  |
| `tests/visual/README.md`                    | 2026-03-05   | needs-review | Demo generator was rewritten; visual test approach may have shifted. |

## GitHub & Process

| File                                 | Last Updated | Status       | Concerns                                                                          |
| ------------------------------------ | ------------ | ------------ | --------------------------------------------------------------------------------- |
| `.github/pull_request_template.md`   | 2026-02-17   | needs-review | Oldest file in repo. Was missing documentation checklist item (added in this PR). |
| `.claude/skills/tend-to-pr/SKILL.md` | 2026-03-24   | current      |                                                                                   |

## Asset Documentation

| File                                         | Last Updated | Status  | Concerns               |
| -------------------------------------------- | ------------ | ------- | ---------------------- |
| `assets/prod-photographs/README.md`          | 2026-03-02   | current | Stable reference data. |
| `assets/test-videos/phone-samples/README.md` | 2026-03-06   | current |                        |
| `public/assets/test-images/README.md`        | 2026-03-03   | current |                        |

---

## Summary

| Status           | Count | Action                                        |
| ---------------- | ----- | --------------------------------------------- |
| **current**      | 20    | No action needed                              |
| **needs-review** | 12    | Maintainer should verify against current code |
| **stale**        | 2     | Fixed in this PR                              |

### Priority Review Order

1. `docs/PHOTO_RECOGNITION_DEEP_DIVE.md` — most code drift, highest impact
2. `docs/AUDIO_R2_WORKER.md` — audio pipeline significantly changed
3. `src/modules/audio-playback/README.md` — same audio changes
4. `TESTING.md` — oldest core doc, foundational reference
5. `README.md` — public-facing, should reflect current capabilities
6. Remaining needs-review items (lower urgency, less likely to mislead)
