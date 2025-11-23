/**
 * Feature Flags State Management Hook
 *
 * Provides state management for feature flags with localStorage persistence.
 * Syncs test-mode flag with dataService for backwards compatibility.
 */

import { useState, useEffect, useCallback } from 'react';
import type { FeatureFlag } from './types';
import { FEATURE_FLAGS } from './config';
import { dataService } from '../../services/data-service';

const STORAGE_KEY = 'photo-signal-feature-flags';

/**
 * Hook for managing feature flags
 *
 * Persists state to localStorage and provides methods to toggle flags
 * and check if a specific flag is enabled.
 *
 * @returns Object with flags array, toggle function, isEnabled check, and reset function
 *
 * @example
 * ```tsx
 * const { flags, toggleFlag, isEnabled } = useFeatureFlags();
 *
 * // Check if a flag is enabled
 * if (isEnabled('test-mode')) {
 *   // Enable test data
 * }
 *
 * // Toggle a flag
 * toggleFlag('test-mode');
 * ```
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
          return savedFlag ? { ...configFlag, enabled: savedFlag.enabled } : configFlag;
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
      // Dispatch custom event to notify other components (e.g., FeatureFlagContext)
      window.dispatchEvent(new Event('feature-flags-updated'));
    } catch (error) {
      console.error('Failed to save feature flags to localStorage:', error);
    }
  }, [flags]);

  // Sync test-mode flag with dataService
  useEffect(() => {
    const testModeEnabled = flags.find((flag) => flag.id === 'test-mode')?.enabled ?? false;
    dataService.setTestMode(testModeEnabled);
  }, [flags]);

  /**
   * Toggle a feature flag on/off
   * @param id - The unique identifier of the flag to toggle
   */
  const toggleFlag = useCallback((id: string) => {
    setFlags((prev) =>
      prev.map((flag) => (flag.id === id ? { ...flag, enabled: !flag.enabled } : flag))
    );
  }, []);

  /**
   * Check if a feature flag is enabled
   * @param id - The unique identifier of the flag to check
   * @returns true if enabled, false otherwise
   */
  const isEnabled = useCallback(
    (id: string): boolean => {
      return flags.find((flag) => flag.id === id)?.enabled ?? false;
    },
    [flags]
  );

  /**
   * Reset all flags to default values
   */
  const resetFlags = useCallback(() => {
    setFlags(FEATURE_FLAGS);
  }, []);

  return {
    flags,
    toggleFlag,
    isEnabled,
    resetFlags,
  };
}
