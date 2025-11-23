/**
 * Custom Settings State Management Hook
 *
 * Provides state management for custom settings with localStorage persistence.
 */

import { useState, useEffect, useCallback } from 'react';
import type { CustomSetting } from './types';
import { CUSTOM_SETTINGS } from './config';

const STORAGE_KEY = 'photo-signal-custom-settings';

/**
 * Hook for managing custom settings
 *
 * Persists state to localStorage and provides methods to update and retrieve
 * setting values.
 *
 * @returns Object with settings array, update function, get function, and reset function
 *
 * @example
 * ```tsx
 * const { settings, updateSetting, getSetting } = useCustomSettings();
 *
 * // Get a setting value
 * const theme = getSetting<string>('theme-mode');
 *
 * // Update a setting
 * updateSetting('theme-mode', 'light');
 * ```
 */
export function useCustomSettings() {
  const [settings, setSettings] = useState<CustomSetting[]>(() => {
    // Load from localStorage on initial render
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedSettings = JSON.parse(saved) as CustomSetting[];
        // Merge with config to ensure new settings are included
        return CUSTOM_SETTINGS.map((configSetting) => {
          const savedSetting = savedSettings.find((s) => s.id === configSetting.id);
          return savedSetting ? { ...configSetting, value: savedSetting.value } : configSetting;
        });
      }
    } catch (error) {
      console.error('Failed to load custom settings from localStorage:', error);
    }
    return CUSTOM_SETTINGS;
  });

  // Save to localStorage whenever settings change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save custom settings to localStorage:', error);
    }
  }, [settings]);

  /**
   * Update a setting value
   * @param id - The unique identifier of the setting to update
   * @param value - The new value for the setting
   */
  const updateSetting = useCallback((id: string, value: string | number | boolean) => {
    setSettings((prev) => prev.map((s) => (s.id === id ? { ...s, value } : s)));
  }, []);

  /**
   * Get a setting value by ID
   * @param id - The unique identifier of the setting to retrieve
   * @returns The setting value, or undefined if not found
   */
  const getSetting = useCallback(
    <T = string | number | boolean>(id: string): T | undefined => {
      return settings.find((s) => s.id === id)?.value as T | undefined;
    },
    [settings]
  );

  /**
   * Reset all settings to default values
   */
  const resetSettings = useCallback(() => {
    setSettings(CUSTOM_SETTINGS);
  }, []);

  return {
    settings,
    updateSetting,
    getSetting,
    resetSettings,
  };
}
