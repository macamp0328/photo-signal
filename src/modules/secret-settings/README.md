# Secret Settings Module

> **Purpose**: Provides a hidden settings menu activated by triple-tap/click for feature flags and custom settings.

---

## Overview

The Secret Settings module implements a hidden menu that can be activated by triple-tapping or triple-clicking in the center of the screen. This menu provides:

- **Feature Flags**: Toggle experimental and creative features on/off
- **Custom Settings**: Adjust advanced parameters and UI preferences

### Implemented Features

**Feature Flags:**

1. **Psychedelic Color Cycle Mode** - Vibrant gradient overlays with liquid light show effects
2. **Old-School Easter Egg Sounds** - Retro system sounds (beeps, clicks, whooshes, modem synthesized via Web Audio API)

**Custom Settings:**

3. **Theme Mode** - Switch between light and dark visual themes
4. **UI Style** - Toggle between modern and classic retro gallery experience

---

## Module Structure

```
src/modules/secret-settings/
├── README.md                       # This file (API contract, usage)
├── DEVELOPER_GUIDE.md             # Comprehensive guide for adding features
├── index.ts                        # Public API exports
├── types.ts                        # TypeScript interfaces
├── featureFlagConfig.ts           # Feature flag definitions
├── customSettingsConfig.ts        # Custom settings definitions
├── useTripleTap.ts                # Triple-tap detection hook
├── useFeatureFlags.ts             # Feature flags state management
├── useCustomSettings.ts           # Custom settings state management
├── useRetroSounds.ts              # Retro sound effects hook
├── SecretSettings.tsx             # Settings UI component
├── PsychedelicEffect.tsx          # Psychedelic visual effect component
├── SecretSettings.module.css      # Component styles
├── PsychedelicEffect.module.css   # Effect styles
└── *.test.ts(x)                   # Test files
```

---

## API Contract

### `useTripleTap` Hook

Detects **rapid** triple-tap/click gestures in the center of the screen.

**Timing Requirement:**

All three taps must occur **within 500ms** (configurable) from the **first tap**.

**Examples:**

✅ **Valid (triggers callback):**

```
Tap 1 (t=0ms)
Tap 2 (t=200ms)
Tap 3 (t=400ms)
→ Total time: 400ms ✅
```

❌ **Invalid (does NOT trigger):**

```
Tap 1 (t=0ms)
Tap 2 (t=300ms)
Tap 3 (t=600ms)
→ Timeout expired at t=500ms ❌
→ Count was reset, tap 3 is now first tap
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

- `tapTimeout` (optional): Maximum time window (in milliseconds) for completing all three taps, measured from the first tap (default: 500ms)
- `onTripleTap`: Callback function triggered when triple-tap is detected

**Behavior:**

- Monitors both `click` (desktop) and `touchend` (mobile) events
- Only counts taps/clicks in the center third of the screen/window
- Timeout starts on FIRST tap and does NOT reset on subsequent taps
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

Modal/page component that displays feature flags and custom settings.

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
- Custom setting controls with instant preview
- **"Send It 🚀" button** - Applies all changes and reloads page
- Reset buttons for flags and settings
- Responsive design (mobile and desktop)
- Keyboard accessible (ESC to close - future feature)
- Placeholder sections for future features
- Developer documentation built-in
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
  isEnabled: (id: string) => boolean;
  resetFlags: () => void;
};
```

**Returns:**

- `flags`: Array of all feature flags with current state
- `toggleFlag(id)`: Toggle a specific flag on/off
- `isEnabled(id)`: Check if a flag is currently enabled
- `resetFlags()`: Reset all flags to default values

**Example:**

```typescript
import { useFeatureFlags } from './modules/secret-settings';

function MyComponent() {
  const { isEnabled } = useFeatureFlags();

  if (isEnabled('psychedelic-mode')) {
    // Enable psychedelic visual effects
  }

  return <div>...</div>;
}
```

---

### `useCustomSettings` Hook

Manages custom settings state with localStorage persistence.

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

