# Secret Settings Module

> **Purpose**: Provides a hidden settings menu activated by triple-tap/click for feature flags and custom settings.

---

## Overview

The Secret Settings module implements a hidden menu that can be activated by triple-tapping or triple-clicking in the center of the screen. This menu is designed to hold:

- **Feature Flags**: Toggle experimental features on/off
- **Custom Settings**: Adjust advanced parameters and preferences

This is scaffolding for future functionality. Currently, the menu displays placeholder sections with instructions for developers.

---

## Module Structure

```
src/modules/secret-settings/
├── README.md                    # This file (API contract, usage)
├── index.ts                     # Public API exports
├── types.ts                     # TypeScript interfaces
├── useTripleTap.ts             # Triple-tap detection hook
├── SecretSettings.tsx          # Settings page component
└── SecretSettings.module.css   # Component styles
```

---

## API Contract

### `useTripleTap` Hook

Detects triple-tap/click gestures in the center of the screen.

**Type Signature:**

```typescript
function useTripleTap(options: UseTripleTapOptions): void;

interface UseTripleTapOptions {
  tapTimeout?: number; // Default: 500ms
  onTripleTap: () => void;
}
```

**Parameters:**

- `tapTimeout` (optional): Maximum time between taps in milliseconds (default: 500)
- `onTripleTap`: Callback function triggered when triple-tap is detected

**Behavior:**

- Monitors both `click` (desktop) and `touchend` (mobile) events
- Only counts taps/clicks in the center third of the screen/window
- Resets count after timeout expires
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
- Responsive design (mobile and desktop)
- Keyboard accessible (ESC to close)
- Placeholder sections for future features
- Developer documentation built-in

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

## Integration Guide

### Step 1: Add to App.tsx

```typescript
// App.tsx
import { useState } from 'react';
import { useTripleTap, SecretSettings } from './modules/secret-settings';

function App() {
  const [showSettings, setShowSettings] = useState(false);

  // Detect triple-tap to open settings
  useTripleTap({
    onTripleTap: () => setShowSettings(true),
  });

  return (
    <>
      {/* Your existing app content */}

      {/* Secret settings menu */}
      <SecretSettings isVisible={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
```

### Step 2: Test the Menu

1. Open the app in a browser
2. Triple-click rapidly in the center of the screen
3. The secret settings menu should appear
4. Click the X or outside the modal to close

---

## Adding Feature Flags

**Note**: Feature flag functionality is not yet implemented. This section provides guidance for future implementation.

### Step 1: Define Feature Flags

Update `types.ts` or create a separate config file:

```typescript
// Example: src/modules/secret-settings/config.ts
import type { FeatureFlag } from './types';

export const FEATURE_FLAGS: FeatureFlag[] = [
  {
    id: 'experimental-photo-recognition',
    name: 'Experimental Photo Recognition',
    description: 'Use new ML-based photo recognition instead of placeholder',
    enabled: false,
    category: 'experimental',
  },
  {
    id: 'debug-logging',
    name: 'Debug Logging',
    description: 'Enable verbose console logging for debugging',
    enabled: false,
    category: 'debugging',
  },
  {
    id: 'audio-visualizer',
    name: 'Audio Visualizer',
    description: 'Show animated audio visualizer during playback',
    enabled: false,
    category: 'ui',
  },
];
```

### Step 2: Create State Management

Add state management for flags (useState, useContext, or localStorage):

```typescript
// Example: Using localStorage for persistence
import { useState, useEffect } from 'react';

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('feature-flags');
    return saved ? JSON.parse(saved) : FEATURE_FLAGS;
  });

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('feature-flags', JSON.stringify(flags));
  }, [flags]);

  const toggleFlag = (id: string) => {
    setFlags((prev) =>
      prev.map((flag) => (flag.id === id ? { ...flag, enabled: !flag.enabled } : flag))
    );
  };

  return { flags, toggleFlag };
}
```

### Step 3: Update SecretSettings Component

Add UI controls for toggling flags:

