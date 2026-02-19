/**
 * Custom Settings State Management Hook
 *
 * All recognition parameters are now hardcoded with sensible defaults and
 * self-tune at runtime. This hook is kept for backward compatibility but
 * returns an empty settings list — no custom settings are configurable.
 */

import type { CustomSetting } from './types';

/**
 * Hook for managing custom settings (currently empty — all parameters are
 * self-tuning at runtime).
 *
 * @returns Object with empty settings array and no-op helpers
 */
export function useCustomSettings() {
  const settings: CustomSetting[] = [];

  // Type the no-op functions explicitly so callers get correct types
  // without naming unused parameters (which would trigger no-unused-vars).
  const updateSetting: (id: string, value: string | number | boolean) => void = () => {};

  const getSetting: <T = string | number | boolean>(id: string) => T | undefined = () => undefined;

  const resetSettings: () => void = () => {};

  return {
    settings,
    updateSetting,
    getSetting,
    resetSettings,
  };
}