- `settings`: Array of all custom settings with current values
- `updateSetting(id, value)`: Update a specific setting value
- `getSetting<T>(id)`: Get current value of a setting
- `resetSettings()`: Reset all settings to default values

**Example:**

```typescript
import { useCustomSettings } from './modules/secret-settings';

function App() {
  const { getSetting } = useCustomSettings();
  const theme = getSetting<string>('theme-mode');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme || 'dark');
  }, [theme]);
}
```

---

### `useRetroSounds` Hook

Provides retro sound effect playback using Web Audio API.

**Type Signature:**

```typescript
function useRetroSounds(enabled: boolean): {
  playRandomSound: () => void;
};
```

**Parameters:**

- `enabled`: Whether retro sounds should be active

**Returns:**

- `playRandomSound()`: Play a random retro sound effect

**Example:**

```typescript
import { useFeatureFlags, useRetroSounds } from './modules/secret-settings';

function MyButton() {
  const { isEnabled } = useFeatureFlags();
  const { playRandomSound } = useRetroSounds(isEnabled('retro-sounds'));

  const handleClick = () => {
    playRandomSound();
    // ... other logic
  };

  return <button onClick={handleClick}>Click me</button>;
}
```

---

### `PsychedelicEffect` Component

Visual effect component that displays animated gradient overlays.

**Type Signature:**

```typescript
function PsychedelicEffect(props: PsychedelicEffectProps): JSX.Element | null;

interface PsychedelicEffectProps {
  enabled: boolean;
}
```

**Props:**

- `enabled`: Whether the psychedelic effect is active

**Example:**

```typescript
import { useFeatureFlags, PsychedelicEffect } from './modules/secret-settings';

function App() {
  const { isEnabled } = useFeatureFlags();

  return (
    <>
      {/* Your app content */}
      <PsychedelicEffect enabled={isEnabled('psychedelic-mode')} />
    </>
  );
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
  useCustomSettings,
  useRetroSounds,
  PsychedelicEffect,
} from './modules/secret-settings';

function App() {
  const [showSettings, setShowSettings] = useState(false);

  // Feature flags & custom settings
  const { isEnabled } = useFeatureFlags();
  const { getSetting } = useCustomSettings();

  // Retro sounds (when enabled)
  const { playRandomSound } = useRetroSounds(isEnabled('retro-sounds'));

  // Detect triple-tap to open settings
  useTripleTap({
    onTripleTap: () => {
      setShowSettings(true);
      playRandomSound(); // Play sound when menu opens
    },
  });

  // Apply theme changes
  useEffect(() => {
    const theme = getSetting<string>('theme-mode') ?? 'dark';
    const uiStyle = getSetting<string>('ui-style') ?? 'modern';

    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-ui-style', uiStyle);
  }, [getSetting]);

  return (
    <>
      {/* Your app content */}

      {/* Secret settings menu */}
      <SecretSettings
        isVisible={showSettings}
        onClose={() => {
          setShowSettings(false);
          playRandomSound(); // Play sound when menu closes
        }}
      />

      {/* Psychedelic effect overlay (when enabled) */}
      <PsychedelicEffect enabled={isEnabled('psychedelic-mode')} />
    </>
  );
}
```

### Step 2: Add CSS Theme Support

Update your global CSS (e.g., `index.css`) to support theme switching:

```css
:root {
  --color-background: #0a0a0a;
  --color-text: #f5f5f5;
  --color-accent: #4a90e2;
}

[data-theme='light'] {
  --color-background: #f5f5f4;
  --color-text: #0f172a;
  --color-accent: #2563eb;
}

[data-ui-style='modern'] {
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', ...;
  --border-radius: 8px;
}

[data-ui-style='classic'] {
  --font-family: 'Courier New', monospace;
  --border-radius: 0px;
}

body {
  background: var(--color-background);
  color: var(--color-text);
  font-family: var(--font-family);
  transition: all 0.3s ease;
}
```

### Step 3: Test the Features

