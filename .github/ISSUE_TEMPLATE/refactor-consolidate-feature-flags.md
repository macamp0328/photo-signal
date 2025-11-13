---
name: Refactor - Consolidate Duplicate Feature Flag Systems
about: Eliminate the dual feature flag architecture and consolidate into a single system controlled by the secret settings menu
title: '[REFACTOR]: Consolidate Duplicate Feature Flag Systems into Single Source of Truth'
labels: refactor, architecture, feature-flags, priority-high
assignees: ''
---

## Problem Statement

The codebase currently has **TWO separate feature flag systems** that create confusion, maintenance burden, and potential for bugs:

1. **Old System**: `src/contexts/FeatureFlagContext.tsx`
   - Provides global context with `isTestMode` and `isGrayscaleMode`
   - Uses old storage key: `photo-signal:feature-flags` (note the colon)
   - Consumed by `photo-recognition` module
   - Manually syncs with secret-settings via custom events

2. **New System**: `src/modules/secret-settings/useFeatureFlags.ts`
   - Provides hook-based state management
   - Uses new storage key: `photo-signal-feature-flags` (note the hyphen)
   - Powers the Secret Settings UI
   - Syncs with `dataService.setTestMode()`

This creates:

- ❌ **Data Inconsistency**: Two different localStorage keys
- ❌ **Complex Syncing**: Custom events to bridge systems
- ❌ **Maintainability**: Feature flags must be added in multiple places
- ❌ **Confusion**: Developers don't know which system to use
- ❌ **Violation of DRY**: Duplicate state management logic

## Objective

Consolidate into a **single feature flag system** that:

- ✅ Is controlled exclusively through the Secret Settings menu UI
- ✅ Uses the secret-settings module's architecture (`useFeatureFlags` hook)
- ✅ Can be consumed anywhere in the app without duplication
- ✅ Maintains backward compatibility during migration
- ✅ Follows the modular architecture principles in ARCHITECTURE.md

## Expected Feature Flags After Consolidation

The consolidated system should have **exactly 4 feature flags** (all currently defined in `featureFlagConfig.ts`):

1. **`test-mode`** (Development)
   - Name: "Test Data Mode"
   - Description: Use test data from assets/test-\* directories instead of production data
   - Currently syncs with: `dataService.setTestMode()`
   - Used by: Data service for switching data sources

2. **`grayscale-mode`** (Experimental)
   - Name: "Grayscale Conversion"
   - Description: Convert camera frames to black and white before photo recognition
   - Currently syncs with: Old context `isGrayscaleMode`
   - Used by: Photo recognition module

3. **`psychedelic-mode`** (UI)
   - Name: "Psychedelic Color Cycle Mode"
   - Description: Enable vibrant gradient overlays and liquid light show effects
   - Used by: `PsychedelicEffect` component

4. **`retro-sounds`** (UI)
   - Name: "Old-School Easter Egg Sounds"
   - Description: Play random retro system sounds (modem noise, video-game beeps)
   - Used by: `useRetroSounds` hook throughout the app

All flags default to `enabled: false` and persist to localStorage.

## Architecture Decision

**Chosen Approach**: **Promote secret-settings module to be the single source of truth**

**Rationale**:

1. Secret-settings already has comprehensive UI for managing flags
2. Already integrates with `dataService` for test-mode
3. More extensible (supports categories, descriptions, reset functionality)
4. Better aligned with the "Settings Panel" pattern from DEVELOPER_GUIDE.md
5. Follows the modular architecture (isolated, well-documented)

## Tasks

### Phase 1: Preparation (No Breaking Changes)

- [ ] **Audit all consumers** of `FeatureFlagContext`
  - [ ] Find all imports of `useFeatureFlags` from `./contexts`
  - [ ] Document what each consumer needs (test-mode, grayscale-mode, etc.)
  - [ ] Create migration checklist

- [ ] **Export secret-settings hooks globally**
  - [ ] Export `useFeatureFlags` from `src/modules/secret-settings/index.ts` (already done)
  - [ ] Create convenience re-export in `src/contexts/index.ts` pointing to secret-settings
  - [ ] Add deprecation notice to old `FeatureFlagContext.tsx`

### Phase 2: Migration

- [ ] **Update all consumers** to use secret-settings hook
  - [ ] `src/modules/photo-recognition/usePhotoRecognition.ts`
    - Replace: `import { useFeatureFlags } from '../../contexts'`
    - With: `import { useFeatureFlags } from '../secret-settings'`
    - Update usage: `isEnabled('grayscale-mode')` instead of `isGrayscaleMode`
  - [ ] Any other consumers found in Phase 1 audit

- [ ] **Update tests**
  - [ ] Update mocks to use new hook signature
  - [ ] Ensure `isEnabled('flag-id')` pattern works
  - [ ] Verify localStorage uses correct key

- [ ] **Migrate localStorage data** (if needed)
  - [ ] Add migration utility to convert old storage format to new
  - [ ] Run migration on app initialization (one-time)
  - [ ] Log migration success for debugging

