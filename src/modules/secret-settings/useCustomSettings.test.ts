/**
 * Tests for useCustomSettings hook
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCustomSettings } from './useCustomSettings';

describe('useCustomSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initialization', () => {
    it('should load settings from config on first render', () => {
      const { result } = renderHook(() => useCustomSettings());

      expect(result.current.settings).toBeDefined();
      expect(result.current.settings.length).toBeGreaterThan(0);
      expect(result.current.settings[0]).toHaveProperty('id');
      expect(result.current.settings[0]).toHaveProperty('name');
      expect(result.current.settings[0]).toHaveProperty('value');
      expect(result.current.settings[0]).toHaveProperty('type');
    });

    it('should load default settings with correct values', () => {
      const { result } = renderHook(() => useCustomSettings());

      const themeSetting = result.current.settings.find((s) => s.id === 'theme-mode');
      expect(themeSetting?.value).toBe('dark');

      const uiStyleSetting = result.current.settings.find((s) => s.id === 'ui-style');
      expect(uiStyleSetting?.value).toBe('modern');
    });

    it('should load saved settings from localStorage', () => {
      const savedSettings = [
        {
          id: 'theme-mode',
          name: 'Theme Mode',
          description: 'Test description',
          type: 'select',
          value: 'light',
          options: [
            { label: 'Dark', value: 'dark' },
            { label: 'Light', value: 'light' },
          ],
          category: 'ui',
        },
      ];

      localStorage.setItem('photo-signal-custom-settings', JSON.stringify(savedSettings));

      const { result } = renderHook(() => useCustomSettings());

      const themeSetting = result.current.settings.find((s) => s.id === 'theme-mode');
      expect(themeSetting?.value).toBe('light');
    });
  });

  describe('updateSetting', () => {
    it('should update a string setting value', () => {
      const { result } = renderHook(() => useCustomSettings());

      const settingId = 'theme-mode';

      act(() => {
        result.current.updateSetting(settingId, 'light');
      });

      const updatedSetting = result.current.settings.find((s) => s.id === settingId);
      expect(updatedSetting?.value).toBe('light');
    });

    it('should update a number setting value', () => {
      const { result } = renderHook(() => useCustomSettings());

      // Add a number setting for testing
      const settingId = result.current.settings[0].id;
      const newValue = 75;

      act(() => {
        result.current.updateSetting(settingId, newValue);
      });

      const updatedSetting = result.current.settings.find((s) => s.id === settingId);
      expect(updatedSetting?.value).toBe(newValue);
    });

    it('should persist setting value to localStorage', () => {
      const { result } = renderHook(() => useCustomSettings());

      const settingId = 'theme-mode';

      act(() => {
        result.current.updateSetting(settingId, 'light');
      });

      const saved = localStorage.getItem('photo-signal-custom-settings');
      expect(saved).toBeTruthy();

      const parsed = JSON.parse(saved!);
      const savedSetting = parsed.find((s: { id: string }) => s.id === settingId);
      expect(savedSetting.value).toBe('light');
    });

    it('should only update the specified setting', () => {
      const { result } = renderHook(() => useCustomSettings());

      const settingId = 'theme-mode';
      const otherSettingId = 'ui-style';
      const otherOriginalValue = result.current.settings.find(
        (s) => s.id === otherSettingId
      )?.value;

      act(() => {
        result.current.updateSetting(settingId, 'light');
      });

      const otherSetting = result.current.settings.find((s) => s.id === otherSettingId);
      expect(otherSetting?.value).toBe(otherOriginalValue);
    });
  });

  describe('getSetting', () => {
    it('should return the value of an existing setting', () => {
      const { result } = renderHook(() => useCustomSettings());

      const value = result.current.getSetting('theme-mode');
      expect(value).toBe('dark');
    });

    it('should return undefined for non-existent setting', () => {
      const { result } = renderHook(() => useCustomSettings());

      const value = result.current.getSetting('non-existent-setting');
      expect(value).toBeUndefined();
    });

    it('should return updated value after updateSetting', () => {
      const { result } = renderHook(() => useCustomSettings());

      act(() => {
        result.current.updateSetting('theme-mode', 'light');
      });

      const value = result.current.getSetting('theme-mode');
      expect(value).toBe('light');
    });

    it('should work with type parameter', () => {
      const { result } = renderHook(() => useCustomSettings());

      const value = result.current.getSetting<string>('theme-mode');
      expect(typeof value).toBe('string');
      expect(value).toBe('dark');
    });
  });

  describe('resetSettings', () => {
    it('should reset all settings to default values', () => {
      const { result } = renderHook(() => useCustomSettings());

      // Update all settings
      act(() => {
        result.current.updateSetting('theme-mode', 'light');
        result.current.updateSetting('ui-style', 'classic');
      });

      // Verify settings are updated
      expect(result.current.getSetting('theme-mode')).toBe('light');
      expect(result.current.getSetting('ui-style')).toBe('classic');

      // Reset
      act(() => {
        result.current.resetSettings();
      });

      // Verify settings are back to defaults
      expect(result.current.getSetting('theme-mode')).toBe('dark');
      expect(result.current.getSetting('ui-style')).toBe('modern');
    });
  });

  describe('localStorage error handling', () => {
    it('should handle localStorage read errors gracefully', () => {
      localStorage.setItem('photo-signal-custom-settings', 'invalid-json');

      const { result } = renderHook(() => useCustomSettings());

      expect(result.current.settings).toBeDefined();
      expect(result.current.settings.length).toBeGreaterThan(0);
    });
  });
});
