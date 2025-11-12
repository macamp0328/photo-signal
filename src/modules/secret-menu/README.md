# Secret Menu Module

## Overview

The Secret Menu module provides a hidden menu interface activated by triple-tapping the center of the screen. It's designed to give advanced users and developers access to feature flags and custom settings without cluttering the main UI.

This module is scaffolding-focused, providing the infrastructure for future feature flags and settings that can be added by AI agents or developers.

## Features

- **Triple-Tap Activation**: Works on both desktop (click) and mobile (touch)
- **Center-Area Detection**: Only triggers when tapping in the center 20% of viewport
- **Modal UI**: Clean, accessible modal interface
- **Placeholder Sections**: Pre-built sections for feature flags and settings
- **Extensible Design**: Easy to add new flags and settings

## API

### Component: `SecretMenu`

The main modal component that displays when activated.

```typescript
interface SecretMenuProps {
  /** Whether the menu is currently visible */
  isOpen: boolean;
  /** Callback to close the menu */
  onClose: () => void;
  /** Optional: Feature flags to display */
  featureFlags?: FeatureFlag[];
  /** Optional: Custom settings to display */
  customSettings?: CustomSetting[];
  /** Optional: Callback when a feature flag is toggled */
  onFeatureFlagToggle?: (flagId: string, enabled: boolean) => void;
  /** Optional: Callback when a setting is changed */
  onSettingChange?: (settingId: string, value: boolean | number | string) => void;
}
```

### Hook: `useTripleTap`

Detects triple-tap/click interactions in the center of the screen.

```typescript
function useTripleTap(onTripleTap: () => void, options?: TripleTapOptions): UseTripleTapReturn;

interface TripleTapOptions {
  /** Maximum time (ms) between taps to count as sequence (default: 500) */
  timeout?: number;
  /** Target area as percentage of viewport (default: 0.2 = center 20%) */
  targetArea?: number;
}

interface UseTripleTapReturn {
  /** Handler to attach to the element for click/tap detection */
  onInteraction: (event: React.MouseEvent | React.TouchEvent) => void;
  /** Number of taps in the current sequence */
  tapCount: number;
  /** Reset the tap counter */
  reset: () => void;
}
```

## Usage

### Basic Integration

```tsx
import { useState } from 'react';
import { SecretMenu, useTripleTap } from './modules/secret-menu';

function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  const { onInteraction } = useTripleTap(() => {
    setMenuOpen(true);
  });

  return (
    <div onClick={onInteraction} onTouchEnd={onInteraction}>
      {/* Your app content */}

      <SecretMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
```

### With Feature Flags

```tsx
import { useState } from 'react';
import { SecretMenu, useTripleTap, FeatureFlag } from './modules/secret-menu';

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [flags, setFlags] = useState<FeatureFlag[]>([
    {
      id: 'experimental-recognition',
      name: 'Experimental Photo Recognition',
      description: 'Use ML-based photo recognition instead of placeholder',
      enabled: false,
      category: 'Recognition',
    },
    {
      id: 'audio-visualizer',
      name: 'Audio Visualizer',
      description: 'Show audio waveform visualization during playback',
      enabled: false,
      category: 'Audio',
    },
  ]);

  const { onInteraction } = useTripleTap(() => setMenuOpen(true));

  const handleFlagToggle = (flagId: string, enabled: boolean) => {
    setFlags((prev) => prev.map((flag) => (flag.id === flagId ? { ...flag, enabled } : flag)));
    // Apply the flag change to your app logic here
  };

  return (
    <div onClick={onInteraction} onTouchEnd={onInteraction}>
      {/* Your app content */}

      <SecretMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        featureFlags={flags}
        onFeatureFlagToggle={handleFlagToggle}
      />
    </div>
  );
}
```

## Adding New Feature Flags

Feature flags allow you to enable/disable experimental or in-development features. Here's how to add one:

### Step 1: Define the Flag

Create a new `FeatureFlag` object with a unique ID, descriptive name, and clear description:

```typescript
const newFlag: FeatureFlag = {
  id: 'my-new-feature', // Unique identifier (kebab-case)
  name: 'My New Feature', // Human-readable name
  description: 'Enables the awesome new feature that does X', // Clear description
  enabled: false, // Default state
  category: 'Experimental', // Optional grouping
};
```

### Step 2: Add to State

Add the flag to your flags array (usually in App.tsx or a dedicated state management system):

```typescript
const [flags, setFlags] = useState<FeatureFlag[]>([
  // ... existing flags
  {
    id: 'my-new-feature',
    name: 'My New Feature',
    description: 'Enables the awesome new feature that does X',
    enabled: false,
    category: 'Experimental',
  },
]);
```

