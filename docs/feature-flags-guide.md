# Feature Flags and Custom Settings Guide

> **Quick Reference**: How to add and use feature flags and custom settings in Photo Signal's secret menu.

This guide is specifically designed for AI agents and developers who need to add new feature flags or custom settings to the application.

---

## Table of Contents

1. [What Are Feature Flags?](#what-are-feature-flags)
2. [What Are Custom Settings?](#what-are-custom-settings)
3. [Quick Start: Adding a Feature Flag](#quick-start-adding-a-feature-flag)
4. [Quick Start: Adding a Custom Setting](#quick-start-adding-a-custom-setting)
5. [Complete Examples](#complete-examples)
6. [Best Practices](#best-practices)
7. [Testing Your Changes](#testing-your-changes)

---

## What Are Feature Flags?

Feature flags allow you to enable or disable experimental features without changing code. They're useful for:

- **A/B Testing**: Test new features with a subset of users
- **Gradual Rollout**: Enable features incrementally
- **Kill Switches**: Quickly disable problematic features
- **Development**: Work on features without affecting production

---

## What Are Custom Settings?

Custom settings allow users to configure app behavior. They're useful for:

- **User Preferences**: Dark mode, volume, sensitivity levels
- **Power User Features**: Advanced configuration options
- **Accessibility**: Text size, contrast, motion reduction
- **Developer Tools**: Debug mode, verbose logging

---

## Quick Start: Adding a Feature Flag

### Step 1: Define the Flag

In `src/App.tsx` (or wherever you manage app state), add your flag to the initial state:

```typescript
const [flags, setFlags] = useState<FeatureFlag[]>([
  {
    id: 'ml-photo-recognition',  // Unique ID (kebab-case)
    name: 'ML Photo Recognition', // Display name
    description: 'Use machine learning for more accurate photo matching',
    enabled: false, // Default state
    category: 'Recognition', // Optional grouping
  },
]);
```

### Step 2: Pass to Secret Menu

Update the `SecretMenu` component to receive the flags:

```typescript
<SecretMenu
  isOpen={secretMenuOpen}
  onClose={() => setSecretMenuOpen(false)}
  featureFlags={flags}
  onFeatureFlagToggle={handleFlagToggle}
/>
```

### Step 3: Handle Toggle Events

Create a handler to update flag state:

```typescript
const handleFlagToggle = (flagId: string, enabled: boolean) => {
  setFlags((prev) =>
    prev.map((flag) => 
      flag.id === flagId ? { ...flag, enabled } : flag
    )
  );
  
  // Optional: Save to localStorage for persistence
  // localStorage.setItem('featureFlags', JSON.stringify(flags));
};
```

### Step 4: Use the Flag in Your Code

Check the flag's state to conditionally enable features:

```typescript
// Get the flag state
const useMlRecognition = flags.find(f => f.id === 'ml-photo-recognition')?.enabled;

// Use it conditionally
if (useMlRecognition) {
  // Use ML-based recognition
  recognizeConcert(photo, mlModel);
} else {
  // Use placeholder recognition
  recognizeConcert(photo, placeholderLogic);
}
```

---

## Quick Start: Adding a Custom Setting

### Step 1: Define the Setting

```typescript
const [settings, setSettings] = useState<CustomSetting[]>([
  {
    id: 'motion-sensitivity',
    name: 'Motion Detection Sensitivity',
    description: 'Adjust how sensitive motion detection is (0-100)',
    type: 'number',
    value: 50,
    min: 0,
    max: 100,
    category: 'Detection',
  },
]);
```

### Step 2: Pass to Secret Menu

```typescript
<SecretMenu
  isOpen={secretMenuOpen}
  onClose={() => setSecretMenuOpen(false)}
  customSettings={settings}
  onSettingChange={handleSettingChange}
/>
```

### Step 3: Handle Change Events

```typescript
const handleSettingChange = (settingId: string, value: boolean | number | string) => {
  setSettings((prev) =>
    prev.map((setting) =>
      setting.id === settingId ? { ...setting, value } : setting
    )
  );
};
```

### Step 4: Use the Setting

```typescript
// Get the setting value
const sensitivity = settings.find(s => s.id === 'motion-sensitivity')?.value as number;

// Pass to module
useMotionDetection(stream, { sensitivity });
```

---

## Complete Examples

### Example 1: Audio Visualizer Feature Flag

```typescript
// In App.tsx
const [flags, setFlags] = useState<FeatureFlag[]>([
  {
    id: 'audio-visualizer',
    name: 'Audio Visualizer',
    description: 'Display real-time audio waveform during playback',
    enabled: false,
    category: 'Audio',
  },
]);

// Use in component
function App() {
  const showVisualizer = flags.find(f => f.id === 'audio-visualizer')?.enabled;
  
  return (
    <div>
      {showVisualizer && <AudioVisualizer />}
      <AudioPlayer />
    </div>
  );
}
```

### Example 2: Volume Setting

```typescript
// Define setting
const [settings, setSettings] = useState<CustomSetting[]>([
  {
    id: 'default-volume',
    name: 'Default Volume',
    description: 'Set the default audio volume (0-100)',
    type: 'number',
    value: 80,
    min: 0,
    max: 100,
    category: 'Audio',
  },
]);

// Use in audio playback module
const defaultVolume = settings.find(s => s.id === 'default-volume')?.value as number;

const { play } = useAudioPlayback({
  volume: defaultVolume / 100, // Convert to 0-1 range
  fadeTime: 1000,
});
```

### Example 3: Dark Mode Setting

```typescript
// Define setting
{
  id: 'dark-mode',
  name: 'Dark Mode',
  description: 'Use dark theme for the interface',
  type: 'boolean',
  value: false,
  category: 'Appearance',
}

// Use in component
const isDarkMode = settings.find(s => s.id === 'dark-mode')?.value as boolean;

return (
  <div className={isDarkMode ? 'dark' : 'light'}>
    {/* App content */}
  </div>
);
```

### Example 4: Recognition Delay Setting

```typescript
// Define setting
{
  id: 'recognition-delay',
  name: 'Recognition Delay',
  description: 'How long to wait before recognizing photo (seconds)',
  type: 'number',
  value: 3,
  min: 1,
  max: 10,
  category: 'Recognition',
}

// Use in photo recognition
const recognitionDelay = settings.find(s => s.id === 'recognition-delay')?.value as number;

usePhotoRecognition(stream, {
  recognitionDelay: recognitionDelay * 1000, // Convert to ms
});
```

---

## Best Practices

### For Feature Flags

1. **Descriptive IDs**: Use kebab-case IDs that clearly describe the feature
   - ✅ Good: `ml-photo-recognition`, `audio-crossfade`
   - ❌ Bad: `feature1`, `new-thing`

2. **Clear Descriptions**: Help users understand what the flag does
   - ✅ Good: "Use machine learning for more accurate photo matching"
   - ❌ Bad: "ML stuff"

3. **Safe Defaults**: Default to `false` for experimental features

4. **Categories**: Group related flags together
   - Recognition, Audio, UI, Experimental, etc.

5. **Cleanup**: Remove flags once features are stable and enabled by default

### For Custom Settings

1. **Appropriate Types**: Choose the right type for the setting
   - `boolean`: On/off toggles
   - `number`: Numeric values with min/max
   - `string`: Text input
   - `select`: Multiple choice options

2. **Validation**: Always set min/max for numbers

3. **Sensible Defaults**: Choose defaults that work for most users

4. **Units**: Include units in the name or description
   - ✅ "Recognition Delay (seconds)"
   - ❌ "Recognition Delay"

5. **Categories**: Group related settings together

### For Persistence

To make flags/settings persist across sessions:

```typescript
// Load from localStorage on mount
const [flags, setFlags] = useState<FeatureFlag[]>(() => {
  const saved = localStorage.getItem('featureFlags');
  return saved ? JSON.parse(saved) : defaultFlags;
});

// Save to localStorage when changed
useEffect(() => {
  localStorage.setItem('featureFlags', JSON.stringify(flags));
}, [flags]);
```

---

## Testing Your Changes

### Manual Testing

1. **Activate Secret Menu**: Triple-tap center of screen
2. **Verify Display**: Check that your flag/setting appears
3. **Toggle/Change**: Test that changes work
4. **Check Feature**: Verify the feature behaves correctly
5. **Persistence**: Reload page and check if state persists (if implemented)

### Automated Testing

Add tests for your flag/setting usage:

```typescript
describe('MyFeature', () => {
  it('should use ML recognition when flag is enabled', () => {
    const flags = [{ id: 'ml-recognition', enabled: true, ... }];
    // Test ML recognition is used
  });
  
  it('should use placeholder when flag is disabled', () => {
    const flags = [{ id: 'ml-recognition', enabled: false, ... }];
    // Test placeholder is used
  });
});
```

### Cross-Browser Testing

Test activation on:
- Desktop: Chrome, Firefox, Safari
- Mobile: iOS Safari, Android Chrome
- Touch and click events both work

---

## Troubleshooting

### Flag not appearing in menu?

- Check that you passed `featureFlags` prop to `<SecretMenu>`
- Verify the flag object has all required fields

### Toggle not working?

- Ensure `onFeatureFlagToggle` handler is passed
- Check that handler updates state correctly
- Verify React state is updating (use React DevTools)

### Setting not persisting?

- Implement localStorage save/load (see examples above)
- Check browser console for errors
- Verify localStorage is not full

### Menu not opening?

- Tap exactly in center of screen
- Tap 3 times quickly (within 500ms)
- Check browser console for errors

---

## Additional Resources

- **Module README**: `src/modules/secret-menu/README.md`
- **Type Definitions**: `src/modules/secret-menu/types.ts`
- **Component Tests**: `src/modules/secret-menu/SecretMenu.test.tsx`
- **Architecture Docs**: `ARCHITECTURE.md`

---

**Need Help?**

Check the comprehensive module README at `src/modules/secret-menu/README.md` for more detailed examples and API documentation.