1. Open the app in a browser
2. Triple-click rapidly in the center of the screen
3. The secret settings menu should appear
4. Try toggling each feature:
   - **Psychedelic Mode**: Enables vibrant color overlays
   - **Retro Sounds**: Plays beeps/clicks on interactions
   - **Theme Mode**: Switch between dark/light
   - **UI Style**: Switch between modern/classic
5. Click **"Send It 🚀"** to apply changes and reload the page
6. Verify all changes persist after reload

**Why the "Send It" button?**

Some feature flags require a full page reload to take effect properly:

- Camera settings (require reinitializing MediaStream)
- Theme changes (require re-rendering React tree)
- Audio playback settings (require reinitializing Howler.js)

The "Send It" button ensures all changes are guaranteed to work by:

1. Playing a retro sound (if enabled)
2. Closing the menu
3. Waiting 100ms for close animation
4. Reloading the page with all new settings active

---

## Adding New Features

For detailed information on adding new feature flags and custom settings, see **[DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md)**.

The guide includes:

- Step-by-step instructions for adding feature flags
- Step-by-step instructions for adding custom settings
- Implementation details for all four current features
- Best practices and patterns
- Testing guidelines
- Complete code examples

---

## Current Features

### Feature Flags

1. **Psychedelic Color Cycle Mode** (`psychedelic-mode`)
   - Vibrant gradient overlays with animated color cycling
   - Multiple rotating gradient layers
   - Pulsing radial effects
   - Mix-blend-mode for non-intrusive overlay
2. **Old-School Easter Egg Sounds** (`retro-sounds`)
   - Synthesized retro system sounds using Web Audio API
   - No external audio files required
   - 6 different sound variations (beeps, clicks, whooshes, modem)
   - Plays on user interactions

### Custom Settings

3. **Theme Mode** (`theme-mode`)
   - Options: Dark (default), Light
   - Global theme switching via `data-theme` attribute
   - Smooth 0.3s transitions
   - Affects background, text, and accent colors
4. **UI Style** (`ui-style`)
   - Options: Modern (default), Classic
   - Global UI style switching via `data-ui-style` attribute
   - Classic mode: Monospace fonts, sharp edges, no texture
   - Modern mode: System fonts, rounded corners, textured backgrounds

---

## Accessibility

- Modal is keyboard accessible
- ARIA attributes for screen readers (`role="dialog"`, `aria-modal="true"`)
- Clear visual focus indicators
- Both themes meet WCAG AA contrast standards (4.5:1)
- Psychedelic effect uses `pointer-events: none` to avoid blocking interaction

---

## Performance

- **Triple-tap detection**: Minimal overhead, only monitors events
- **Modal rendering**: Conditional rendering (only when visible)
- **CSS animations**: Hardware-accelerated transforms
- **Audio synthesis**: Web Audio API (more efficient than loading files)
- **localStorage**: Automatic state persistence with error handling
- **No external dependencies**: Uses only React and native browser APIs

---

## Testing

All hooks and components have comprehensive test coverage:

- `useTripleTap.test.ts` - Triple-tap detection logic
- `useFeatureFlags.test.ts` - Feature flag state management
- `useCustomSettings.test.ts` - Custom settings state management
- `SecretSettings.test.tsx` - Component rendering and interactions
- `PsychedelicEffect.test.tsx` - Visual effect component

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
- [x] Respect `prefers-reduced-motion` for psychedelic effect (✅ implemented)
- [ ] Add more retro sound variations
- [ ] Add motion sensitivity setting

---

## Dependencies

- **React**: UI framework
- **TypeScript**: Type safety
- **CSS Modules**: Scoped styling
- **Web Audio API**: Sound synthesis (native browser API)

**No new npm dependencies added.** Features use only React built-in hooks and native browser APIs (Web Audio API).

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

### Using Custom Settings in Your Code

```typescript
import { useCustomSettings } from './modules/secret-settings';

function MotionDetectionModule() {
  const { getSetting } = useCustomSettings();
  const sensitivity = getSetting<number>('motion-sensitivity') ?? 50;

  // Use sensitivity value in motion detection algorithm
  const { isMoving } = useMotionDetection(stream, { sensitivity });
}
```

---

## License

MIT © Miles Camp
