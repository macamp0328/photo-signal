# Secret Menu Module

> **Purpose**: Provides a hidden developer/advanced settings menu activated by triple-tapping the center of the screen. This module serves as scaffolding for future feature flags and custom settings.

📚 **See also**: [DOCUMENTATION_INDEX.md](../../../DOCUMENTATION_INDEX.md) for a complete list of all project documentation.

---

## 🎯 Overview

The Secret Menu module provides:

1. **Triple Tap Detection** - Cross-platform gesture detection (mouse and touch)
2. **Hidden Modal UI** - Clean, accessible settings panel
3. **Extensible Architecture** - Ready for feature flags and custom settings
4. **Developer Documentation** - Clear guide for future extensions

---

## 🚀 Usage

### Basic Integration

```typescript
import { useRef, useState, useEffect } from 'react';
import { SecretMenu, useTripleTap } from './modules/secret-menu';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { isTripleTap, reset } = useTripleTap(containerRef, {
    maxDelay: 500,
    targetArea: 'center',
    centerThreshold: 0.3,
  });

  useEffect(() => {
    if (isTripleTap) {
      setIsMenuOpen(true);
      reset();
    }
  }, [isTripleTap, reset]);

  return (
    <div ref={containerRef} className="h-screen">
      {/* Your app content */}

      <SecretMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </div>
  );
}
```

---

## 📋 API Reference

### `useTripleTap` Hook

Detects triple tap/click gestures on an element.

**Parameters:**

- `elementRef: React.RefObject<HTMLElement>` - Ref to the target element
- `config?: TripleTapConfig` - Optional configuration

**Configuration Options:**

```typescript
interface TripleTapConfig {
  maxDelay?: number; // Max ms between taps (default: 500)
  targetArea?: 'center' | 'anywhere'; // Where to detect (default: 'center')
  centerThreshold?: number; // % of screen considered center (default: 0.3)
}
```

**Returns:**

```typescript
interface TripleTapHook {
  isTripleTap: boolean; // True when triple tap detected
  reset: () => void; // Reset detection state
}
```

---

### `SecretMenu` Component

Modal component that displays developer settings.

**Props:**

```typescript
interface SecretMenuProps {
  isOpen: boolean; // Controls visibility
  onClose: () => void; // Called when menu should close
}
```

**Features:**

- Backdrop click to close
- Close button
- Responsive design (mobile and desktop)
- Accessible (ARIA labels, keyboard support)
- Placeholder sections for feature flags and settings

---

## 🛠️ Extension Guide

### Adding Feature Flags

Feature flags allow you to enable/disable features without code changes. Here's how to add them:

#### Step 1: Define Your Flag Structure

```typescript
// Example: src/config/featureFlags.ts
import type { FeatureFlag } from './modules/secret-menu';

export const featureFlags: FeatureFlag[] = [
  {
    id: 'experimental-recognition',
    name: 'Experimental Photo Recognition',
    description: 'Use ML-based photo recognition instead of placeholder',
    enabled: false,
    category: 'Recognition',
  },
  {
    id: 'audio-crossfade',
    name: 'Audio Crossfade',
    description: 'Enable smooth crossfade between tracks',
    enabled: false,
    category: 'Audio',
  },
  {
    id: 'debug-mode',
    name: 'Debug Mode',
    description: 'Show debug information overlay',
    enabled: false,
    category: 'Developer',
  },
];
```

#### Step 2: Create a Feature Flag Hook

```typescript
// Example: src/hooks/useFeatureFlags.ts
import { useState, useEffect } from 'react';
import type { FeatureFlag } from './modules/secret-menu';
import { featureFlags as defaultFlags } from './config/featureFlags';

const STORAGE_KEY = 'photo-signal-feature-flags';

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : defaultFlags;
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  }, [flags]);

  const toggleFlag = (id: string) => {
    setFlags((prev) =>
      prev.map((flag) =>
        flag.id === id ? { ...flag, enabled: !flag.enabled } : flag
      )
    );
  };

  const isEnabled = (id: string): boolean => {
    return flags.find((f) => f.id === id)?.enabled ?? false;
  };

  return { flags, toggleFlag, isEnabled };
}
```

#### Step 3: Update SecretMenu Component