```typescript
// In SecretSettings.tsx
import { useFeatureFlags } from './useFeatureFlags';

export function SecretSettings({ isVisible, onClose }: SecretSettingsProps) {
  const { flags, toggleFlag } = useFeatureFlags();

  return (
    <div className={styles.modal}>
      {/* ... header ... */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>⚡ Feature Flags</h2>
        {flags.map((flag) => (
          <div key={flag.id} className={styles.flagItem}>
            <label>
              <input
                type="checkbox"
                checked={flag.enabled}
                onChange={() => toggleFlag(flag.id)}
              />
              <span>{flag.name}</span>
            </label>
            <p>{flag.description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
```

### Step 4: Use Flags in Your App

```typescript
// Example: In a module that uses feature flags
import { useFeatureFlags } from './modules/secret-settings/useFeatureFlags';

function PhotoRecognitionComponent() {
  const { flags } = useFeatureFlags();
  const useMLRecognition = flags.find((f) => f.id === 'experimental-photo-recognition')?.enabled;

  if (useMLRecognition) {
    // Use experimental ML recognition
  } else {
    // Use placeholder recognition
  }
}
```

---

## Adding Custom Settings

**Note**: Custom settings functionality is not yet implemented. This section provides guidance for future implementation.

### Step 1: Define Settings Schema

```typescript
// Example: src/modules/secret-settings/config.ts
import type { CustomSetting } from './types';

export const CUSTOM_SETTINGS: CustomSetting[] = [
  {
    id: 'motion-sensitivity',
    name: 'Motion Detection Sensitivity',
    description: 'Adjust how sensitive motion detection is (0-100)',
    type: 'number',
    value: 50,
    min: 0,
    max: 100,
    category: 'camera',
  },
  {
    id: 'audio-fade-duration',
    name: 'Audio Fade Duration',
    description: 'How long audio takes to fade out (milliseconds)',
    type: 'number',
    value: 1000,
    min: 100,
    max: 5000,
    category: 'audio',
  },
  {
    id: 'recognition-delay',
    name: 'Recognition Delay',
    description: 'Delay before triggering photo recognition (milliseconds)',
    type: 'number',
    value: 3000,
    min: 500,
    max: 10000,
    category: 'camera',
  },
  {
    id: 'theme',
    name: 'Theme',
    description: 'Visual theme for the app',
    type: 'select',
    value: 'dark',
    options: [
      { label: 'Dark', value: 'dark' },
      { label: 'Light', value: 'light' },
      { label: 'Auto', value: 'auto' },
    ],
    category: 'ui',
  },
];
```

### Step 2: Create Settings State Management

```typescript
// Example: useCustomSettings.ts
import { useState, useEffect } from 'react';

export function useCustomSettings() {
  const [settings, setSettings] = useState<CustomSetting[]>(() => {
    const saved = localStorage.getItem('custom-settings');
    return saved ? JSON.parse(saved) : CUSTOM_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem('custom-settings', JSON.stringify(settings));
  }, [settings]);

  const updateSetting = (id: string, value: string | number | boolean) => {
    setSettings((prev) => prev.map((s) => (s.id === id ? { ...s, value } : s)));
  };

  const getSetting = (id: string) => {
    return settings.find((s) => s.id === id)?.value;
  };

  return { settings, updateSetting, getSetting };
}
```

### Step 3: Add UI Controls

```typescript
// In SecretSettings.tsx
import { useCustomSettings } from './useCustomSettings';

export function SecretSettings({ isVisible, onClose }: SecretSettingsProps) {
  const { settings, updateSetting } = useCustomSettings();

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>⚙️ Custom Settings</h2>
      {settings.map((setting) => (
        <div key={setting.id} className={styles.settingItem}>
          <label>{setting.name}</label>
          <p>{setting.description}</p>

          {setting.type === 'number' && (
            <input
              type="range"
              min={setting.min}
              max={setting.max}
              value={setting.value as number}
              onChange={(e) => updateSetting(setting.id, parseInt(e.target.value))}
            />
          )}

          {setting.type === 'select' && (
            <select
              value={setting.value as string}
              onChange={(e) => updateSetting(setting.id, e.target.value)}
            >
              {setting.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}
    </section>
  );
}
```

