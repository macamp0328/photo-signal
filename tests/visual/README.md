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
| `responsive.spec.ts`      | extended         | Small-mobile baseline + minimal desktop sanity  |

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
```

## CI Behavior

Workflow: `.github/workflows/visual-regression.yml`

- **Blocking**: `@smoke` on `Mobile Chrome` + `Mobile Safari`
- **Informational**: `@extended` runs after smoke and uploads artifacts
- **PR outcome**: smoke failures fail the workflow; extended failures are reported for review

## Snapshot Acceptance Criteria

Accept a snapshot update only when all are true:

1. Change is user-visible and intentional.
2. The test asserts an outcome, not an implementation detail.
3. Snapshot is scoped appropriately (targeted region preferred; full-page only for shell/layout risk).
4. Drift is deterministic across two local reruns.
5. PR description explains why visual baselines changed.

## Mobile-First Rules

1. New blocking visuals must prove mobile user value first.
2. Desktop visuals are allowed only for layout/overflow classes of risk.
3. Avoid adding tablet/desktop variants unless they catch a distinct regression class.
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
