/**
 * Tests for useFeatureFlags hook
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeatureFlags } from './useFeatureFlags';
import { FEATURE_FLAGS } from './featureFlagConfig';

describe('useFeatureFlags', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Initialization', () => {
    it('should load flags from config on first render', () => {
      const { result } = renderHook(() => useFeatureFlags());

      expect(result.current.flags).toBeDefined();
      expect(result.current.flags.length).toBeGreaterThan(0);
      expect(result.current.flags[0]).toHaveProperty('id');
      expect(result.current.flags[0]).toHaveProperty('name');
      expect(result.current.flags[0]).toHaveProperty('enabled');
    });

    it('should load default flags matching config', () => {
      const { result } = renderHook(() => useFeatureFlags());

      result.current.flags.forEach((flag) => {
        const configFlag = FEATURE_FLAGS.find((f) => f.id === flag.id);
        expect(flag.enabled).toBe(configFlag?.enabled ?? false);
      });
    });

    it('should load saved flags from localStorage', () => {
      const savedFlags = [
        {
          id: 'test-mode',
          name: 'Test Data Mode',
          description: 'Test description',
          enabled: true,
          category: 'development' as const,
        },
      ];

      localStorage.setItem('photo-signal-feature-flags', JSON.stringify(savedFlags));

      const { result } = renderHook(() => useFeatureFlags());

      const testModeFlag = result.current.flags.find((f) => f.id === 'test-mode');
      expect(testModeFlag?.enabled).toBe(true);
    });
  });

  describe('toggleFlag', () => {
    it('should toggle a flag from false to true', () => {
      const { result } = renderHook(() => useFeatureFlags());

      const flagId = result.current.flags[0].id;
      const initialValue = result.current.flags[0].enabled;

      act(() => {
        result.current.toggleFlag(flagId);
      });

      const updatedFlag = result.current.flags.find((f) => f.id === flagId);
      expect(updatedFlag?.enabled).toBe(!initialValue);
    });

    it('should toggle a flag from true to false', () => {
      const { result } = renderHook(() => useFeatureFlags());

      const flagId = result.current.flags[0].id;

      // Toggle to true
      act(() => {
        result.current.toggleFlag(flagId);
      });

      // Toggle back to false
      act(() => {
        result.current.toggleFlag(flagId);
      });

      const updatedFlag = result.current.flags.find((f) => f.id === flagId);
      expect(updatedFlag?.enabled).toBe(false);
    });

    it('should persist flag state to localStorage', () => {
      const { result } = renderHook(() => useFeatureFlags());

      const flagId = result.current.flags[0].id;

      act(() => {
        result.current.toggleFlag(flagId);
      });

      const saved = localStorage.getItem('photo-signal-feature-flags');
      expect(saved).toBeTruthy();

      const parsed = JSON.parse(saved!);
      const savedFlag = parsed.find((f: { id: string }) => f.id === flagId);
      expect(savedFlag.enabled).toBe(true);
    });
  });

  describe('isEnabled', () => {
    it('should return false for disabled flag', () => {
      const { result } = renderHook(() => useFeatureFlags());

      const flagId = result.current.flags[0].id;
      expect(result.current.isEnabled(flagId)).toBe(false);
    });

    it('should return true for enabled flag', () => {
      const { result } = renderHook(() => useFeatureFlags());

      const flagId = result.current.flags[0].id;

      act(() => {
        result.current.toggleFlag(flagId);
      });

      expect(result.current.isEnabled(flagId)).toBe(true);
    });

    it('should return false for non-existent flag', () => {
      const { result } = renderHook(() => useFeatureFlags());

      expect(result.current.isEnabled('non-existent-flag')).toBe(false);
    });
  });

  describe('resetFlags', () => {
    it('should reset all flags to default values', () => {
      const { result } = renderHook(() => useFeatureFlags());

      // Flip all flags away from their defaults
      act(() => {
        result.current.flags.forEach((flag) => {
          result.current.toggleFlag(flag.id);
        });
      });

      // Verify all are flipped from defaults
      result.current.flags.forEach((flag) => {
        const configFlag = FEATURE_FLAGS.find((f) => f.id === flag.id);
        expect(flag.enabled).toBe(!(configFlag?.enabled ?? false));
      });

      // Reset
      act(() => {
        result.current.resetFlags();
      });

      // Verify all are back to defaults from config
      result.current.flags.forEach((flag) => {
        const configFlag = FEATURE_FLAGS.find((f) => f.id === flag.id);
        expect(flag.enabled).toBe(configFlag?.enabled ?? false);
      });
    });
  });

  describe('localStorage error handling', () => {
    it('should handle localStorage read errors gracefully', () => {
      localStorage.setItem('photo-signal-feature-flags', 'invalid-json');

      const { result } = renderHook(() => useFeatureFlags());

      expect(result.current.flags).toBeDefined();
      expect(result.current.flags.length).toBeGreaterThan(0);
    });
  });
});
