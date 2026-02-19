/**
 * Tests for useCustomSettings hook
 *
 * The hook is now a no-op stub — all recognition parameters are self-tuning
 * at runtime and no custom settings are configurable.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCustomSettings } from './useCustomSettings';

describe('useCustomSettings', () => {
  it('should return an empty settings array', () => {
    const { result } = renderHook(() => useCustomSettings());

    expect(Array.isArray(result.current.settings)).toBe(true);
    expect(result.current.settings.length).toBe(0);
  });

  it('should return undefined for any setting id', () => {
    const { result } = renderHook(() => useCustomSettings());

    expect(result.current.getSetting('recognition-delay')).toBeUndefined();
    expect(result.current.getSetting('non-existent')).toBeUndefined();
  });

  it('should expose updateSetting and resetSettings as no-ops', () => {
    const { result } = renderHook(() => useCustomSettings());

    // Should not throw
    expect(() => result.current.updateSetting('recognition-delay', 1000)).not.toThrow();
    expect(() => result.current.resetSettings()).not.toThrow();
  });
});