```typescript
// Example: Modify SecretMenu.tsx
import { useFeatureFlags } from '../../hooks/useFeatureFlags';

export function SecretMenu({ isOpen, onClose }: SecretMenuProps) {
  const { flags, toggleFlag } = useFeatureFlags();

  // ... existing code ...

  return (
    // ... existing modal structure ...
    <section>
      <h3>🚩 Feature Flags</h3>
      <div className="space-y-2">
        {flags.map((flag) => (
          <label key={flag.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
            <input
              type="checkbox"
              checked={flag.enabled}
              onChange={() => toggleFlag(flag.id)}
              className="w-4 h-4"
            />
            <div className="flex-1">
              <div className="font-medium text-sm">{flag.name}</div>
              <div className="text-xs text-gray-600">{flag.description}</div>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
```

#### Step 4: Use Flags in Your App

```typescript
// Example: Use in a component
import { useFeatureFlags } from './hooks/useFeatureFlags';

function PhotoRecognition() {
  const { isEnabled } = useFeatureFlags();

  if (isEnabled('experimental-recognition')) {
    // Use ML-based recognition
    return <MLPhotoRecognition />;
  } else {
    // Use placeholder logic
    return <PlaceholderRecognition />;
  }
}
```

---

### Adding Custom Settings

Custom settings allow users to configure app behavior. Here's how to add them:

#### Step 1: Define Setting Structure

```typescript
// Example: src/config/customSettings.ts
import type { CustomSetting } from './modules/secret-menu';

export const customSettings: CustomSetting[] = [
  {
    id: 'motion-sensitivity',
    name: 'Motion Sensitivity',
    description: 'How sensitive motion detection should be',
    type: 'number',
    value: 50,
    min: 0,
    max: 100,
  },
  {
    id: 'audio-volume',
    name: 'Default Audio Volume',
    description: 'Initial volume for audio playback',
    type: 'number',
    value: 0.8,
    min: 0,
    max: 1,
  },
  {
    id: 'recognition-delay',
    name: 'Recognition Delay (ms)',
    description: 'Time before triggering photo recognition',
    type: 'number',
    value: 3000,
    min: 1000,
    max: 10000,
  },
  {
    id: 'camera-facing',
    name: 'Camera Direction',
    description: 'Which camera to use',
    type: 'select',
    value: 'environment',
    options: ['environment', 'user'],
  },
];
```

#### Step 2: Create a Settings Hook

```typescript
// Example: src/hooks/useCustomSettings.ts
import { useState, useEffect } from 'react';
import type { CustomSetting } from './modules/secret-menu';
import { customSettings as defaultSettings } from './config/customSettings';

const STORAGE_KEY = 'photo-signal-custom-settings';

export function useCustomSettings() {
  const [settings, setSettings] = useState<CustomSetting[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSetting = (id: string, value: boolean | number | string) => {
    setSettings((prev) =>
      prev.map((setting) =>
        setting.id === id ? { ...setting, value } : setting
      )
    );
  };

  const getSetting = (id: string): boolean | number | string | undefined => {
    return settings.find((s) => s.id === id)?.value;
  };

  const resetToDefaults = () => {
    setSettings(defaultSettings);
  };

  return { settings, updateSetting, getSetting, resetToDefaults };
}
```

#### Step 3: Update SecretMenu Component

```typescript
// Add to SecretMenu.tsx
import { useCustomSettings } from '../../hooks/useCustomSettings';

export function SecretMenu({ isOpen, onClose }: SecretMenuProps) {
  const { settings, updateSetting } = useCustomSettings();

  // ... existing code ...

  return (
    // ... existing modal structure ...
    <section>
      <h3>🎛️ Custom Settings</h3>
      <div className="space-y-3">
        {settings.map((setting) => (
          <div key={setting.id} className="p-3 bg-gray-50 rounded">
            <label className="block">
              <div className="font-medium text-sm mb-1">{setting.name}</div>
              <div className="text-xs text-gray-600 mb-2">
                {setting.description}
              </div>

              {setting.type === 'number' && (
                <input
                  type="range"
                  min={setting.min}
                  max={setting.max}
                  value={setting.value as number}
                  onChange={(e) =>
                    updateSetting(setting.id, parseFloat(e.target.value))
                  }
                  className="w-full"
                />
              )}

              {setting.type === 'boolean' && (
                <input
                  type="checkbox"
                  checked={setting.value as boolean}
                  onChange={(e) => updateSetting(setting.id, e.target.checked)}
                />
              )}

              {setting.type === 'select' && (
                <select
                  value={setting.value as string}
                  onChange={(e) => updateSetting(setting.id, e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  {setting.options?.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <div className="text-xs text-gray-500 mt-1">
              Current: {String(setting.value)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

#### Step 4: Use Settings in Your App

```typescript
// Example: Use in motion detection
import { useCustomSettings } from './hooks/useCustomSettings';

