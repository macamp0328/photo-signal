/**
 * Feature Flags State Management Hook
 *
 * Provides state management for feature flags with localStorage persistence.
 */

import { useState, useEffect, useCallback } from 'react';
import type { FeatureFlag } from './types';
import { FEATURE_FLAGS } from './config';

const STORAGE_KEY = 'photo-signal-feature-flags';

function sanitizeSavedFlags(savedFlags: unknown[]): Array<Pick<FeatureFlag, 'id' | 'enabled'>> {
  const supportedFlagIds = new Set(FEATURE_FLAGS.map((flag) => flag.id));

  return savedFlags.flatMap((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) {
      return [];
    }

    const record = candidate as Record<string, unknown>;
    if (typeof record.id !== 'string' || typeof record.enabled !== 'boolean') {
      return [];
    }

    if (!supportedFlagIds.has(record.id)) {
      return [];
    }

    return [{ id: record.id, enabled: record.enabled }];
  });
}

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
 * if (isEnabled('show-debug-overlay')) {
 *   // Show debugging UI
 * }
 *
 * // Toggle a flag
 * toggleFlag('rectangle-detection');
 * ```
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>(() => {
    // Load from localStorage on initial render
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        const savedFlags = Array.isArray(parsed) ? sanitizeSavedFlags(parsed) : [];

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

  /**
   * Explicitly set a feature flag state
   * @param id - The unique identifier of the flag to update
   * @param enabled - Desired state
   */
  const setFlagState = useCallback((id: string, enabled: boolean) => {
    setFlags((prev) => prev.map((flag) => (flag.id === id ? { ...flag, enabled } : flag)));
  }, []);

  /**
   * Toggle a feature flag on/off
   * @param id - The unique identifier of the flag to toggle
   */
  const toggleFlag = useCallback(
    (id: string) => {
      const flag = flags.find((f) => f.id === id);
      setFlagState(id, !(flag?.enabled ?? false));
    },
    [flags, setFlagState]
  );

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
    setFlagState,
    isEnabled,
    resetFlags,
  };
}
