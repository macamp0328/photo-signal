import { useRef, useCallback, useState } from 'react';
import type { UseTripleTapReturn, TripleTapOptions } from './types';

/**
 * useTripleTap Hook
 *
 * Detects triple tap/click in the center area of the screen.
 * Works across both desktop (click) and mobile (touch) platforms.
 *
 * @param onTripleTap - Callback function to execute when triple tap is detected
 * @param options - Configuration options for detection behavior
 * @returns Event handlers and state
 *
 * @example
 * ```tsx
 * const { onInteraction } = useTripleTap(() => {
 *   console.log('Secret menu activated!');
 * });
 *
 * return <div onClick={onInteraction} onTouchEnd={onInteraction}>...</div>;
 * ```
 */
export function useTripleTap(
  onTripleTap: () => void,
  options: TripleTapOptions = {}
): UseTripleTapReturn {
  const { timeout = 500, targetArea = 0.2 } = options;

  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef<number | null>(null);
  const lastTapTimeRef = useRef<number>(0);

  /**
   * Check if the tap/click occurred in the center area of the viewport
   */
  const isInCenterArea = useCallback(
    (clientX: number, clientY: number): boolean => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const centerX = viewportWidth / 2;
      const centerY = viewportHeight / 2;

      const areaWidth = viewportWidth * targetArea;
      const areaHeight = viewportHeight * targetArea;

      const inXRange = Math.abs(clientX - centerX) <= areaWidth / 2;
      const inYRange = Math.abs(clientY - centerY) <= areaHeight / 2;

      return inXRange && inYRange;
    },
    [targetArea]
  );

  /**
   * Reset the tap counter
   */
  const reset = useCallback(() => {
    setTapCount(0);
    lastTapTimeRef.current = 0;
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
    }
  }, []);

  /**
   * Handle interaction (click or touch)
   */
  const onInteraction = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      const currentTime = Date.now();

      // Get coordinates from either mouse or touch event
      let clientX: number;
      let clientY: number;

      if ('changedTouches' in event && event.changedTouches.length > 0) {
        // Touch event - use changedTouches for touchend
        const touch = event.changedTouches[0];
        clientX = touch.clientX;
        clientY = touch.clientY;
      } else if ('clientX' in event) {
        // Mouse event
        clientX = event.clientX;
        clientY = event.clientY;
      } else {
        return;
      }

      // Check if tap/click is in center area
      if (!isInCenterArea(clientX, clientY)) {
        return;
      }

      // Check if this tap is within the timeout window
      const timeSinceLastTap = currentTime - lastTapTimeRef.current;
      if (timeSinceLastTap > timeout) {
        // Too much time passed, restart the sequence
        setTapCount(1);
      } else {
        // Increment tap count
        setTapCount((prev) => {
          const newCount = prev + 1;
          if (newCount === 3) {
            // Triple tap detected!
            onTripleTap();
            // Reset after triggering
            setTimeout(reset, 0);
            return 0;
          }
          return newCount;
        });
      }

      lastTapTimeRef.current = currentTime;

      // Clear any existing timeout
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }

      // Set new timeout to reset if no more taps
      tapTimeoutRef.current = window.setTimeout(() => {
        reset();
      }, timeout);
    },
    [onTripleTap, timeout, isInCenterArea, reset]
  );

  return {
    onInteraction,
    tapCount,
    reset,
  };
}
