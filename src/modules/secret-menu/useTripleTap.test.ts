import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTripleTap } from './useTripleTap';

describe('useTripleTap', () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;
    // Set a consistent viewport size for tests
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1000 });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: 800 });
    vi.useFakeTimers();
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: originalInnerWidth });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: originalInnerHeight });
    vi.useRealTimers();
  });

  describe('Hook Initialization', () => {
    it('should initialize with zero tap count', () => {
      const onTripleTap = vi.fn();
      const { result } = renderHook(() => useTripleTap(onTripleTap));

      expect(result.current.tapCount).toBe(0);
      expect(typeof result.current.onInteraction).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });

    it('should accept custom options', () => {
      const onTripleTap = vi.fn();
      const { result } = renderHook(() =>
        useTripleTap(onTripleTap, { timeout: 1000, targetArea: 0.3 })
      );

      expect(result.current.tapCount).toBe(0);
    });
  });

  describe('Center Area Detection', () => {
    it('should detect tap in center of screen', () => {
      const onTripleTap = vi.fn();
      const { result } = renderHook(() => useTripleTap(onTripleTap));

      // Tap in center (500, 400)
      const mouseEvent = new MouseEvent('click', {
        clientX: 500,
        clientY: 400,
        bubbles: true,
      }) as unknown as React.MouseEvent;

      act(() => {
        result.current.onInteraction(mouseEvent);
      });

      expect(result.current.tapCount).toBe(1);
    });

    it('should ignore tap outside center area', () => {
      const onTripleTap = vi.fn();
      const { result } = renderHook(() => useTripleTap(onTripleTap));

      // Tap in corner (50, 50)
      const mouseEvent = new MouseEvent('click', {
        clientX: 50,
        clientY: 50,
        bubbles: true,
      }) as unknown as React.MouseEvent;

      act(() => {
        result.current.onInteraction(mouseEvent);
      });

      expect(result.current.tapCount).toBe(0);
      expect(onTripleTap).not.toHaveBeenCalled();
    });

    it('should respect custom targetArea option', () => {
      const onTripleTap = vi.fn();
      // Smaller target area (10% instead of default 20%)
      const { result } = renderHook(() => useTripleTap(onTripleTap, { targetArea: 0.1 }));

      // This would be in center with default 20%, but not with 10%
      const mouseEvent = new MouseEvent('click', {
        clientX: 600, // 100px from center (500)
        clientY: 400,
        bubbles: true,
      }) as unknown as React.MouseEvent;

      act(() => {
        result.current.onInteraction(mouseEvent);
      });

      expect(result.current.tapCount).toBe(0);
    });
  });

  describe('Triple Tap Detection', () => {
    it('should trigger callback on third tap in center', () => {
      const onTripleTap = vi.fn();
      const { result } = renderHook(() => useTripleTap(onTripleTap));

      const createCenterTap = () =>
        new MouseEvent('click', {
          clientX: 500,
          clientY: 400,
          bubbles: true,
        }) as unknown as React.MouseEvent;

      // First tap
      act(() => {
        result.current.onInteraction(createCenterTap());
      });
      expect(result.current.tapCount).toBe(1);
      expect(onTripleTap).not.toHaveBeenCalled();

      // Second tap
      act(() => {
        result.current.onInteraction(createCenterTap());
      });
      expect(result.current.tapCount).toBe(2);
      expect(onTripleTap).not.toHaveBeenCalled();

      // Third tap - should trigger
      act(() => {
        result.current.onInteraction(createCenterTap());
      });

      // After triggering, count should reset to 0
      act(() => {
        vi.runAllTimers();
      });

      expect(onTripleTap).toHaveBeenCalledTimes(1);
      expect(result.current.tapCount).toBe(0);
    });

    it('should reset count if timeout expires', () => {
      const onTripleTap = vi.fn();
      const { result } = renderHook(() => useTripleTap(onTripleTap, { timeout: 500 }));

      const createCenterTap = () =>
        new MouseEvent('click', {
          clientX: 500,
          clientY: 400,
          bubbles: true,
        }) as unknown as React.MouseEvent;

      // First tap
      act(() => {
        result.current.onInteraction(createCenterTap());
      });
      expect(result.current.tapCount).toBe(1);

      // Wait longer than timeout
      act(() => {
        vi.advanceTimersByTime(600);
      });

      expect(result.current.tapCount).toBe(0);
      expect(onTripleTap).not.toHaveBeenCalled();
    });

    it('should restart sequence if taps are too far apart', () => {
      const onTripleTap = vi.fn();
      const { result } = renderHook(() => useTripleTap(onTripleTap, { timeout: 500 }));

      const createCenterTap = () =>
        new MouseEvent('click', {
          clientX: 500,
          clientY: 400,
          bubbles: true,
        }) as unknown as React.MouseEvent;

      // First tap
      act(() => {
        result.current.onInteraction(createCenterTap());
        vi.advanceTimersByTime(100);
      });
      expect(result.current.tapCount).toBe(1);

      // Second tap - within timeout
      act(() => {
        result.current.onInteraction(createCenterTap());
        vi.advanceTimersByTime(600); // Wait too long
      });

      // Third tap - too late, should restart
      act(() => {
        result.current.onInteraction(createCenterTap());
      });

      expect(result.current.tapCount).toBe(1); // Restarted sequence
      expect(onTripleTap).not.toHaveBeenCalled();
    });
  });

  describe('Touch Events', () => {
    it('should handle touch events', () => {
      const onTripleTap = vi.fn();
      const { result } = renderHook(() => useTripleTap(onTripleTap));

      const touchEvent = {
        type: 'touchend',
        changedTouches: [{ clientX: 500, clientY: 400 }],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.onInteraction(touchEvent);
      });

      expect(result.current.tapCount).toBe(1);
    });

    it('should trigger on triple touch', () => {
      const onTripleTap = vi.fn();
      const { result } = renderHook(() => useTripleTap(onTripleTap));

      const createCenterTouch = () =>
        ({
          type: 'touchend',
          changedTouches: [{ clientX: 500, clientY: 400 }],
        }) as unknown as React.TouchEvent;

      // Three touches
      act(() => {
        result.current.onInteraction(createCenterTouch());
        result.current.onInteraction(createCenterTouch());
        result.current.onInteraction(createCenterTouch());
        vi.runAllTimers();
      });

      expect(onTripleTap).toHaveBeenCalledTimes(1);
      expect(result.current.tapCount).toBe(0);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset tap count manually', () => {
      const onTripleTap = vi.fn();
      const { result } = renderHook(() => useTripleTap(onTripleTap));

      const mouseEvent = new MouseEvent('click', {
        clientX: 500,
        clientY: 400,
        bubbles: true,
      }) as unknown as React.MouseEvent;

      // Two taps
      act(() => {
        result.current.onInteraction(mouseEvent);
        result.current.onInteraction(mouseEvent);
      });
      expect(result.current.tapCount).toBe(2);

      // Manual reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.tapCount).toBe(0);
      expect(onTripleTap).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing touch coordinates', () => {
      const onTripleTap = vi.fn();
      const { result } = renderHook(() => useTripleTap(onTripleTap));

      const touchEvent = {
        type: 'touchend',
        changedTouches: [],
      } as unknown as React.TouchEvent;

      act(() => {
        result.current.onInteraction(touchEvent);
      });

      expect(result.current.tapCount).toBe(0);
      expect(onTripleTap).not.toHaveBeenCalled();
    });

    it('should handle viewport boundaries', () => {
      const onTripleTap = vi.fn();
      const { result } = renderHook(() => useTripleTap(onTripleTap));

      // Tap at exact center
      const centerEvent = new MouseEvent('click', {
        clientX: 500,
        clientY: 400,
        bubbles: true,
      }) as unknown as React.MouseEvent;

      act(() => {
        result.current.onInteraction(centerEvent);
      });

      expect(result.current.tapCount).toBe(1);

      // Tap at edge of target area
      // With default targetArea of 0.2:
      // Width area = 1000 * 0.2 = 200, so +/- 100 from center (500)
      // Height area = 800 * 0.2 = 160, so +/- 80 from center (400)
      const edgeEvent = new MouseEvent('click', {
        clientX: 599, // Just inside (500 + 99)
        clientY: 479, // Just inside (400 + 79)
        bubbles: true,
      }) as unknown as React.MouseEvent;

      act(() => {
        result.current.onInteraction(edgeEvent);
      });

      expect(result.current.tapCount).toBe(2);
    });
  });
});