### Step 3: Use the Flag

Check the flag's state in your code to conditionally enable/disable features:

```typescript
const handleFlagToggle = (flagId: string, enabled: boolean) => {
  setFlags((prev) =>
    prev.map((flag) => (flag.id === flagId ? { ...flag, enabled } : flag))
  );
};

// In your component
const myFeatureEnabled = flags.find((f) => f.id === 'my-new-feature')?.enabled;

return (
  <div>
    {myFeatureEnabled ? <NewFeatureComponent /> : <OldFeatureComponent />}
  </div>
);
```

### Step 4: Persist State (Optional)

For persistent flags across sessions, use localStorage:

```typescript
// Save to localStorage when flags change
useEffect(() => {
  localStorage.setItem('featureFlags', JSON.stringify(flags));
}, [flags]);

// Load from localStorage on mount
useState(() => {
  const saved = localStorage.getItem('featureFlags');
  return saved ? JSON.parse(saved) : defaultFlags;
});
```

## Adding Custom Settings

Custom settings allow users to configure app behavior. Here's how to add one:

### Step 1: Define the Setting

```typescript
const newSetting: CustomSetting = {
  id: 'motion-sensitivity', // Unique identifier
  name: 'Motion Detection Sensitivity', // Human-readable name
  description: 'Adjust how sensitive the motion detection is', // Clear description
  type: 'number', // 'boolean' | 'number' | 'string' | 'select'
  value: 50, // Default value
  min: 0, // For number type
  max: 100, // For number type
  category: 'Detection', // Optional grouping
};
```

### Step 2: Add to State

```typescript
const [settings, setSettings] = useState<CustomSetting[]>([
  {
    id: 'motion-sensitivity',
    name: 'Motion Detection Sensitivity',
    description: 'Adjust how sensitive the motion detection is',
    type: 'number',
    value: 50,
    min: 0,
    max: 100,
    category: 'Detection',
  },
]);
```

### Step 3: Use the Setting

```typescript
const handleSettingChange = (settingId: string, value: boolean | number | string) => {
  setSettings((prev) =>
    prev.map((setting) => (setting.id === settingId ? { ...setting, value } : setting))
  );
};

// In your component
const sensitivity = settings.find((s) => s.id === 'motion-sensitivity')?.value as number;

useMotionDetection(stream, { sensitivity });
```

## Setting Types

The module supports different setting types for different use cases:

### Boolean Setting

```typescript
{
  id: 'dark-mode',
  name: 'Dark Mode',
  description: 'Use dark theme',
  type: 'boolean',
  value: false,
}
```

### Number Setting

```typescript
{
  id: 'volume',
  name: 'Default Volume',
  description: 'Default audio volume (0-100)',
  type: 'number',
  value: 80,
  min: 0,
  max: 100,
}
```

### String Setting

```typescript
{
  id: 'user-name',
  name: 'User Name',
  description: 'Your display name',
  type: 'string',
  value: 'Guest',
}
```

### Select Setting

```typescript
{
  id: 'theme',
  name: 'Color Theme',
  description: 'Choose your preferred color scheme',
  type: 'select',
  value: 'default',
  options: ['default', 'warm', 'cool', 'monochrome'],
}
```

## Best Practices for AI Agents

When adding feature flags or settings as an AI agent:

1. **Use Descriptive IDs**: Use kebab-case IDs that clearly describe the feature (e.g., `ml-photo-recognition`)

2. **Write Clear Descriptions**: Help users understand what the flag/setting does and why they might want to enable it

3. **Set Safe Defaults**: Default to `false` for experimental flags, safe values for settings

4. **Add Categories**: Group related flags/settings together with categories

5. **Update Documentation**: Add your flag/setting to this README with usage examples

6. **Test Thoroughly**: Verify the flag works correctly in both enabled and disabled states

7. **Clean Up**: Remove flags once features are stable and enabled by default

## File Structure

```
src/modules/secret-menu/
├── README.md              # This file - API documentation and guides
├── index.ts               # Public API exports
├── types.ts               # TypeScript type definitions
├── useTripleTap.ts        # Triple-tap detection hook
└── SecretMenu.tsx         # Secret menu modal component
```

## Dependencies

- React 19+ (hooks)
- Tailwind CSS (styling)
- No external dependencies

## Accessibility

- Keyboard accessible (ESC to close)
- ARIA labels for screen readers
- Semantic HTML structure
- Focus management
- High contrast colors

## Future Enhancements

Potential improvements for future development:

