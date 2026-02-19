# Secret Settings Module

> **Purpose**: Provides a hidden settings menu activated by triple-tap/click for toggling feature flags.

---

## Overview

The Secret Settings module implements a hidden menu that can be activated by triple-tapping or triple-clicking in the center of the screen. This menu provides feature flag toggles for experimental functionality. All recognition parameters are hardcoded with sensible defaults — no numeric tuning is exposed to the user.

### Implemented Feature Flags

1. **Test Data Mode** (`test-mode`) - Use test concert data with working photo hashes and sample assets
2. **Dynamic Rectangle Detection** (`rectangle-detection`) - Automatically detect photo boundaries in the camera feed

---

## Module Structure

```
src/modules/secret-settings/
├── README.md                       # This file (API contract, usage)
├── DEVELOPER_GUIDE.md             # Comprehensive guide for adding features
├── index.ts                        # Public API exports
├── types.ts                        # TypeScript interfaces
├── config.ts                       # Feature flag configuration
├── useTripleTap.ts                # Triple-tap detection hook
├── useFeatureFlags.ts             # Feature flags state management
├── useCustomSettings.ts           # Compatibility no-op hook (no user-tweakable settings)
├── SecretSettings.tsx             # Settings UI component
├── SecretSettings.module.css      # Component styles
└── *.test.ts(x)                   # Test files
```

---

## API Contract

### `useTripleTap` Hook

Detects **rapid** triple-tap/click gestures in the center of the screen.

**Timing Requirement:**

Each tap must occur **within 500ms** (configurable) of the **previous tap**. The timeout resets after every tap to stay resilient under heavier workloads.

**Examples:**

✅ **Valid (triggers callback):**

```
Tap 1 (t=0ms)
Tap 2 (t=200ms)
Tap 3 (t=400ms)
→ Total time: 400ms ✅
```

❌ **Invalid (does NOT trigger when any gap ≥ 500ms):**

```
Tap 1 (t=0ms)
Tap 2 (t=300ms)
Tap 3 (t=600ms)
→ Gap between Tap 2 and Tap 3 is 300ms ✅
→ If the gap hits 500ms or more, the sequence resets ❌
```

**Type Signature:**

```typescript
function useTripleTap(options: UseTripleTapOptions): void;

interface UseTripleTapOptions {
  tapTimeout?: number; // Default: 500ms
  onTripleTap: () => void;
}
```

**Parameters:**

- `tapTimeout` (optional): Maximum time window (in milliseconds) between taps (default: 500ms)
- `onTripleTap`: Callback function triggered when triple-tap is detected

**Behavior:**

- Monitors both `click` (desktop) and `touchend` (mobile) events
- Only counts taps/clicks in the center third of the screen/window
- Timeout restarts on every tap; any single gap ≥ timeout clears the sequence
- Resets count to 0 when timeout expires
- Cross-platform compatible (desktop, mobile, web)

**Example:**

```typescript
import { useTripleTap } from './modules/secret-settings';

function MyComponent() {
  const [showSettings, setShowSettings] = useState(false);

  useTripleTap({
    tapTimeout: 500,
    onTripleTap: () => setShowSettings(true),
  });

  return (
    <div>
      {/* Your content */}
      <SecretSettings isVisible={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
```

---

### `SecretSettings` Component

Modal/page component that displays feature flags.

**Type Signature:**

```typescript
function SecretSettings(props: SecretSettingsProps): JSX.Element | null;

interface SecretSettingsProps {
  isVisible: boolean;
  onClose: () => void;
}
```

**Props:**

- `isVisible`: Whether the settings page is visible
- `onClose`: Callback to close the settings page

**Features:**

- Full-screen modal overlay
- Feature flag toggles with instant preview
- **"Send It 🚀" button** - Applies all changes and reloads page
- Responsive design (mobile and desktop)
- Keyboard accessible (ESC to close - future feature)
- Retro sound integration

**Example:**

```typescript
import { SecretSettings } from './modules/secret-settings';

function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Your app content */}
      <SecretSettings isVisible={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
```

---

### `useFeatureFlags` Hook

Manages feature flag state with localStorage persistence.

**Type Signature:**

```typescript
function useFeatureFlags(): {
  flags: FeatureFlag[];
  toggleFlag: (id: string) => void;
  setFlagState: (id: string, enabled: boolean) => void;
  isEnabled: (id: string) => boolean;
  resetFlags: () => void;
};
```

**Returns:**

- `flags`: Array of all feature flags with current state
- `toggleFlag(id)`: Toggle a specific flag on/off
- `setFlagState(id, enabled)`: Explicitly set a flag to a desired state
- `isEnabled(id)`: Check if a flag is currently enabled
- `resetFlags()`: Reset all flags to default values

**Example:**

```typescript
import { useFeatureFlags } from './modules/secret-settings';

function MyComponent() {
  const { isEnabled } = useFeatureFlags();

  if (isEnabled('test-mode')) {
    // Enable test data mode
  }

  return <div>...</div>;
}
```

---

### `useCustomSettings` Hook

Compatibility no-op hook. Recognition parameters are intentionally hardcoded and self-tune at runtime.

**Type Signature:**

```typescript
function useCustomSettings(): {
  settings: CustomSetting[];
  updateSetting: (id: string, value: string | number | boolean) => void;
  getSetting: <T>(id: string) => T | undefined;
  resetSettings: () => void;
};
```

**Returns:**

- `settings`: Always empty
- `updateSetting(id, value)`: No-op helper
- `getSetting<T>(id)`: Always returns `undefined`
- `resetSettings()`: No-op helper

