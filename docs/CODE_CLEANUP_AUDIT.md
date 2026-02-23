# Code Cleanup Audit

**Date**: 2026-02-23
**Goal**: Identify stale, dead, or redundant code that should be deleted or refactored to improve reliability and maintainability.

Each item is classified by impact:

- **Delete** — safe to remove with no loss of functionality
- **Refactor** — needs rewriting to reflect actual behavior
- **Consolidate** — two things doing the same job; one should win

---

## 1. `useCustomSettings.ts` — Permanently Empty Stub

**Status**: ✅ Completed (2026-02-23)

**Classification**: Delete (hook, type exports, and tests)
**Files**:

- `src/modules/secret-settings/useCustomSettings.ts`
- `src/modules/secret-settings/useCustomSettings.test.ts`

**Problem**: The hook explicitly says it is "kept for backward compatibility" but returns an empty settings array and three no-op functions. No caller reads the returned `settings` array or calls `updateSetting`/`getSetting`/`resetSettings` for any real purpose. It exists purely as an export so the module's `index.ts` can re-export it — but nothing in the app or tests depends on it doing anything.

```ts
// Current state — functionally dead
export function useCustomSettings() {
  const settings: CustomSetting[] = [];
  const updateSetting: (id: string, value: string | number | boolean) => void = () => {};
  const getSetting: <T = string | number | boolean>(id: string) => T | undefined = () => undefined;
  const resetSettings: () => void = () => {};
  return { settings, updateSetting, getSetting, resetSettings };
}
```

**Action**: Delete `useCustomSettings.ts`, `useCustomSettings.test.ts`, and remove its exports from `index.ts`. The `CustomSetting` interface in `types.ts` can go with it (see item 2 below).

**Completed work**:

- Deleted `src/modules/secret-settings/useCustomSettings.ts`
- Deleted `src/modules/secret-settings/useCustomSettings.test.ts`
- Removed `useCustomSettings` export from `src/modules/secret-settings/index.ts`
- Removed stale module mock export in `src/App.playbackFlow.test.tsx`

---

## 2. `CustomSetting.engines` — References Non-Existent Engines

**Status**: ✅ Completed (2026-02-23)

**Classification**: Delete (type field)
**File**: `src/modules/secret-settings/types.ts`

**Problem**: The `CustomSetting` interface has an optional `engines` field:

```ts
engines?: Array<'perceptual' | 'orb' | 'parallel'>;
```

The `orb` and `parallel` values have no runtime counterparts. The app uses a single pHash recognition algorithm. This field was scaffolded for a multi-engine architecture that was never shipped.

**Action**: If `CustomSetting` is kept, remove the `engines` field. If `useCustomSettings` is deleted (item 1), delete the whole interface.

**Completed work**:

- Deleted `CustomSetting` from `src/modules/secret-settings/types.ts`
- Removed `CustomSetting` from public type exports in `src/modules/secret-settings/index.ts`

---

## 3. `FrameQualityIndicator.tsx` — Unused Component, Superseded

**Status**: ✅ Completed (2026-02-23)

**Classification**: Delete
**Files**:

- `src/modules/photo-recognition/FrameQualityIndicator.tsx`
- `src/modules/photo-recognition/FrameQualityIndicator.module.css`

**Problem**: `FrameQualityIndicator` is an older inline-messaging component that hardcodes blur/glare guidance text. It duplicates the purpose of `GuidanceMessage.tsx` (a newer component with cooldown logic and configurable messages). Neither component is rendered anywhere in `App.tsx` or `CameraView.tsx` — they are exported from `photo-recognition/index.ts` but never consumed.

`FrameQualityIndicator` was likely the first iteration before `GuidanceMessage` was built. It was not removed when the newer component was added.

**Action**: Delete `FrameQualityIndicator.tsx` and its CSS module. Remove its export from `photo-recognition/index.ts`. Verify `GuidanceMessage` is either wired up or also removed (see item 4).

**Completed work**:

- Deleted `src/modules/photo-recognition/FrameQualityIndicator.tsx`
- Deleted `src/modules/photo-recognition/FrameQualityIndicator.module.css`
- Removed `FrameQualityIndicator` export from `src/modules/photo-recognition/index.ts`
- Removed stale `FrameQualityIndicator` mock export from `src/App.playbackFlow.test.tsx`

---

## 4. `GuidanceMessage.tsx` — Exported But Never Rendered

**Classification**: Delete or wire up
**Files**:

- `src/modules/photo-recognition/GuidanceMessage.tsx`
- `src/modules/photo-recognition/GuidanceMessage.module.css`

