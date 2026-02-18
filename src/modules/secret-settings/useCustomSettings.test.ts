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

      const profileSetting = result.current.settings.find((s) => s.id === 'config-profile');
      expect(profileSetting?.value).toBe('custom');

      const recognitionDelay = result.current.settings.find((s) => s.id === 'recognition-delay');
      expect(recognitionDelay?.value).toBe(1000);
    });

    it('should load saved settings from localStorage', () => {
      const savedSettings = [
        {
          id: 'config-profile',
          name: 'Config Profile',
          description: 'Test description',
          type: 'select',
          value: 'baseline-phash',
          options: [
            { label: 'Custom (manual control)', value: 'custom' },
            { label: 'Baseline · pHash', value: 'baseline-phash' },
          ],
          category: 'recognition',
        },
      ];

      localStorage.setItem('photo-signal-custom-settings', JSON.stringify(savedSettings));

      const { result } = renderHook(() => useCustomSettings());

      const profileSetting = result.current.settings.find((s) => s.id === 'config-profile');
      expect(profileSetting?.value).toBe('baseline-phash');
    });
  });

  describe('updateSetting', () => {
    it('should update a string setting value', () => {
      const { result } = renderHook(() => useCustomSettings());

      const settingId = 'config-profile';

      act(() => {
        result.current.updateSetting(settingId, 'baseline-phash');
      });

      const updatedSetting = result.current.settings.find((s) => s.id === settingId);
      expect(updatedSetting?.value).toBe('baseline-phash');
    });

    it('should update a number setting value', () => {
      const { result } = renderHook(() => useCustomSettings());

      const settingId = 'recognition-delay';
      const newValue = 1500;

      act(() => {
        result.current.updateSetting(settingId, newValue);
      });

      const updatedSetting = result.current.settings.find((s) => s.id === settingId);
      expect(updatedSetting?.value).toBe(newValue);
    });

    it('should persist setting value to localStorage', () => {
      const { result } = renderHook(() => useCustomSettings());

      const settingId = 'config-profile';

      act(() => {
        result.current.updateSetting(settingId, 'baseline-phash');
      });

      const saved = localStorage.getItem('photo-signal-custom-settings');
      expect(saved).toBeTruthy();

      const parsed = JSON.parse(saved!);
      const savedSetting = parsed.find((s: { id: string }) => s.id === settingId);
      expect(savedSetting.value).toBe('baseline-phash');
    });

    it('should only update the specified setting', () => {
      const { result } = renderHook(() => useCustomSettings());

      const settingId = 'config-profile';
      const otherSettingId = 'recognition-delay';
      const otherOriginalValue = result.current.settings.find(
        (s) => s.id === otherSettingId
      )?.value;

      act(() => {
        result.current.updateSetting(settingId, 'baseline-phash');
      });

      const otherSetting = result.current.settings.find((s) => s.id === otherSettingId);
      expect(otherSetting?.value).toBe(otherOriginalValue);
    });
  });

  describe('getSetting', () => {
    it('should return the value of an existing setting', () => {
      const { result } = renderHook(() => useCustomSettings());

      const value = result.current.getSetting('config-profile');
      expect(value).toBe('custom');
    });

    it('should return undefined for non-existent setting', () => {
      const { result } = renderHook(() => useCustomSettings());

      const value = result.current.getSetting('non-existent-setting');
      expect(value).toBeUndefined();
    });

    it('should return updated value after updateSetting', () => {
      const { result } = renderHook(() => useCustomSettings());

      act(() => {
        result.current.updateSetting('config-profile', 'baseline-phash');
      });

      const value = result.current.getSetting('config-profile');
      expect(value).toBe('baseline-phash');
    });

    it('should work with type parameter', () => {
      const { result } = renderHook(() => useCustomSettings());

      const value = result.current.getSetting<number>('recognition-delay');
      expect(typeof value).toBe('number');
      expect(value).toBe(1000);
    });

    it('should return numeric values after updates', () => {
      const { result } = renderHook(() => useCustomSettings());

      act(() => {
        result.current.updateSetting('recognition-delay', 1500);
      });

      const value = result.current.getSetting<number>('recognition-delay');
      expect(typeof value).toBe('number');
      expect(value).toBe(1500);
    });
  });

  describe('resetSettings', () => {
    it('should reset all settings to default values', () => {
      const { result } = renderHook(() => useCustomSettings());

      // Update all settings
      act(() => {
        result.current.updateSetting('config-profile', 'baseline-phash');
        result.current.updateSetting('recognition-delay', 1500);
      });

      // Verify settings are updated
      expect(result.current.getSetting('config-profile')).toBe('baseline-phash');
      expect(result.current.getSetting('recognition-delay')).toBe(1500);

      // Reset
      act(() => {
        result.current.resetSettings();
      });

      // Verify settings are back to defaults
      expect(result.current.getSetting('config-profile')).toBe('custom');
      expect(result.current.getSetting('recognition-delay')).toBe(1000);
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