**Example:**

```typescript
import { useCustomSettings } from './modules/secret-settings';

function App() {
  const { getSetting } = useCustomSettings();
  const delay = getSetting<number>('recognition-delay');

  console.log('Recognition delay:', delay);
}
```

---

## Integration Guide

### Complete Integration Example

```typescript
// App.tsx
import { useState, useEffect } from 'react';
import {
  useTripleTap,
  SecretSettings,
  useFeatureFlags,
} from './modules/secret-settings';

function App() {
  const [showSettings, setShowSettings] = useState(false);

  // Feature flags
  const { isEnabled } = useFeatureFlags();

  // Detect triple-tap to open settings
  useTripleTap({
    onTripleTap: () => {
      setShowSettings(true);
      playRandomSound(); // Play sound when menu opens
    },
  });

  // Apply fixed app appearance
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.setAttribute('data-ui-style', 'modern');
  }, []);

  return (
    <>
      {/* Your app content */}

      {/* Secret settings menu */}
      <SecretSettings
        isVisible={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
}
```

### Step 2: Keep the Curated Theme

The app ships with one curated visual style. Keep global CSS focused on that single mode.

```css
:root {
  --color-background: #0a0a0a;
  --color-text: #f5f5f5;
  --color-accent: #4a90e2;
}

body {
  background: var(--color-background);
  color: var(--color-text);
  transition:
    background-color 0.3s ease,
    color 0.3s ease;
}
```

### Step 3: Test the Features

1. Open the app in a browser
2. Triple-click rapidly in the center of the screen
3. The secret settings menu should appear
4. Try toggling each feature flag:
   - **Test Data Mode**: Use test concert data with sample hashes and assets
   - **Dynamic Rectangle Detection**: Auto-detect photo boundaries in the camera feed
5. Click **"Send It 🚀"** to apply changes and reload the page
6. Verify all changes persist after reload

**Why the "Send It" button?**

Some feature flags require a full page reload to take effect properly:

- Camera settings (require reinitializing MediaStream)
- Audio playback settings (require reinitializing Howler.js)

The "Send It" button ensures all changes are guaranteed to work by:

1. Closing the menu
2. Waiting 100ms for close animation
3. Reloading the page with all new settings active

---

## Adding New Features

For detailed information on adding new feature flags, see **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)**.

The guide includes:

- Step-by-step instructions for adding feature flags
- Best practices and patterns
- Testing guidelines
- Complete code examples

---

## Current Features

### Feature Flags

1. **Test Data Mode** (`test-mode`)
   - Use test concert data with working photo hashes and sample assets
   - Enable debug overlay for development
   - Automatically reset recognition after matches
2. **Dynamic Rectangle Detection** (`rectangle-detection`)
   - Automatically detect photo boundaries in the camera feed
   - Visual feedback when a rectangle is detected
   - Dynamic cropping instead of fixed aspect-ratio guides

### Custom Settings

No custom settings are currently defined. All recognition parameters (thresholds, delays, scan interval) are hardcoded with sensible defaults and self-tune at runtime. See `docs/PHOTO_RECOGNITION_DEEP_DIVE.md` for the rationale behind each value.

---

## Accessibility

- Modal is keyboard accessible
- ARIA attributes for screen readers (`role="dialog"`, `aria-modal="true"`)
- Clear visual focus indicators
- Curated default theme meets WCAG AA contrast standards (4.5:1)

---

## Performance

- **Triple-tap detection**: Minimal overhead, only monitors events
- **Modal rendering**: Conditional rendering (only when visible)
- **CSS animations**: Hardware-accelerated transforms
- **localStorage**: Automatic state persistence with error handling
- **No external dependencies**: Uses only React and native browser APIs

---

## Testing

All hooks and components have comprehensive test coverage:

- `useTripleTap.test.ts` - Triple-tap detection logic
- `useFeatureFlags.test.ts` - Feature flag state management
- `useCustomSettings.test.ts` - Custom settings state management
- `SecretSettings.test.tsx` - Component rendering and interactions

Run tests with:

```bash
npm test
```

---

## Future Enhancements

- [ ] Add keyboard support (ESC to close modal)
- [ ] Add focus trap for improved accessibility
- [ ] Add animations for flag/setting changes
- [ ] Add search/filter for settings
- [ ] Add import/export settings functionality
- [ ] Add settings categories/tabs
- [ ] Add motion sensitivity setting

---

## Dependencies

- **React**: UI framework
- **TypeScript**: Type safety
- **CSS Modules**: Scoped styling

**No new npm dependencies added.** Features use only React built-in hooks and native browser APIs.

---

## Contributing

When adding new features:

1. Define the flag/setting in appropriate config file
2. Implement the feature (component, hook, effect)
3. Update this README with feature description
4. Add tests for new functionality
5. Update DEVELOPER_GUIDE.md with implementation details
6. Update DOCUMENTATION_INDEX.md if new files added
7. Test in both desktop and mobile browsers

See **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)** for detailed instructions.

---

## Examples

### Using Feature Flags in Your Code

```typescript
import { useFeatureFlags } from './modules/secret-settings';

function PhotoRecognitionModule() {
  const { isEnabled } = useFeatureFlags();

  if (isEnabled('experimental-feature')) {
    // Use new experimental code
    return <ExperimentalComponent />;
  } else {
    // Use stable code
    return <StableComponent />;
  }
}
```

---

## License

MIT © Miles Camp