**Problem**: `GuidanceMessage` is exported but `App.tsx` does not destructure `activeGuidance` from `usePhotoRecognition`, so the guidance state computed inside the hook is never surfaced to the UI. The component exists but is unreachable from the render tree.

```ts
// App.tsx — activeGuidance is not destructured from usePhotoRecognition
const {
  recognizedConcert,
  reset: resetRecognition,
  resetTelemetry,
  debugInfo,
  isRecognizing,
  detectedRectangle,
  rectangleConfidence,
} = usePhotoRecognition(stream, recognitionOptions);
// activeGuidance is never extracted here
```

**Decision required**: Either wire `activeGuidance` to `GuidanceMessage` in `CameraView` (making the feature real), or delete both the component and the `setActiveGuidance` state machinery in `usePhotoRecognition`.

---

## 5. `src/config/guidanceConfig.ts` — Partially Dead Config Module

**Classification**: Refactor or delete
**Files**:

- `src/config/guidanceConfig.ts`
- `src/config/guidanceConfig.test.ts`
- `src/config/README.md`

**Problems**:

1. **`GuidanceType` is defined in two places**: once here and again in `src/modules/photo-recognition/types.ts:116`. They must stay in sync manually.

2. **`selectGuidanceToShow()` and `getGuidancePriority()`** are tested in `guidanceConfig.test.ts` but are never called anywhere in the app or hooks.

3. **Dead config fields**: `displayDuration`, `cooldownDuration`, `enableHaptics`, `enableAudioCues`, `showInProduction` are defined on `defaultGuidanceConfig` but are only read inside `GuidanceMessage.tsx`, which itself is not rendered (see item 4).

4. **Reference to a non-existent document**: The file and its README both reference `docs/image-recognition-exploratory-analysis.md`, which does not exist in the repository.

5. **"Future" guidance types**: `distance` and `off-center` are in the config (with full message definitions) and noted as "future" in the README, but they are never emitted by any detection logic.

**Action**: If `GuidanceMessage` is wired up (item 4 decision), keep this config but remove the dead fields and consolidate `GuidanceType`. If `GuidanceMessage` is deleted, delete this entire module.

---

## 6. `guidanceTracking` in `RecognitionTelemetry` — Initialized but Never Written

**Status**: ✅ Completed (2026-02-23)

**Classification**: Delete (field from struct and all test scaffolding)
**Files**:

- `src/modules/photo-recognition/types.ts:137–141`
- `src/modules/photo-recognition/helpers.ts` (initialization in `createEmptyTelemetry`)
- `src/utils/telemetryUtils.test.ts` (creates `guidanceTracking` objects for every test fixture)

**Problem**: The `guidanceTracking` field is part of the `RecognitionTelemetry` struct and is initialized in `createEmptyTelemetry()`. However, `usePhotoRecognition.ts` never writes to it — no `telemetryRef.current.guidanceTracking` assignments exist. The field remains at its initial zero state through the entire lifetime of a session, including the exported telemetry JSON. Its presence inflates test fixtures significantly (every `RecognitionTelemetry` test object requires a `createGuidanceTracking()` helper).

**Action**: Remove `guidanceTracking` from `RecognitionTelemetry`, remove its initialization from `createEmptyTelemetry()`, and remove the scaffolding from all test fixtures. This also simplifies the telemetry export in `App.tsx`.

**Completed work**:

- Removed `guidanceTracking` from `RecognitionTelemetry` in `src/modules/photo-recognition/types.ts`
- Removed `guidanceTracking` initialization from `createEmptyTelemetry()` in `src/modules/photo-recognition/helpers.ts`
- Removed `guidanceTracking` usage from `src/utils/telemetryUtils.ts`
- Removed stale `guidanceTracking` fixture scaffolding from:
  - `src/utils/telemetryUtils.test.ts`
  - `src/App.playbackFlow.test.tsx`
  - `src/modules/debug-overlay/DebugOverlay.test.tsx`

---

## 7. `scripts/lib/orbFeatureUtils.js` — Orphaned Algorithm (~240 lines)

**Status**: ✅ Completed (2026-02-23)

**Classification**: Delete
**File**: `scripts/lib/orbFeatureUtils.js`

**Problem**: This file implements the full ORB (Oriented FAST and Rotated BRIEF) feature detection algorithm — a completely different recognition approach from the pHash algorithm used at runtime. No other script imports it:

```bash
# grep finds no imports
grep -r "orbFeatureUtils" scripts/ → no results outside the file itself
```

`CLAUDE.md` says "Original algorithm research retained in `docs/archive/` for historical reference", but `docs/archive/` does not exist. The file is simply orphaned in `scripts/lib/`.