### Phase 3: Cleanup

- [ ] **Delete old context system**
  - [ ] Remove `src/contexts/FeatureFlagContext.tsx`
  - [ ] Update `src/contexts/index.ts` to only export convenience re-exports
  - [ ] Remove custom event listeners (`feature-flags-updated`)
- [ ] **Update documentation**
  - [ ] Update ARCHITECTURE.md to document single feature flag system
  - [ ] Update secret-settings/DEVELOPER_GUIDE.md with global usage patterns
  - [ ] Update DOCUMENTATION_INDEX.md if file structure changes

- [ ] **Verify integration**
  - [ ] Test in browser: Triple-tap → toggle flags → verify features work
  - [ ] Test grayscale mode works in photo recognition
  - [ ] Test test-mode toggles data source correctly
  - [ ] Verify localStorage persistence works

### Phase 4: Quality Assurance

- [ ] **Run all quality checks**

  ```bash
  npm run lint:fix
  npm run format
  npm run type-check
  npm run test:run
  npm run build
  ```

- [ ] **Manual testing checklist**
  - [ ] Open secret settings (triple-tap)
  - [ ] Toggle each feature flag
  - [ ] Verify flag state persists after page reload
  - [ ] Verify photo recognition responds to grayscale-mode toggle
  - [ ] Verify test-mode switches data source
  - [ ] Test on mobile device

## Acceptance Criteria

- [ ] Only ONE feature flag system exists in the codebase
- [ ] **Exactly 4 feature flags** are defined in `src/modules/secret-settings/featureFlagConfig.ts`:
  - [ ] `test-mode` - switches data source (dev)
  - [ ] `grayscale-mode` - enables B&W conversion (experimental)
  - [ ] `psychedelic-mode` - visual effects (ui)
  - [ ] `retro-sounds` - audio easter eggs (ui)
- [ ] All feature flags are defined in `src/modules/secret-settings/featureFlagConfig.ts`
- [ ] All modules use `useFeatureFlags()` hook from `secret-settings`
- [ ] Usage pattern: `isEnabled('flag-id')` consistently throughout app
- [ ] No more `FeatureFlagContext` or dual localStorage keys
- [ ] All tests pass (296+ tests)
- [ ] Build succeeds with no TypeScript errors
- [ ] Bundle size remains within limits (140KB)
- [ ] Documentation updated to reflect single system

## Files to Modify

**To Delete**:

- `src/contexts/FeatureFlagContext.tsx` ❌ (remove entire file)

**To Update**:

- `src/modules/photo-recognition/usePhotoRecognition.ts` (change import and usage)
- `src/contexts/index.ts` (remove FeatureFlagProvider, add re-export)
- `src/main.tsx` (remove FeatureFlagProvider wrapper if present)
- `src/App.test.tsx` (update test setup)
- `ARCHITECTURE.md` (document single feature flag system)
- `DOCUMENTATION_INDEX.md` (remove deleted file entry)

**To Review**:

- `src/modules/secret-settings/useFeatureFlags.ts` (ensure it's production-ready)
- `src/modules/secret-settings/featureFlagConfig.ts` (verify all flags present)
- `src/modules/secret-settings/DEVELOPER_GUIDE.md` (add global usage section)

## Dependencies

None - This is a pure refactoring task that can be done anytime.

**Recommended**: Do this BEFORE adding more features that use feature flags.

## Estimated Effort

**6-8 hours** for a careful, test-driven refactoring

Breakdown:

- Phase 1 (Audit): 1-2 hours
- Phase 2 (Migration): 2-3 hours
- Phase 3 (Cleanup): 1-2 hours
- Phase 4 (QA): 2 hours

## Technical Debt Context

This dual system emerged from:

1. Original `FeatureFlagContext` created for `test-mode` and `grayscale-mode`
2. Later, secret-settings module created with better architecture
3. Merge conflict resolution kept both systems alive
4. Quick fix: synced them with custom events instead of consolidating

**This issue resolves that technical debt.**

## References

- [ARCHITECTURE.md](../../ARCHITECTURE.md) - Module isolation principles
- [secret-settings/DEVELOPER_GUIDE.md](../../src/modules/secret-settings/DEVELOPER_GUIDE.md) - Feature flag best practices
- [secret-settings/README.md](../../src/modules/secret-settings/README.md) - API contract
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Code quality standards

## Success Indicators

When complete, developers should:

- ✅ Only import `useFeatureFlags` from `secret-settings` module
- ✅ Use `isEnabled('flag-id')` pattern consistently
- ✅ Add new flags by editing ONE file: `featureFlagConfig.ts`
- ✅ See flags appear automatically in Secret Settings UI
- ✅ Have confidence in single source of truth for all feature state

---

**Note for AI Agents**: This refactoring requires careful attention to:

1. Not breaking existing features during migration
2. Updating all imports correctly
3. Maintaining test coverage
4. Following the principle of "make it work, keep it working, make it better"

Take a systematic approach: audit → migrate → verify → cleanup → document.
