# Secret Settings - Developer Guide

> **Purpose**: Implementation guide for extending the secret settings menu in the current flags-only architecture.

---

## Current Model (Feb 2026)

Secret Settings is intentionally narrow:

- Feature flags only (boolean toggles)
- No active runtime custom-setting controls in the UI
- Single curated app appearance (`data-theme='dark'`)
- No `data-ui-style` attribute and no style mode switching

This keeps recognition/runtime behavior predictable across devices and simplifies support.

---

## Module Map

```text
src/modules/secret-settings/
├── README.md
├── DEVELOPER_GUIDE.md
├── types.ts
├── config.ts
├── useTripleTap.ts
├── useFeatureFlags.ts
├── useCustomSettings.ts              # compatibility no-op
├── useSecretSettingsController.ts
├── SecretSettings.tsx
├── SecretSettings.module.css
└── *.test.ts(x)
```

---

## Storage Contracts

### Feature flags (active)

- Key: `photo-signal-feature-flags`
- Shape: array of `{ id: string; enabled: boolean; ... }`
- Managed by `useFeatureFlags`

### Custom settings (legacy)

- Legacy key may still exist: `photo-signal-custom-settings`
- Current runtime does not use those values to tune recognition behavior
- Keep reads/writes backward-compatible only when needed for migration safety

---

## Adding a New Feature Flag

### 1) Define config

Edit `src/modules/secret-settings/config.ts`:

```ts
export const FEATURE_FLAGS: FeatureFlag[] = [
  // existing flags...
  {
    id: 'my-flag',
    name: 'My Flag',
    description: 'What this toggles',
    enabled: false,
    category: 'experimental',
  },
];
```

Guidelines:

- Use stable `kebab-case` IDs
- Keep descriptions user-facing and concrete
- Default to `false` unless the feature is safe for broad runtime use

### 2) Wire behavior in consuming module

Use `useFeatureFlags()` where behavior branches:

```ts
const { isEnabled } = useFeatureFlags();

if (isEnabled('my-flag')) {
  // enabled path
}
```

### 3) Keep UX scoped

`SecretSettings.tsx` should remain focused on feature flags + save/reload action.
Avoid reintroducing parameter sliders/selects unless there is an approved architecture change.

---

## UI + Accessibility Rules

- Modal must keep focus trap and `Escape` close behavior
- Keep checkbox hit targets touch-friendly
- Preserve mode badge semantics (`Test Mode` / `Production Mode`)
- Keep copy aligned with flags-only model (no mention of active custom tuning)

---

## Testing Checklist

When changing this module, update and run:

1. Unit/component tests in `src/modules/secret-settings/*.test.ts(x)`
2. Integration tests:
   - `src/__tests__/integration/feature-flags.test.tsx`
   - `src/__tests__/integration/app-lifecycle.test.tsx`
3. Visual tests:
   - `tests/visual/secret-settings.spec.ts`

Then run full quality gate:

```bash
npm run pre-commit
```

---

## Common Pitfalls

- Reintroducing removed style modes (`ui-style`, classic/light branches)
- Reintroducing runtime recognition tuning in settings UI
- Assuming legacy `photo-signal-custom-settings` values are still active runtime inputs
- Adding visual assertions without deterministic screenshot thresholds

---

## Decision Record

- Theme policy: single curated dark theme
- Settings policy: feature flags only for now
- Runtime recognition policy: hardcoded curated defaults + runtime safeguards

If product direction changes, update this guide and module README in the same PR.