### Step 4: Use Settings in Modules

```typescript
// Example: In motion-detection module
import { useCustomSettings } from './modules/secret-settings/useCustomSettings';

export function useMotionDetection() {
  const { getSetting } = useCustomSettings();
  const sensitivity = getSetting('motion-sensitivity') as number;

  // Use sensitivity value in motion detection algorithm
}
```

---

## Accessibility

- Modal is keyboard accessible
- ESC key closes the modal (when implemented)
- ARIA attributes for screen readers (`role="dialog"`, `aria-modal="true"`)
- Focus management (trap focus within modal)
- Clear visual focus indicators

---

## Performance

- **Triple-tap detection**: Minimal overhead, only monitors events
- **Modal rendering**: Conditional rendering (only when visible)
- **CSS animations**: Hardware-accelerated transforms
- **No dependencies**: Uses only React and native browser APIs

---

## Testing

### Unit Tests

Test the triple-tap detection logic:

```typescript
// useTripleTap.test.ts
import { renderHook } from '@testing-library/react';
import { useTripleTap } from './useTripleTap';

describe('useTripleTap', () => {
  it('should trigger callback on triple tap', () => {
    const onTripleTap = vi.fn();
    renderHook(() => useTripleTap({ onTripleTap }));

    // Simulate three rapid clicks in center
    // Assert callback was called
  });

  it('should only count taps in center region', () => {
    // Test edge/corner taps don't count
  });

  it('should reset count after timeout', () => {
    // Test timeout behavior
  });
});
```

### Integration Tests

Test the component integration:

```typescript
// SecretSettings.test.tsx
import { render, screen } from '@testing-library/react';
import { SecretSettings } from './SecretSettings';

describe('SecretSettings', () => {
  it('should render when visible', () => {
    render(<SecretSettings isVisible={true} onClose={() => {}} />);
    expect(screen.getByText('Secret Settings')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    render(<SecretSettings isVisible={false} onClose={() => {}} />);
    expect(screen.queryByText('Secret Settings')).not.toBeInTheDocument();
  });
});
```

---

## Future Enhancements

- [ ] Implement feature flag state management
- [ ] Implement custom settings state management
- [ ] Add keyboard support (ESC to close)
- [ ] Add focus trap for accessibility
- [ ] Add animations for flag/setting changes
- [ ] Add search/filter for settings
- [ ] Add import/export settings functionality
- [ ] Add settings categories/tabs
- [ ] Add reset to defaults button
- [ ] Persist settings to localStorage or backend

---

## Dependencies

- **React**: UI framework
- **TypeScript**: Type safety
- **CSS Modules**: Scoped styling

**No external dependencies required.**

---

## Contributing

When adding new feature flags or settings:

1. Define the flag/setting in the config file
2. Update types if needed
3. Add UI controls in SecretSettings.tsx
4. Document the new flag/setting in this README
5. Add tests for new functionality
6. Update DOCUMENTATION_INDEX.md

---

## Examples

### Complete Integration Example

```typescript
// App.tsx
import { useState } from 'react';
import { useTripleTap, SecretSettings } from './modules/secret-settings';

export default function App() {
  const [showSecretSettings, setShowSecretSettings] = useState(false);

  useTripleTap({
    tapTimeout: 500,
    onTripleTap: () => {
      console.log('Secret menu activated!');
      setShowSecretSettings(true);
    },
  });

  return (
    <div className="app">
      {/* Your main app content */}
      <h1>Photo Signal</h1>

      {/* Secret settings menu */}
      <SecretSettings
        isVisible={showSecretSettings}
        onClose={() => setShowSecretSettings(false)}
      />
    </div>
  );
}
```

---

## License

MIT © Miles Camp