**Action**: Delete `scripts/lib/orbFeatureUtils.js`. If the ORB research has historical value, commit it to a git note or a private archive — it has no build or test role.

**Completed work**:

- Deleted `scripts/lib/orbFeatureUtils.js`
- Re-scanned tracked code/docs and removed non-audit ORB mentions from `docs/PHOTO_RECOGNITION_DEEP_DIVE.md`
- Purged local generated artifact traces (`coverage/`, `node_modules/.vite/`, `.claude/worktrees/*`) as part of this cleanup session

---

## 8. Legacy Data Format Fallback Infrastructure

**Classification**: Delete (after v2 cutover is confirmed complete)
**Files**:

- `public/data.json` (the legacy data file itself)
- `DataService.ts`: `legacyDataUrl`, `parseConcertsFromPayload` v1 branch, `fetchDataPayload` fallback path, `recordLegacyFallbackLoad`, `DataV2FallbackPolicy` type, `getV2FallbackPolicy`, `getPolicyDescriptor`, `getDeployEnvironment`, `readRuntimeEnv`
- `scripts/check-cutover-readiness.js` + its test
- `scripts/check-v2-artifacts.js` + its test
- `src/types/index.ts`: `ConcertData` interface (legacy v1 shape)

**Problem**: The app has fully migrated to v2 data files (`data.app.v2.json` + `data.recognition.v2.json`), but the legacy `data.json` is still in `public/` and the `DataService` still maintains an elaborate fallback system with per-environment policy logic, "Phase C" messaging, and production telemetry for legacy loads. The two check scripts exist purely to determine if it's safe to delete this fallback.

The migration tooling for monitoring cutover readiness has served its purpose. Once `public/data.json` is removed and the fallback has been stripped, `DataService` becomes significantly simpler.

**Suggested order**:

1. Confirm from telemetry that `legacyFallbackLoadsInProduction === 0`
2. Delete `public/data.json`
3. Strip the legacy fallback path from `DataService.ts`
4. Delete `check-cutover-readiness.js` and `check-v2-artifacts.js` with their tests
5. Remove `ConcertData` from `src/types/index.ts`

---

## 9. `DataService.setTestMode()` / `getTestMode()` — No-Op Flag

**Classification**: Refactor
**File**: `src/services/data-service/DataService.ts:69–84`

**Problem**: The "Test Data Mode" feature flag in the secret settings calls `dataService.setTestMode(enabled)`, but the method has no real effect:

```ts
private readonly productionDataUrl = '/data.app.v2.json';
private readonly testDataUrl = this.developmentDataUrl;       // same URL
private readonly developmentDataUrl = this.productionDataUrl; // same URL
```

All three URLs resolve to `/data.app.v2.json`. Enabling test mode just logs "Data will be loaded from: /data.app.v2.json" — the same as production. The feature flag toggle in secret settings appears functional but changes nothing about data loading.

Separately, `App.tsx` hardcodes `isTestMode={false}` on `DebugOverlay`, so the debug overlay always shows "LIVE DATA" regardless of flag state.

**Action**: Either make test mode meaningful (pointing to a real separate test data file) or remove the flag, the `setTestMode`/`getTestMode` methods, their sync in `useFeatureFlags.ts`, the "test-mode" entry in `FEATURE_FLAGS`, and the `isTestMode` prop from `DebugOverlay`.

---

## 10. `DataService.getRandomConcert()` and `search()` — Unused Public API

**Status**: ✅ Completed (2026-02-23)

**Classification**: Delete
**File**: `src/services/data-service/DataService.ts`

**Problem**: Both methods are fully implemented, well-tested, and maintained — but they are never called by any component or hook in the application.

- `getRandomConcert()`: No references outside tests
- `search()`: No references outside tests and the service's own README

**Action**: Delete both methods and their tests. If a search feature is desired in the future, it can be re-added with a real UI at that time.

**Completed work**:

- Deleted `search()` and `getRandomConcert()` from `src/services/data-service/DataService.ts`
- Removed `getTimestampSearchText` import no longer used by `DataService`
- Deleted method-specific and dependent test coverage from `src/services/data-service/DataService.test.ts`
- Updated `src/services/data-service/README.md` API contract and usage examples

---

## 11. `DebugOverlay` prop `isTestMode` hardcoded to `false`

**Status**: ✅ Completed (2026-02-23)

**Classification**: Refactor (minor)
**File**: `src/App.tsx`

