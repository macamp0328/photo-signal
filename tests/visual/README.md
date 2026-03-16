# Visual Regression Tests

This suite is intentionally small and mobile-first. It is a guardrail for autonomous changes, not a broad snapshot catalog.

## Suite Design

- **Blocking tier (`@smoke`)**: high-signal regressions on core user-visible flows.
- **Informational tier (`@extended`)**: broader checks that report drift without blocking PRs.
- **Default stance**: fewer snapshots with clearer intent and lower maintenance cost.

## Current Coverage

| Test Suite                | Tier             | Focus                                           |
| ------------------------- | ---------------- | ----------------------------------------------- |
| `landing-page.spec.ts`    | smoke + extended | Landing shell and CTA stability                 |
| `camera-view.spec.ts`     | smoke            | Camera activation state                         |
| `error-states.spec.ts`    | smoke + extended | Permission and network fallback states          |
| `secret-settings.spec.ts` | smoke + extended | Settings dialog and key toggle behavior         |
| `accessibility.spec.ts`   | extended         | Focus visibility, high-contrast, reduced motion |
| `responsive.spec.ts`      | extended         | Small-mobile baseline and settings layout       |

Removed low-signal suites:

- `ui-components.spec.ts`
- `concert-info.spec.ts`
- `feature-flags.spec.ts`

## Commands

```bash
# Blocking visual gate (mobile only)
npm run test:visual

# Explicit smoke run
npm run test:visual:smoke

# Non-blocking informational coverage
npm run test:visual:extended

# Full run (all visual tests)
npm run test:visual:full

# Agent-safe non-interactive runs (no auto-open report UI)
npm run test:visual:smoke:agent
npm run test:visual:extended:agent
npm run test:visual:full:agent
npm run test:visual:update:agent

# Agent-safe targeted snapshot update for one visual spec
npm run test:visual:update:spec:agent -- tests/visual/secret-settings.spec.ts

# Update baselines after intentional UI changes
npm run test:visual:update

# Open HTML report
npm run test:visual:report

# Regenerate README demo GIF from scripted camera + match flow
npm run demo:gif

# Fast test story (single target, skips unchanged build if server is running)
npm run demo:gif:test
```

Prerequisites for GIF generation:

- `ffmpeg` installed and available on `PATH`
- Playwright browsers installed (`npx playwright install` if missing)

`demo:gif` runs a deterministic Playwright capture flow that feeds the app camera from
manifest-defined real phone video clips, waits for recognition milestones, captures frames, and compiles
`docs/media/demo.gif` with ffmpeg.

Real-world sample mode requires these files. `demo:gif` fails fast if they are missing:

- `assets/test-videos/phone-samples/samples.manifest.json`
- mapped videos referenced by the manifest in `assets/test-videos/phone-samples/`

In this mode, the generator always uses manifest-defined video clips as the fake camera feed and
selects two single-capture manifest samples for the GIF recognition story. There is currently no
synthetic fallback path.

Because samples live under `assets/` (not `public/`), they are dev/test inputs only and are not
copied to production site output.

## CI Behavior

Workflow: `.github/workflows/visual-regression.yml`

- **Blocking**: `@smoke` on `Mobile Chrome` + `Mobile Safari`
- **Extended coverage**: `@extended` runs after smoke across mobile projects
- **PR outcome**: any detected visual change (smoke or extended) fails the workflow to provide a clear visual-change signal
- **Diagnostics**: artifacts and PR comment are emitted on failures to support intentional snapshot updates vs unexpected regressions

## Snapshot Acceptance Criteria

Accept a snapshot update only when all are true:

1. Change is user-visible and intentional.
2. The test asserts an outcome, not an implementation detail.
3. Snapshot is scoped appropriately (targeted region preferred; full-page only for shell/layout risk).
4. Drift is deterministic across two local reruns.
5. PR description explains why visual baselines changed.

## Mobile-First Rules

1. New blocking visuals must prove mobile user value first.
2. Prefer mobile viewport variants over desktop/tablet unless there is a proven mobile gap.
3. Avoid adding extra browser/project variants unless they catch a distinct regression class.
4. Prefer one canonical viewport per risk area.

## Flake Triage Workflow

1. Re-run the failing test twice (`npx playwright test <spec> --grep <name>`).
2. If non-deterministic, classify root cause:
   - dynamic clock/timer content,
   - animation/transition timing,
   - unstable selector or focus target,
   - browser-specific rendering drift.
3. Fix root cause before updating baselines (no blind snapshot refresh).
4. If risk is low and drift remains browser-specific, move check to `@extended`.

## Authoring Guidance

- Use shared helpers from `tests/visual/utils/visual-helpers.ts`.
- Avoid `waitForTimeout`; wait for explicit visible state.
- Use role/name-based selectors and deterministic state setup.
- Keep snapshot names tied to user outcome (example: `error-network-data-load.png`).
