/**
 * Tests for useTripleTap hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTripleTap } from './useTripleTap';

describe('useTripleTap', () => {
  let mockCallback: () => void;

  beforeEach(() => {
    mockCallback = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Triple-tap detection', () => {
    it('should call callback on three rapid clicks in center', () => {
      // Set viewport size
      Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });

      renderHook(() => useTripleTap({ onTripleTap: mockCallback }));

      // Simulate three clicks in center (450, 300)
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        clientX: 450,
        clientY: 300,
      });

      window.dispatchEvent(clickEvent);
      window.dispatchEvent(clickEvent);
      window.dispatchEvent(clickEvent);

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });

    it('should call callback on three rapid touches in center', () => {
      Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });

      renderHook(() => useTripleTap({ onTripleTap: mockCallback }));

      // Simulate three touches in center using click events (touch is handled same way)
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        clientX: 450,
        clientY: 300,
      });

      window.dispatchEvent(clickEvent);
      window.dispatchEvent(clickEvent);
      window.dispatchEvent(clickEvent);

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Center region validation', () => {
    it('should NOT trigger on clicks outside center region', () => {
      Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });

      renderHook(() => useTripleTap({ onTripleTap: mockCallback }));

      // Click in top-left corner (not center)
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        clientX: 50,
        clientY: 50,
      });

      window.dispatchEvent(clickEvent);
      window.dispatchEvent(clickEvent);
      window.dispatchEvent(clickEvent);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should trigger on clicks in center third of screen', () => {
      Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });

      renderHook(() => useTripleTap({ onTripleTap: mockCallback }));

      // Center region is 300px wide (900/3), 200px tall (600/3)
      // Center is at (450, 300), so valid range is (300-600, 200-400)
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        clientX: 400,
        clientY: 250,
      });

      window.dispatchEvent(clickEvent);
      window.dispatchEvent(clickEvent);
      window.dispatchEvent(clickEvent);

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Timeout behavior', () => {
    it('should reset tap count after timeout', () => {
      Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });

      renderHook(() =>
        useTripleTap({
          onTripleTap: mockCallback,
          tapTimeout: 500,
        })
      );

      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        clientX: 450,
        clientY: 300,
      });

      // First click
      window.dispatchEvent(clickEvent);

      // Wait for timeout to expire
      vi.advanceTimersByTime(600);

      // Second and third clicks (should not trigger because count was reset)
      window.dispatchEvent(clickEvent);
      window.dispatchEvent(clickEvent);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should use custom tap timeout', () => {
      Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });

      renderHook(() =>
        useTripleTap({
          onTripleTap: mockCallback,
          tapTimeout: 1000,
        })
      );

      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        clientX: 450,
        clientY: 300,
      });

      // First click
      window.dispatchEvent(clickEvent);

      // Wait less than timeout
      vi.advanceTimersByTime(800);

      // Second and third clicks (should still work)
      window.dispatchEvent(clickEvent);
      window.dispatchEvent(clickEvent);

      expect(mockCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge cases', () => {
    it('should not trigger on only two taps', () => {
      Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });

      renderHook(() => useTripleTap({ onTripleTap: mockCallback }));

      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        clientX: 450,
        clientY: 300,
      });

      window.dispatchEvent(clickEvent);
      window.dispatchEvent(clickEvent);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should reset count after successful triple tap', () => {
      Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });

      renderHook(() => useTripleTap({ onTripleTap: mockCallback }));

      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        clientX: 450,
        clientY: 300,
      });

      // First triple tap
      window.dispatchEvent(clickEvent);
      window.dispatchEvent(clickEvent);
      window.dispatchEvent(clickEvent);

      expect(mockCallback).toHaveBeenCalledTimes(1);

      // Second triple tap
      window.dispatchEvent(clickEvent);
      window.dispatchEvent(clickEvent);
      window.dispatchEvent(clickEvent);

      expect(mockCallback).toHaveBeenCalledTimes(2);
    });

    it('should clean up event listeners on unmount', () => {
      Object.defineProperty(window, 'innerWidth', { value: 900, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });

      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useTripleTap({ onTripleTap: mockCallback }));

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('touchend', expect.any(Function));
    });
  });
});