function MotionDetector() {
  const { getSetting } = useCustomSettings();
  const sensitivity = (getSetting('motion-sensitivity') as number) ?? 50;

  const { isMoving } = useMotionDetection(stream, {
    sensitivity,
    // ... other options
  });

  // ... rest of component
}
```

---

## 🎨 Design Guidelines

When extending this module:

1. **Keep it hidden** - Only power users should discover this menu
2. **Use clear labels** - Make settings self-explanatory
3. **Provide defaults** - All settings should have sensible defaults
4. **Persist state** - Use localStorage to remember user choices
5. **Be accessible** - Follow ARIA best practices
6. **Match app style** - Use consistent design language
7. **Add help text** - Explain what each setting does

---

## 🔒 Security Considerations

- **No sensitive data** - Don't expose API keys or secrets
- **Validate inputs** - Sanitize all user inputs
- **Use localStorage** - For client-side persistence only
- **Rate limiting** - Consider adding for production features
- **Debug info** - Be careful not to leak sensitive information

---

## 🧪 Testing

### Testing Triple Tap Detection

```typescript
import { renderHook, act } from '@testing-library/react';
import { useTripleTap } from './useTripleTap';

test('detects triple tap in center', () => {
  const ref = { current: document.createElement('div') };
  const { result } = renderHook(() =>
    useTripleTap(ref, { targetArea: 'center' })
  );

  // Simulate three clicks
  act(() => {
    ref.current?.click();
    ref.current?.click();
    ref.current?.click();
  });

  expect(result.current.isTripleTap).toBe(true);
});
```

### Testing SecretMenu Component

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { SecretMenu } from './SecretMenu';

test('renders when open', () => {
  render(<SecretMenu isOpen={true} onClose={() => {}} />);
  expect(screen.getByText('Developer Settings')).toBeInTheDocument();
});

test('calls onClose when backdrop clicked', () => {
  const onClose = vi.fn();
  render(<SecretMenu isOpen={true} onClose={onClose} />);

  const backdrop = screen.getByRole('dialog').previousSibling;
  fireEvent.click(backdrop as Element);

  expect(onClose).toHaveBeenCalled();
});
```

---

## 📝 Future Enhancements

- [ ] Export/import settings as JSON
- [ ] Settings search/filter
- [ ] Settings categories/tabs
- [ ] Reset individual settings
- [ ] Settings profiles (presets)
- [ ] Keyboard shortcuts to open menu
- [ ] Admin password protection
- [ ] Settings sync across devices
- [ ] Settings changelog/history

---

## 🤝 Contributing

When adding new feature flags or settings:

1. **Document the flag/setting** - Clear name, description, and purpose
2. **Add to the appropriate category** - Keep related items together
3. **Test thoroughly** - Ensure flag/setting works as expected
4. **Update this README** - Add examples and usage guide
5. **Consider defaults** - What should the default value be?
6. **Add validation** - Prevent invalid values
7. **Update DOCUMENTATION_INDEX.md** - Keep documentation up to date

---

## 🐛 Troubleshooting

**Triple tap not working?**

- Check that the element ref is correctly attached
- Verify `maxDelay` isn't too short
- Ensure clicks/taps are in the center (if using `targetArea: 'center'`)
- Check browser console for errors

**Menu not closing?**

- Ensure `onClose` callback is properly wired
- Check z-index conflicts
- Verify backdrop click handler is working

**Settings not persisting?**

- Check localStorage is enabled
- Verify storage key is correct
- Look for localStorage quota errors
- Check for JSON parse errors

---

## 📚 Related Documentation

- [ARCHITECTURE.md](../../../ARCHITECTURE.md) - Overall module structure
- [CONTRIBUTING.md](../../../CONTRIBUTING.md) - Contribution guidelines
- [DOCUMENTATION_INDEX.md](../../../DOCUMENTATION_INDEX.md) - Complete documentation index

---

## 📄 License

MIT © Miles Camp
