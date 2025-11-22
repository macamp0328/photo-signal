# Secret Settings - Developer Guide

> **Purpose**: Comprehensive guide for developers and AI agents on how to extend the secret settings menu with feature flags and custom settings.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Adding Feature Flags](#adding-feature-flags)
3. [Adding Custom Settings](#adding-custom-settings)
4. [Implemented Features](#implemented-features)
5. [Best Practices](#best-practices)
6. [Testing](#testing)
7. [Examples](#examples)

---

## Quick Start

The secret settings menu is activated by triple-tapping/clicking in the center of the screen. It provides:

- **Feature Flags**: Boolean toggles for experimental and creative features
- **Custom Settings**: Adjustable parameters (numbers, strings, selects)

### Module Location

```
src/modules/secret-settings/
├── README.md                       # API contract and usage
├── DEVELOPER_GUIDE.md             # This file
├── types.ts                        # TypeScript interfaces
├── featureFlagConfig.ts           # Feature flag definitions
├── customSettingsConfig.ts        # Custom settings definitions
├── useTripleTap.ts                # Triple-tap detection hook
├── useFeatureFlags.ts             # Feature flags state management
├── useCustomSettings.ts           # Custom settings state management
├── SecretSettings.tsx             # Settings UI component
├── SecretSettings.module.css      # Component styles
├── index.ts                        # Public API exports
├── useTripleTap.test.ts           # Hook tests
└── SecretSettings.test.tsx        # Component tests
```

---

## Implemented Features

### Feature Flags

1. **Test Data Mode** (`test-mode`)
   - Use test concert data with working photo hashes
   - Enable debug overlay for development
   - Toggles on/off from Feature Flags section

2. **Multi-Scale Recognition** (`multi-scale-recognition`)
   - Support imprecise photo alignment
   - Test multiple crop scales for better matching
   - More forgiving for handheld use

3. **Dynamic Rectangle Detection** (`rectangle-detection`)
   - Automatically detect photo boundaries
   - Visual feedback when rectangle detected

4. **Grayscale Conversion** (`grayscale-mode`)
   - Convert frames to black and white before recognition
   - May improve accuracy with monochrome prints

### Custom Settings

3. **Theme Mode** (`theme-mode`)
   - Switch between light and dark visual themes
   - Options: Dark, Light
   - Applied globally via `data-theme` attribute
   - Instant theme switching with smooth transitions

4. **UI Style** (`ui-style`)
   - Toggle between modern UI and classic retro gallery experience
   - Options: Modern, Classic
   - Classic mode uses monospace fonts and removes textures
   - Applied globally via `data-ui-style` attribute

5. **Recognition Delay** (`recognition-delay`)

- Adjust how long a photo must stay steady before we confirm a match
- Range: 1000–5000ms (default 3000ms)
- Longer delays reduce false positives; shorter delays feel more responsive

6. **Hash Algorithm** (`hash-algorithm`)

- Switch between dHash (fast) and pHash (more robust to lighting/angles)
- Useful for A/B testing the new hashing path on real devices

7. **Similarity Threshold** (`similarity-threshold`)

- Tweak the maximum Hamming distance allowed for a match
- Lower numbers demand closer matches; higher numbers tolerate more noise

8. **Frame Scan Interval** (`recognition-check-interval`)

- Controls how often we hash frames (in ms)
- Lower values improve responsiveness but increase CPU/battery usage

9. **Sharpness Threshold** (`sharpness-threshold`)

- Minimum Laplacian variance required to accept a frame
- Raise this to filter out more motion blur; lower it to be more permissive

10. **Glare Pixel Threshold** (`glare-threshold`)

- Pixel intensity above this value counts as glare
- Helpful for tuning indoor vs. outdoor lighting conditions

11. **Glare Coverage Threshold** (`glare-percentage-threshold`)

- Percentage of pixels that can be blown out before we skip the frame
- Lower values aggressively reject glare; higher values allow more hotspots

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

## Detailed Feature Implementation Guide

This section previously contained detailed implementation examples for feature flags that have been removed from the codebase. For current feature flag implementations, refer to the actual code in:

- **Photo Recognition Module**: Multi-scale recognition, rectangle detection, grayscale conversion
- **Data Service**: Test mode implementation
- **Debug Overlay**: Debug visualization for test mode

### Theme Mode Implementation Example

**Purpose**: Enable instant visual theme switching for A/B comparison and accessibility.

**Implementation**:

- **Custom Setting**: `theme-mode` in `customSettingsConfig.ts`
- **Global CSS**: Updated `index.css` with theme variables
- **Options**: `dark` (default), `light`

**How it works**:

1. Sets `data-theme` attribute on `document.documentElement`
2. CSS uses attribute selectors to apply theme-specific variables
3. Smooth 0.3s transitions for color changes
4. Persists to localStorage automatically

**CSS Variables**:

```css
/* Default (Dark) Theme */
:root {
  --color-background: #0a0a0a;
  --color-text: #f5f5f5;
  --color-accent: #4a90e2;
}

/* Light Theme */
[data-theme='light'] {
  --color-background: #f5f5f4;
  --color-text: #0f172a;
  --color-accent: #2563eb;
}
```

**Integration**:

```tsx
import { useCustomSettings } from './modules/secret-settings';

function App() {
  const { getSetting } = useCustomSettings();

  useEffect(() => {
    const theme = getSetting<string>('theme-mode') ?? 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }, [getSetting]);
}
```

**Components should use CSS variables** instead of hard-coded colors to support theming.

---

### Feature 4: Classic/Modern UI Switch

**Purpose**: Toggle between modern design and nostalgic retro gallery experience.

**Implementation**:

- **Custom Setting**: `ui-style` in `customSettingsConfig.ts`
- **Global CSS**: Updated `index.css` with UI style variables
- **Options**: `modern` (default), `classic`

**How it works**:

1. Sets `data-ui-style` attribute on `document.documentElement`
2. Changes font family, border radius, shadows globally
3. Removes background texture in classic mode
4. Persists to localStorage automatically

**CSS Changes**:

```css
[data-ui-style='modern'] {
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', ...;
  --border-radius: 8px;
  --shadow-size: 10px;
}

[data-ui-style='classic'] {
  --font-family: 'Courier New', 'Monaco', monospace;
  --border-radius: 0px;
  --shadow-size: 4px;
}

/* Classic mode removes texture overlay */
[data-ui-style='classic'] body::before {
  display: none;
}
```

**Integration**: Same pattern as theme switching.

**Design Philosophy**:

- **Modern**: Rounded corners, subtle shadows, textured backgrounds
- **Classic**: Sharp edges, monospace fonts, flat colors (Winamp-like)

---

## State Management Architecture

All settings use a **localStorage-first** approach:

1. **Initial Load**: Read from localStorage, fallback to config defaults
2. **Updates**: Immediately write to localStorage on change
3. **Merging**: New config flags/settings merge with saved values
4. **Error Handling**: Gracefully handle localStorage quota/disabled scenarios

**Storage Keys**:

- `photo-signal-feature-flags` - Feature flag states
- `photo-signal-custom-settings` - Custom setting values

**Benefits**:

- Settings persist across sessions
- No backend required (static hosting friendly)
- Instant updates (no network latency)
- Privacy-friendly (client-side only)

---

## "Send It" Button Workflow

The secret settings menu includes a **"Send It 🚀"** button that applies all changes and reloads the page.

### Purpose

Some feature flags and settings require a full page reload to take effect properly:

- **Camera Settings**: Require reinitializing MediaStream
- **Theme Changes**: Require re-rendering entire React tree
- **Audio Settings**: Require reinitializing Howler.js
- **UI Style Changes**: Require reapplying global CSS variables

### Implementation

**Location**: `src/modules/secret-settings/SecretSettings.tsx`

**Code**:

```typescript
import { useRetroSounds } from './useRetroSounds';
import { useCallback } from 'react';

export function SecretSettings({ isVisible, onClose }: SecretSettingsProps) {
  const { flags, toggleFlag, resetFlags, isEnabled } = useFeatureFlags();
  const { settings, updateSetting, resetSettings } = useCustomSettings();

  const handleSendIt = useCallback(() => {
    // Close the menu first (provides immediate feedback)
    onClose();

    // Reload page after short delay (100ms) to show close animation
    setTimeout(() => {
      window.location.reload();
    }, 100);
  }, [isEnabled, playRandomSound, onClose]);

  return (
    // ... in the JSX, before Developer Info section
    <section className={styles.section}>
      <button
        onClick={handleSendIt}
        className={styles.sendItButton}
        aria-label="Apply changes and reload page"
        type="button"
      >
        Send It 🚀
      </button>
      <p className={styles.sendItDescription}>
        Apply all changes and reload the page to ensure everything takes effect
      </p>
    </section>
  );
}
```

**Styling** (in `SecretSettings.module.css`):

```css
.sendItButton {
  width: 100%;
  padding: 16px 24px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-background);
  background: var(--color-accent);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 16px;
}

.sendItButton:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
  background: var(--color-accent-hover);
}

.sendItButton:active {
  transform: translateY(0);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}
```

### User Flow

1. User opens secret settings (triple-tap)
2. User toggles feature flags or adjusts settings
3. Changes preview immediately (saved to localStorage)
4. User clicks **"Send It 🚀"** button
5. Retro sound plays (if enabled)
6. Menu closes smoothly
7. Page reloads after 100ms (ensures all changes take effect)
8. All settings persist via localStorage

### Why 100ms Delay?

The 100ms delay between closing the menu and reloading the page:

- Allows the close animation to play
- Provides visual feedback that the action was acknowledged
- Makes the reload feel intentional, not like a bug
- Improves perceived performance

### Testing

**Manual Testing**:

1. Open secret settings
2. Toggle a feature flag (e.g., Test Mode)
3. Click "Send It"
4. Verify menu closes
5. Verify page reloads
6. Verify feature flag is still enabled after reload

**Automated Testing** (see `SecretSettings.test.tsx`):

```typescript
it('should reload page after clicking Send It', async () => {
  const reloadSpy = vi.fn();
  // Mock window.location.reload
  delete (window as { location?: unknown }).location;
  (window as { location: unknown }).location = {
    ...originalLocation,
    reload: reloadSpy
  };

  render(<SecretSettings isVisible={true} onClose={vi.fn()} />);

  const button = screen.getByText(/Send It/i);
  await user.click(button);

  await new Promise((resolve) => setTimeout(resolve, 150));
  expect(reloadSpy).toHaveBeenCalled();
});
```

### Design Decisions

**Why "Send It 🚀" instead of "Apply"?**

- More playful and engaging (matches "secret menu" vibe)
- Rocket emoji conveys "launch" or "activate" action
- More memorable than standard "Apply" or "Save"

**Why reload the page?**

- Simplest implementation (no complex state management)
- Guarantees all changes take effect (no edge cases)
- Provides clear "before/after" user experience
- Avoids partial state updates or stale references

**Why make it prominent?**

- Primary action on the page (deserves visual emphasis)
- Accent color background makes it stand out
- Larger size than secondary "Reset" buttons
- Users should know this is how to apply changes

---

## Accessibility Considerations

1. **Keyboard Navigation**: All toggles and selects are keyboard accessible
2. **Focus Indicators**: Clear visual focus states on all controls
3. **Screen Readers**: Semantic HTML with proper labels
4. **Color Contrast**: Both themes meet WCAG AA standards (4.5:1)

---

## Performance Optimization

1. **Lazy Loading**: Components only load when needed
2. **CSS Animations**: Hardware-accelerated transforms and opacity
3. **State Updates**: Batched with React's state management
4. **Bundle Size**: Minimal overhead for feature flag system

---

## License

MIT © Miles Camp
