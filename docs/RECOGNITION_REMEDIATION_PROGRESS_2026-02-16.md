# Recognition Remediation Progress (2026-02-16)

## Scope

This note summarizes the implementation slices completed for PR #250 and lists the remaining slices to finish the real-world goal:

- recognize printed photos at imperfect angles and bathroom-like lighting,
- autoplay the matched song,
- keep playback running,
- safely switch to nearby photos with low false-switch risk.

## Completed Slices

1. **Autoplay + prompt-before-switch flow**
   - Added autoplay for first confirmed recognition.
   - Added explicit user confirmation before switching to a newly recognized nearby photo.
   - Added playback flow tests.

2. **Continuous switching recognition + hysteresis**
   - Recognition continues while a track is already active.
   - Added switch delay multiplier / switch-specific thresholding / stability checks.
   - Reduced accidental switch churn.

3. **Perspective-corrected crop for off-angle photos**
   - Added perspective rectification when rectangle detection confidence is sufficient.
   - Used rectified crop before pHash matching.
   - Added algorithm tests for perspective behavior.

4. **Adaptive quality gating for variable lighting**
   - Added ambient EMA-based adaptive quality thresholds.
   - Reduced over-rejection in difficult lighting conditions.
   - Added utility tests for adaptive threshold behavior.

5. **Monochrome print-aware glare detection**
   - Updated glare logic to luminance-based detection.
   - Better behavior for black-and-white printed photos under warm/cool color casts.
   - Added/updated glare tests including warm-tinted edge cases.

6. **Ambiguity guardrails (top-2 margin checks)**
   - Added best-vs-second-best margin thresholds to avoid low-confidence locks/switches.
   - Added debug metadata: second-best match and margin.
   - Added tests for ambiguous close-match rejection.

7. **User-facing ambiguity guidance**
   - Added guidance type: `ambiguous-match`.
   - Added guidance message + telemetry support.
   - Recognition now emits ambiguity guidance on low-margin candidates.

8. **Guidance visibility during active playback scanning**
   - Updated app behavior so guidance remains visible during active playback scanning (not only pre-recognition).
   - Added playback-flow regression test for `ambiguous-match` visibility while music is active.

## Key Commits (Most Recent)

- `21d1be1` fix(app): show guidance during active playback scanning
- `d40ac5d` feat(recognition): surface ambiguous match guidance
- `8069c46` feat(recognition): add margin-based ambiguity guardrails
- `8528c83` fix(recognition): use luminance glare detection for mono prints
- `2dfa4cb` feat(recognition): adapt quality gating to ambient lighting
- `8300c6b` feat(recognition): add perspective-corrected rectangle crop
- `02ddd51` feat(recognition): enable continuous switching with hysteresis

## Validation Status

For each completed slice above, full quality checks were run successfully:

- `npm run lint:fix`
- `npm run format`
- `npm run type-check`
- `npm run test:run`
- `npm run build`
- bundle size check (`./scripts/check-bundle-size.sh` via `npm run pre-commit`)

## Remaining Slices (Prioritized)

1. **Prompt-state hardening under persistent ambiguity**
   - Ensure switch prompt cannot conflict with ongoing ambiguous guidance states.
   - Acceptance: no prompt flicker/churn when top candidates remain low-margin across frames.

2. **App-level telemetry/reporting for switch decisions**
   - Track confirms vs dismissals of switch prompts and time-to-decision.
   - Acceptance: exported telemetry includes switch decision metrics for tuning.

3. **Device-tuning pass (iPhone Safari + Android Chrome)**
   - Field-calibrate key thresholds (`switchDistanceThreshold`, margin thresholds, confidence thresholds).
   - Acceptance: documented threshold recommendations with before/after chunk results.

4. **Real-world regression suite expansion**
   - Add tests that model: active playback + nearby candidate + ambiguity + keep-current decision path.
   - Acceptance: test coverage guards current UX contract end-to-end.

5. **Docs alignment pass for updated recognition behavior**
   - Update module docs/deep-dive with current guidance, ambiguity, and switching behavior.
   - Acceptance: no stale behavior descriptions remain in primary recognition docs.
