# Secret Settings

A hidden settings menu accessible via the settings icon. Houses all feature flags and an optional
"force match" shortcut for testing. Every environmental effect in the app must have a flag here.

## API

```tsx
<SecretSettings
  isVisible={boolean}
  onClose={() => void}
  onForceMatch?={() => void}
/>
```

```ts
useFeatureFlags(): { flags, toggleFlag, setFlagState, isEnabled, resetFlags }
```

- `flags` — array of `FeatureFlag` objects with current enabled state
- `isEnabled(id)` — returns `boolean` for a given flag id
- `toggleFlag(id)` — flip a flag's state and persist to localStorage
- `setFlagState(id, enabled)` — set a flag explicitly
- `resetFlags()` — restore all flags to their config defaults

Feature flags are defined in `config.ts` as a `FEATURE_FLAGS` array of `FeatureFlag` objects.
Each flag has an `id`, `name`, `description`, `enabled` default, and optional `category`
(`'ui' | 'audio' | 'experimental' | 'debugging' | 'camera' | 'development'`).

## Responsibilities

- Rendering the feature flag list with toggle controls
- Persisting flag state to `localStorage`
- Exposing `useFeatureFlags()` so any component can read flag values

## Does NOT Own

- Implementing the features the flags control (each flag's effect lives in its module)
- Deciding when the settings panel is shown (`App.tsx` controls `isVisible`)

## Dependencies

- `localStorage` (mocked in tests via `src/test/mocks.ts`)

## Key Files

- `SecretSettings.tsx` — settings panel component
- `useFeatureFlags.ts` — hook, localStorage read/write, flag state
- `config.ts` — `FEATURE_FLAGS` array; edit this to add new flags
- `types.ts` — `SecretSettingsProps`, `FeatureFlag`
