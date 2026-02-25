/**
 * Tests for useFeatureFlags hook
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeatureFlags } from './useFeatureFlags';
import { FEATURE_FLAGS } from './config';

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
          id: 'show-debug-overlay',
          name: 'Debug Overlay',
          description: 'Test description',
          enabled: true,
          category: 'development' as const,
        },
      ];

      localStorage.setItem('photo-signal-feature-flags', JSON.stringify(savedFlags));

      const { result } = renderHook(() => useFeatureFlags());

      const debugOverlayFlag = result.current.flags.find((f) => f.id === 'show-debug-overlay');
      expect(debugOverlayFlag?.enabled).toBe(true);
    });

    it('should ignore malformed persisted entries and keep valid supported flags', () => {
      localStorage.setItem(
        'photo-signal-feature-flags',
        JSON.stringify([null, 'bad', { id: 'show-debug-overlay', enabled: true }, { id: 42 }])
      );

      const { result } = renderHook(() => useFeatureFlags());

      expect(result.current.isEnabled('show-debug-overlay')).toBe(true);
      expect(result.current.flags.length).toBe(FEATURE_FLAGS.length);
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

      const flagId = 'show-debug-overlay';

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

      const flagId = 'show-debug-overlay';

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

  describe('setFlagState', () => {
    it('should explicitly set a flag to the provided state', () => {
      const { result } = renderHook(() => useFeatureFlags());

      act(() => {
        result.current.setFlagState('show-debug-overlay', true);
      });

      expect(result.current.isEnabled('show-debug-overlay')).toBe(true);

      act(() => {
        result.current.setFlagState('show-debug-overlay', false);
      });

      expect(result.current.isEnabled('show-debug-overlay')).toBe(false);
    });

    it('should persist explicit flag changes to localStorage', () => {
      const { result } = renderHook(() => useFeatureFlags());

      act(() => {
        result.current.setFlagState('rectangle-detection', false);
      });

      const saved = localStorage.getItem('photo-signal-feature-flags');
      expect(saved).toBeTruthy();
      const flags = JSON.parse(saved!);
      const rectangleFlag = flags.find((f: { id: string }) => f.id === 'rectangle-detection');
      expect(rectangleFlag?.enabled).toBe(false);
    });
  });

  describe('isEnabled', () => {
    it('should return false for disabled flag', () => {
      const { result } = renderHook(() => useFeatureFlags());

      expect(result.current.isEnabled('show-debug-overlay')).toBe(false);
    });

    it('should return true for enabled flag', () => {
      const { result } = renderHook(() => useFeatureFlags());

      expect(result.current.isEnabled('rectangle-detection')).toBe(true);
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