**Problem**: `isTestMode={false}` is hardcoded on the `DebugOverlay`. The secret settings has a "Test Data Mode" flag, but it is never passed through to the overlay. This means the "TEST DATA / LIVE DATA" badge in the overlay is permanently stuck on "LIVE DATA".

**Action**: Either wire the feature flag value through, or remove the `isTestMode` prop from `DebugOverlay` entirely (removing the badge text and the prop from its type definition).

**Completed work**:

- Removed `isTestMode` prop from `DebugOverlay` usage in `src/App.tsx`
- Removed `isTestMode` from `DebugOverlayProps` in `src/modules/debug-overlay/types.ts`
- Removed TEST/LIVE data badge rendering tied to `isTestMode` in `src/modules/debug-overlay/DebugOverlay.tsx`
- Updated `src/modules/debug-overlay/DebugOverlay.test.tsx` for the new prop contract

---

## 12. Stale Documentation References

**Status**: ✅ Completed (2026-02-23)

**Classification**: Refactor (docs)

Several source files and READMEs reference documents that do not exist:

| Reference                                        | Location                                                                                                  | Status         |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | -------------- |
| `docs/image-recognition-exploratory-analysis.md` | `guidanceConfig.ts`, `GuidanceMessage.tsx`, `guidanceConfig/README.md`, `create-edge-case-test-images.js` | Does not exist |
| `IMPLEMENTATION_PLAN_GUIDANCE_SYSTEM.md`         | `src/config/README.md`                                                                                    | Does not exist |
| `docs/archive/` directory                        | `CLAUDE.md` ("Original algorithm research retained in docs/archive/")                                     | Does not exist |

**Action**: Either create the referenced documents or update the code comments and READMEs to remove the broken references.

**Completed work**:

- Replaced stale exploratory-analysis references in:
  - `src/config/guidanceConfig.ts`
  - `src/modules/photo-recognition/GuidanceMessage.tsx`
  - `src/config/README.md`
  - `scripts/create-edge-case-test-images.js`
- Removed stale `IMPLEMENTATION_PLAN_GUIDANCE_SYSTEM.md` reference from `src/config/README.md`
- Removed stale `docs/archive/` claim from `CLAUDE.md`

---

## Summary Table

| #   | Item                             | Files                                               | Action                       | Risk   |
| --- | -------------------------------- | --------------------------------------------------- | ---------------------------- | ------ |
| 1   | `useCustomSettings` hook         | `useCustomSettings.ts`, `.test.ts`                  | ✅ Completed (2026-02-23)    | Low    |
| 2   | `CustomSetting.engines` field    | `types.ts`                                          | ✅ Completed (2026-02-23)    | Low    |
| 3   | `FrameQualityIndicator`          | `FrameQualityIndicator.tsx`, `.css`                 | ✅ Completed (2026-02-23)    | Low    |
| 4   | `GuidanceMessage` (not rendered) | `GuidanceMessage.tsx`, `.css`                       | Wire up or delete            | Medium |
| 5   | `guidanceConfig.ts` module       | `guidanceConfig.ts`, `.test.ts`, `README.md`        | Depends on #4 decision       | Medium |
| 6   | `guidanceTracking` in telemetry  | `types.ts`, `helpers.ts`, test fixtures             | ✅ Completed (2026-02-23)    | Low    |
| 7   | `orbFeatureUtils.js`             | `scripts/lib/orbFeatureUtils.js`                    | ✅ Completed (2026-02-23)    | Low    |
| 8   | Legacy data fallback system      | `DataService.ts`, `data.json`, check scripts        | Delete after cutover confirm | High   |
| 9   | `setTestMode` / test-mode flag   | `DataService.ts`, `useFeatureFlags.ts`, `config.ts` | Refactor or delete           | Medium |
| 10  | `getRandomConcert` / `search`    | `DataService.ts`, `.test.ts`                        | ✅ Completed (2026-02-23)    | Low    |
| 11  | `isTestMode` hardcoded prop      | `App.tsx`                                           | ✅ Completed (2026-02-23)    | Low    |
| 12  | Broken doc references            | Multiple                                            | ✅ Completed (2026-02-23)    | Low    |

---

## Suggested Order of Work

**Phase 1 — Safe deletes (no functional impact)**

- Items 1, 2, 3, 6, 7, 10, 11, 12 ✅ Completed (2026-02-23)

**Phase 2 — Requires a decision**

- Items 4 + 5 together (wire up guidance UI or delete the whole guidance system)

**Phase 3 — Requires data validation first**

- Item 8 (legacy data fallback): confirm telemetry, then remove

**Phase 4 — Feature clarification**

- Item 9 (test mode flag): decide if test mode is a real feature or remove it