- [ ] Keyboard shortcut alternative (e.g., Ctrl+Shift+S)
- [ ] Search/filter for flags and settings
- [ ] Import/export configuration
- [ ] Setting validation
- [ ] Setting change history/undo
- [ ] Grouped/collapsible sections
- [ ] Dark mode support
- [ ] Animation/transitions when opening
- [ ] Setting presets (beginner, advanced, expert)

## Testing

See the test files for examples:

- Unit tests for `useTripleTap` hook
- Component tests for `SecretMenu`
- Integration tests for activation flow

## Related Modules

- None currently - this is a standalone feature module

## Example: Complete Implementation

Here's a complete example showing how to integrate the secret menu with real feature flags:

```tsx
import { useState, useEffect } from 'react';
import { SecretMenu, useTripleTap, FeatureFlag, CustomSetting } from './modules/secret-menu';

function App() {
  // Load flags from localStorage or use defaults
  const [flags, setFlags] = useState<FeatureFlag[]>(() => {
    const saved = localStorage.getItem('featureFlags');
    if (saved) return JSON.parse(saved);

    return [
      {
        id: 'ml-recognition',
        name: 'ML Photo Recognition',
        description: 'Use machine learning for photo matching',
        enabled: false,
        category: 'Recognition',
      },
      {
        id: 'audio-visualizer',
        name: 'Audio Visualizer',
        description: 'Display audio waveform during playback',
        enabled: false,
        category: 'Audio',
      },
    ];
  });

  const [settings, setSettings] = useState<CustomSetting[]>(() => {
    const saved = localStorage.getItem('customSettings');
    if (saved) return JSON.parse(saved);

    return [
      {
        id: 'motion-sensitivity',
        name: 'Motion Sensitivity',
        description: 'How sensitive motion detection is (0-100)',
        type: 'number',
        value: 50,
        min: 0,
        max: 100,
        category: 'Detection',
      },
    ];
  });

  const [menuOpen, setMenuOpen] = useState(false);

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem('featureFlags', JSON.stringify(flags));
  }, [flags]);

  useEffect(() => {
    localStorage.setItem('customSettings', JSON.stringify(settings));
  }, [settings]);

  // Triple-tap detection
  const { onInteraction } = useTripleTap(() => {
    setMenuOpen(true);
    console.log('Secret menu activated!');
  });

  // Flag toggle handler
  const handleFlagToggle = (flagId: string, enabled: boolean) => {
    setFlags((prev) => prev.map((flag) => (flag.id === flagId ? { ...flag, enabled } : flag)));
    console.log(`Feature flag '${flagId}' ${enabled ? 'enabled' : 'disabled'}`);
  };

  // Setting change handler
  const handleSettingChange = (settingId: string, value: boolean | number | string) => {
    setSettings((prev) =>
      prev.map((setting) => (setting.id === settingId ? { ...setting, value } : setting))
    );
    console.log(`Setting '${settingId}' changed to:`, value);
  };

  // Check if specific flags are enabled
  const mlRecognitionEnabled = flags.find((f) => f.id === 'ml-recognition')?.enabled;
  const audioVisualizerEnabled = flags.find((f) => f.id === 'audio-visualizer')?.enabled;

  // Get setting values
  const motionSensitivity = settings.find((s) => s.id === 'motion-sensitivity')?.value as number;

  return (
    <div onClick={onInteraction} onTouchEnd={onInteraction} className="min-h-screen">
      {/* Your app content */}
      <div className="p-8">
        <h1>Photo Signal</h1>

        {/* Use flags to conditionally render features */}
        {mlRecognitionEnabled && <MLRecognitionFeature />}
        {audioVisualizerEnabled && <AudioVisualizer />}

        {/* Use settings to configure features */}
        <MotionDetector sensitivity={motionSensitivity} />
      </div>

      {/* Secret Menu */}
      <SecretMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        featureFlags={flags}
        customSettings={settings}
        onFeatureFlagToggle={handleFlagToggle}
        onSettingChange={handleSettingChange}
      />
    </div>
  );
}
```

## Troubleshooting

### Menu doesn't open on mobile

- Ensure you're using both `onClick` and `onTouchEnd` handlers
- Check that the touch target is not being blocked by other elements
- Verify that the taps are in the center area (try adjusting `targetArea` option)

### Menu opens too easily

- Increase the `timeout` option to require faster taps
- Decrease the `targetArea` to make the activation zone smaller

### Menu doesn't persist settings

- Implement localStorage persistence as shown in the examples above
- Ensure you're saving settings on change, not just on unmount

---

**Last Updated**: 2025-11-12  
**Version**: 1.0.0  
**Maintainer**: AI Agents & Contributors
