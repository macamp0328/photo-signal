import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTripleTap } from './useTripleTap';

describe('useTripleTap', () => {
  let element: HTMLDivElement;

  beforeEach(() => {
    element = document.createElement('div');
    element.style.width = '1000px';
    element.style.height = '1000px';
    document.body.appendChild(element);

    // Mock getBoundingClientRect for consistent testing
    element.getBoundingClientRect = vi.fn().mockReturnValue({
      width: 1000,
      height: 1000,
      top: 0,
      left: 0,
      bottom: 1000,
      right: 1000,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
  });

  afterEach(() => {
    document.body.removeChild(element);
  });

  describe('Triple Tap Detection', () => {
    it('should detect triple tap with clicks', () => {
      const ref = { current: element };
      const { result } = renderHook(() => useTripleTap(ref, { targetArea: 'anywhere' }));

      expect(result.current.isTripleTap).toBe(false);

      // Simulate three clicks
      act(() => {
        element.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            clientX: 500,
            clientY: 500,
          })
        );
      });

      act(() => {
        element.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            clientX: 500,
            clientY: 500,
          })
        );
      });

      act(() => {
        element.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            clientX: 500,
            clientY: 500,
          })
        );
      });

      expect(result.current.isTripleTap).toBe(true);
    });

    it('should detect triple tap with touch events', () => {
      const ref = { current: element };
      const { result } = renderHook(() => useTripleTap(ref, { targetArea: 'anywhere' }));

      expect(result.current.isTripleTap).toBe(false);

      // Simulate three touch taps
      for (let i = 0; i < 3; i++) {
        act(() => {
          const touch = new Touch({
            identifier: i,
            target: element,
            clientX: 500,
            clientY: 500,
          });

          element.dispatchEvent(
            new TouchEvent('touchstart', {
              bubbles: true,
              touches: [touch],
            })
          );
        });
      }

      expect(result.current.isTripleTap).toBe(true);
    });

    it('should reset triple tap state', () => {
      const ref = { current: element };
      const { result } = renderHook(() => useTripleTap(ref, { targetArea: 'anywhere' }));

      // Trigger triple tap
      act(() => {
        for (let i = 0; i < 3; i++) {
          element.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              clientX: 500,
              clientY: 500,
            })
          );
        }
      });

      expect(result.current.isTripleTap).toBe(true);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.isTripleTap).toBe(false);
    });

    it('should not detect triple tap if taps are too slow', async () => {
      const ref = { current: element };
      const { result } = renderHook(() =>
        useTripleTap(ref, { targetArea: 'anywhere', maxDelay: 100 })
      );

      // First tap
      act(() => {
        element.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            clientX: 500,
            clientY: 500,
          })
        );
      });

      // Wait longer than maxDelay
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Second and third taps
      act(() => {
        element.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            clientX: 500,
            clientY: 500,
          })
        );
        element.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            clientX: 500,
            clientY: 500,
          })
        );
      });

      // Should not be triple tap because first tap was too long ago
      expect(result.current.isTripleTap).toBe(false);
    });
  });

  describe('Center Detection', () => {
    it('should detect taps in center area', () => {
      const ref = { current: element };
      const { result } = renderHook(() =>
        useTripleTap(ref, { targetArea: 'center', centerThreshold: 0.3 })
      );

      // Tap in center (500, 500 is center of 1000x1000 element)
      act(() => {
        for (let i = 0; i < 3; i++) {
          element.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              clientX: 500,
              clientY: 500,
            })
          );
        }
      });

      expect(result.current.isTripleTap).toBe(true);
    });

    it('should not detect taps outside center area', () => {
      const ref = { current: element };
      const { result } = renderHook(() =>
        useTripleTap(ref, { targetArea: 'center', centerThreshold: 0.2 })
      );

      // Tap in corner (far from center)
      act(() => {
        for (let i = 0; i < 3; i++) {
          element.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              clientX: 100,
              clientY: 100,
            })
          );
        }
      });

      expect(result.current.isTripleTap).toBe(false);
    });

    it('should detect taps anywhere when targetArea is "anywhere"', () => {
      const ref = { current: element };
      const { result } = renderHook(() => useTripleTap(ref, { targetArea: 'anywhere' }));

      // Tap in corner
      act(() => {
        for (let i = 0; i < 3; i++) {
          element.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              clientX: 50,
              clientY: 50,
            })
          );
        }
      });

      expect(result.current.isTripleTap).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should not crash if element ref is null', () => {
      const ref = { current: null };
      const { result } = renderHook(() => useTripleTap(ref));

      expect(result.current.isTripleTap).toBe(false);
    });

    it('should handle rapid taps correctly', () => {
      const ref = { current: element };
      const { result } = renderHook(() => useTripleTap(ref, { targetArea: 'anywhere' }));

      // Rapid fire 5 clicks
      act(() => {
        for (let i = 0; i < 5; i++) {
          element.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              clientX: 500,
              clientY: 500,
            })
          );
        }
      });

      // Should still detect triple tap
      expect(result.current.isTripleTap).toBe(true);
    });

    it('should reset tap count after successful triple tap', () => {
      const ref = { current: element };
      const { result } = renderHook(() => useTripleTap(ref, { targetArea: 'anywhere' }));

      // First triple tap
      act(() => {
        for (let i = 0; i < 3; i++) {
          element.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              clientX: 500,
              clientY: 500,
            })
          );
        }
      });

      expect(result.current.isTripleTap).toBe(true);

      // Reset
      act(() => {
        result.current.reset();
      });

      // Second triple tap should work
      act(() => {
        for (let i = 0; i < 3; i++) {
          element.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              clientX: 500,
              clientY: 500,
            })
          );
        }
      });

      expect(result.current.isTripleTap).toBe(true);
    });
  });
});
