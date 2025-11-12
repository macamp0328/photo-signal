# Secret Settings - Developer Guide

> **Purpose**: Comprehensive guide for developers and AI agents on how to extend the secret settings menu with feature flags and custom settings.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Adding Feature Flags](#adding-feature-flags)
3. [Adding Custom Settings](#adding-custom-settings)
4. [Best Practices](#best-practices)
5. [Testing](#testing)
6. [Examples](#examples)

---

## Quick Start

The secret settings menu is activated by triple-tapping/clicking in the center of the screen. It's currently scaffolding with placeholder sections for:

- **Feature Flags**: Boolean toggles for experimental features
- **Custom Settings**: Adjustable parameters (numbers, strings, selects)

### Module Location

```
src/modules/secret-settings/
├── README.md                    # API contract and usage
├── DEVELOPER_GUIDE.md          # This file
├── types.ts                     # TypeScript interfaces
├── useTripleTap.ts             # Triple-tap detection hook
├── SecretSettings.tsx          # Settings UI component
├── SecretSettings.module.css   # Component styles
├── index.ts                     # Public API exports
├── useTripleTap.test.ts        # Hook tests
└── SecretSettings.test.tsx     # Component tests
```

---

## Adding Feature Flags

Feature flags are boolean toggles that enable/disable experimental features.

### Step 1: Define Flag Configuration

Create a new file: `src/modules/secret-settings/featureFlagConfig.ts`

```typescript
import type { FeatureFlag } from './types';

/**
 * Feature flag configuration
 * Add new flags to this array to make them available in the UI
 */
export const FEATURE_FLAGS: FeatureFlag[] = [
  {
    id: 'experimental-photo-recognition',
    name: 'Experimental Photo Recognition',
    description: 'Use ML-based photo recognition instead of placeholder logic',
    enabled: false,
    category: 'experimental',
  },
  {
    id: 'debug-mode',
    name: 'Debug Mode',
    description: 'Enable verbose console logging for debugging',
    enabled: false,
    category: 'debugging',
  },
  {
    id: 'audio-visualizer',
    name: 'Audio Visualizer',
    description: 'Display animated audio visualizer during playback',
    enabled: false,
    category: 'ui',
  },
  {
    id: 'motion-detection-overlay',
    name: 'Motion Detection Overlay',
    description: 'Show visual overlay when motion is detected',
    enabled: false,
    category: 'camera',
  },
];
```

### Step 2: Create State Management Hook

Create a new file: `src/modules/secret-settings/useFeatureFlags.ts`

```typescript
import { useState, useEffect } from 'react';
import type { FeatureFlag } from './types';
import { FEATURE_FLAGS } from './featureFlagConfig';

const STORAGE_KEY = 'photo-signal-feature-flags';

/**
 * Hook for managing feature flags
 * Persists state to localStorage
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>(() => {
    // Load from localStorage on initial render
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedFlags = JSON.parse(saved) as FeatureFlag[];
        // Merge with config to ensure new flags are included
        return FEATURE_FLAGS.map((configFlag) => {
          const savedFlag = savedFlags.find((f) => f.id === configFlag.id);
          return savedFlag || configFlag;
        });
      }
    } catch (error) {
      console.error('Failed to load feature flags from localStorage:', error);
    }
    return FEATURE_FLAGS;
  });

  // Save to localStorage whenever flags change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
    } catch (error) {
      console.error('Failed to save feature flags to localStorage:', error);
    }
  }, [flags]);

  const toggleFlag = (id: string) => {
    setFlags((prev) =>
      prev.map((flag) => (flag.id === id ? { ...flag, enabled: !flag.enabled } : flag))
    );
  };

  const isEnabled = (id: string): boolean => {
    return flags.find((flag) => flag.id === id)?.enabled ?? false;
  };

  const resetFlags = () => {
    setFlags(FEATURE_FLAGS);
  };

  return {
    flags,
    toggleFlag,
    isEnabled,
    resetFlags,
  };
}
```

### Step 3: Update SecretSettings Component

Modify `src/modules/secret-settings/SecretSettings.tsx`:

```typescript
import type { SecretSettingsProps } from './types';
import { useFeatureFlags } from './useFeatureFlags';
import styles from './SecretSettings.module.css';

export function SecretSettings({ isVisible, onClose }: SecretSettingsProps) {
  const { flags, toggleFlag, resetFlags } = useFeatureFlags();

  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* ... header ... */}

        <div className={styles.content}>
          {/* Feature Flags Section */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>⚡ Feature Flags</h2>
            <p className={styles.sectionDescription}>
              Toggle experimental features on or off.
            </p>

            {flags.length > 0 ? (
              <div className={styles.flagList}>
                {flags.map((flag) => (
                  <div key={flag.id} className={styles.flagItem}>
                    <label className={styles.flagLabel}>
                      <input
                        type="checkbox"
                        checked={flag.enabled}
                        onChange={() => toggleFlag(flag.id)}
                        className={styles.flagCheckbox}
                      />
                      <div className={styles.flagInfo}>
                        <span className={styles.flagName}>{flag.name}</span>
                        <span className={styles.flagDescription}>{flag.description}</span>
                        {flag.category && (
                          <span className={styles.flagCategory}>{flag.category}</span>
                        )}
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.placeholder}>
                <p className={styles.placeholderText}>No feature flags configured yet.</p>
              </div>
            )}

            <button onClick={resetFlags} className={styles.resetButton}>
              Reset All Flags
            </button>
          </section>

          {/* ... other sections ... */}
        </div>
      </div>
    </div>
  );
}
```

### Step 4: Use Feature Flags in Your App

In any component or module:

```typescript
import { useFeatureFlags } from './modules/secret-settings/useFeatureFlags';

function PhotoRecognitionModule() {
  const { isEnabled } = useFeatureFlags();

  if (isEnabled('experimental-photo-recognition')) {
    // Use new ML-based recognition
    return <MLPhotoRecognition />;
  } else {
    // Use placeholder recognition
    return <PlaceholderRecognition />;
  }
}
```

Or for conditional logic:

```typescript
function MyComponent() {
  const { isEnabled } = useFeatureFlags();

  useEffect(() => {
    if (isEnabled('debug-mode')) {
      console.log('Debug info:', someData);
    }
  }, [isEnabled, someData]);
}
```

### Step 5: Export from Module

Update `src/modules/secret-settings/index.ts`:

```typescript
export { SecretSettings } from './SecretSettings';
export { useTripleTap } from './useTripleTap';
export { useFeatureFlags } from './useFeatureFlags';
export type { UseTripleTapOptions, SecretSettingsProps, FeatureFlag, CustomSetting } from './types';
```

---

## Adding Custom Settings

Custom settings allow users to adjust numeric, string, or select values.

### Step 1: Define Settings Configuration

Create a new file: `src/modules/secret-settings/customSettingsConfig.ts`

```typescript
import type { CustomSetting } from './types';

export const CUSTOM_SETTINGS: CustomSetting[] = [
  {
    id: 'motion-sensitivity',
    name: 'Motion Sensitivity',
    description: 'How sensitive motion detection is (0-100)',
    type: 'number',
    value: 50,
    min: 0,
    max: 100,
    category: 'camera',
  },
  {
    id: 'audio-fade-duration',
    name: 'Audio Fade Duration',
    description: 'Time for audio to fade out (milliseconds)',
    type: 'number',
    value: 1000,
    min: 100,
    max: 5000,
    category: 'audio',
  },
  {
    id: 'recognition-delay',
    name: 'Recognition Delay',
    description: 'Delay before triggering recognition (milliseconds)',
    type: 'number',
    value: 3000,
    min: 500,
    max: 10000,
    category: 'camera',
  },
  {
    id: 'theme',
    name: 'Theme',
    description: 'Color theme for the app',
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

### Step 2: Create State Management Hook

Create a new file: `src/modules/secret-settings/useCustomSettings.ts`

```typescript
import { useState, useEffect } from 'react';
import type { CustomSetting } from './types';
import { CUSTOM_SETTINGS } from './customSettingsConfig';

const STORAGE_KEY = 'photo-signal-custom-settings';

export function useCustomSettings() {
  const [settings, setSettings] = useState<CustomSetting[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedSettings = JSON.parse(saved) as CustomSetting[];
        return CUSTOM_SETTINGS.map((configSetting) => {
          const savedSetting = savedSettings.find((s) => s.id === configSetting.id);
          return savedSetting || configSetting;
        });
      }
    } catch (error) {
      console.error('Failed to load custom settings from localStorage:', error);
    }
    return CUSTOM_SETTINGS;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save custom settings to localStorage:', error);
    }
  }, [settings]);

  const updateSetting = (id: string, value: string | number | boolean) => {
    setSettings((prev) => prev.map((s) => (s.id === id ? { ...s, value } : s)));
  };

  const getSetting = <T = string | number | boolean>(id: string): T | undefined => {
    return settings.find((s) => s.id === id)?.value as T | undefined;
  };

  const resetSettings = () => {
    setSettings(CUSTOM_SETTINGS);
  };

  return {
    settings,
    updateSetting,
    getSetting,
    resetSettings,
  };
}
```

### Step 3: Use Settings in Your App

```typescript
import { useCustomSettings } from './modules/secret-settings/useCustomSettings';

function MotionDetectionModule() {
  const { getSetting } = useCustomSettings();
  const sensitivity = getSetting<number>('motion-sensitivity') ?? 50;

  // Use the sensitivity value in your motion detection algorithm
  const { isMoving } = useMotionDetection(stream, { sensitivity });
}
```

---

## Best Practices

### 1. Naming Conventions

- **IDs**: Use kebab-case (e.g., `experimental-photo-recognition`)
- **Names**: Use Title Case (e.g., `Experimental Photo Recognition`)
- **Categories**: Use lowercase (e.g., `experimental`, `debugging`, `ui`, `audio`, `camera`)

### 2. Default Values

- Always provide sensible defaults for flags (usually `false`)
- For settings, choose safe middle-ground values
- Document what each value does in the description

### 3. localStorage Usage

- All flags and settings persist to localStorage
- Handle localStorage errors gracefully (quota exceeded, disabled, etc.)
- Consider versioning for future migrations

### 4. Type Safety

- Use TypeScript types for all settings
- Use generic types when retrieving settings: `getSetting<number>('my-setting')`
- Validate values when updating

### 5. UI Organization

- Group related flags/settings by category
- Keep descriptions concise but clear
- Add reset buttons for user convenience

---

## Testing

### Testing Feature Flags

```typescript
// useFeatureFlags.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeatureFlags } from './useFeatureFlags';

describe('useFeatureFlags', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should load flags from config', () => {
    const { result } = renderHook(() => useFeatureFlags());
    expect(result.current.flags.length).toBeGreaterThan(0);
  });

  it('should toggle flag', () => {
    const { result } = renderHook(() => useFeatureFlags());

    act(() => {
      result.current.toggleFlag('debug-mode');
    });

    expect(result.current.isEnabled('debug-mode')).toBe(true);
  });

  it('should persist to localStorage', () => {
    const { result } = renderHook(() => useFeatureFlags());

    act(() => {
      result.current.toggleFlag('debug-mode');
    });

    const saved = localStorage.getItem('photo-signal-feature-flags');
    expect(saved).toBeTruthy();
    const parsed = JSON.parse(saved!);
    expect(parsed.find((f: any) => f.id === 'debug-mode')?.enabled).toBe(true);
  });
});
```

---

## Examples

### Example 1: Debug Logging Flag

```typescript
// featureFlagConfig.ts
{
  id: 'debug-logging',
  name: 'Debug Logging',
  description: 'Enable verbose console logging',
  enabled: false,
  category: 'debugging',
}

