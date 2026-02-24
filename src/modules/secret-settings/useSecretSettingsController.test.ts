/**
 * Tests for useSecretSettingsController hook
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSecretSettingsController } from './useSecretSettingsController';

describe('useSecretSettingsController', () => {
  let mockOnClose: () => void;

  beforeEach(() => {
    localStorage.clear();
    mockOnClose = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with the simplified API', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      expect(result.current.flags).toBeDefined();
      expect(result.current.toggleFlag).toBeDefined();
      expect(result.current.isEnabled).toBeDefined();
      expect(result.current.handleSendIt).toBeDefined();
    });

    it('should expose flags as an array with correct structure', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      expect(Array.isArray(result.current.flags)).toBe(true);
      expect(result.current.flags.length).toBeGreaterThan(0);

      result.current.flags.forEach((flag) => {
        expect(flag).toHaveProperty('id');
        expect(flag).toHaveProperty('name');
        expect(flag).toHaveProperty('enabled');
      });
    });
  });

  describe('Feature Flag Management', () => {
    it('should toggle feature flags via toggleFlag', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      const initialFlagState = result.current.isEnabled('show-debug-overlay');

      act(() => {
        result.current.toggleFlag('show-debug-overlay');
      });

      expect(result.current.isEnabled('show-debug-overlay')).toBe(!initialFlagState);
    });

    it('should return false for unknown flag ids', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      expect(result.current.isEnabled('non-existent-flag')).toBe(false);
    });
  });

  describe('handleSendIt Behavior', () => {
    it('should call onClose callback', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      act(() => {
        result.current.handleSendIt();
      });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should trigger reload after delay', () => {
      const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});

      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      act(() => {
        result.current.handleSendIt();
      });

      // Reload should not be called immediately
      expect(reloadSpy).not.toHaveBeenCalled();

      // Advance timers by the delay
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Now reload should be called
      expect(reloadSpy).toHaveBeenCalledTimes(1);

      reloadSpy.mockRestore();
    });

    it('should use correct delay timing', () => {
      const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});

      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      act(() => {
        result.current.handleSendIt();
      });

      // Advance by less than the delay
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Should not have reloaded yet
      expect(reloadSpy).not.toHaveBeenCalled();

      // Advance to exactly 100ms
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Now it should reload
      expect(reloadSpy).toHaveBeenCalledTimes(1);

      reloadSpy.mockRestore();
    });

    it('should call onClose before reload', () => {
      const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
      const callOrder: string[] = [];

      const trackedOnClose = () => {
        callOrder.push('onClose');
        mockOnClose();
      };

      const originalSetTimeout = window.setTimeout;
      vi.spyOn(window, 'setTimeout').mockImplementation((callback, delay) => {
        callOrder.push('setTimeout');
        return originalSetTimeout(() => {
          callOrder.push('reload');
          callback();
        }, delay) as unknown as ReturnType<typeof setTimeout>;
      });

      const { result } = renderHook(() => useSecretSettingsController(trackedOnClose));

      act(() => {
        result.current.handleSendIt();
      });

      // onClose should be called first
      expect(callOrder[0]).toBe('onClose');
      expect(callOrder[1]).toBe('setTimeout');

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(callOrder[2]).toBe('reload');

      reloadSpy.mockRestore();
    });
  });
});