// Usage in component
function MyComponent() {
  const { isEnabled } = useFeatureFlags();

  useEffect(() => {
    if (isEnabled('debug-logging')) {
      console.log('[DEBUG] Component mounted');
    }
  }, [isEnabled]);

  const handleClick = () => {
    if (isEnabled('debug-logging')) {
      console.log('[DEBUG] Button clicked');
    }
    // ... handle click
  };
}
```

### Example 2: Motion Sensitivity Setting

```typescript
// customSettingsConfig.ts
{
  id: 'motion-sensitivity',
  name: 'Motion Sensitivity',
  description: 'Adjust motion detection sensitivity (0-100)',
  type: 'number',
  value: 50,
  min: 0,
  max: 100,
  category: 'camera',
}

// Usage in motion detection module
function useMotionDetection() {
  const { getSetting } = useCustomSettings();
  const sensitivity = getSetting<number>('motion-sensitivity') ?? 50;

  // Use sensitivity in algorithm
  const threshold = 255 * (sensitivity / 100);
  // ...
}
```

### Example 3: Theme Setting

```typescript
// customSettingsConfig.ts
{
  id: 'theme',
  name: 'Color Theme',
  description: 'Choose your preferred color theme',
  type: 'select',
  value: 'dark',
  options: [
    { label: 'Dark', value: 'dark' },
    { label: 'Light', value: 'light' },
    { label: 'Auto', value: 'auto' },
  ],
  category: 'ui',
}

// Usage in App
function App() {
  const { getSetting } = useCustomSettings();
  const theme = getSetting<string>('theme') ?? 'dark';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
}
```

---

## Contributing

When adding new flags or settings:

1. Add to the appropriate config file
2. Update this developer guide with examples
3. Add tests for new functionality
4. Update module README if API changes
5. Update DOCUMENTATION_INDEX.md if new files are created
6. Test in both desktop and mobile

---

## License

MIT © Miles Camp
