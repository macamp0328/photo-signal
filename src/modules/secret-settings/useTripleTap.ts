/**
 * Secret Settings Module - Triple Tap Detection Hook
 *
 * Detects triple-tap/click gestures in the center of the screen
 * to activate the hidden settings menu.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { UseTripleTapOptions } from './types';

/**
 * Hook for detecting triple-tap/click gestures
 *
 * Monitors tap/click events and triggers callback when three
 * rapid taps/clicks occur in the center region of the screen.
 *
 * @param options - Configuration options
 * @returns void
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   useTripleTap({
 *     tapTimeout: 500,
 *     onTripleTap: () => console.log('Triple tap detected!')
 *   });
 *   // ...
 * }
 * ```
 */
export function useTripleTap({ tapTimeout = 500, onTripleTap }: UseTripleTapOptions): void {
  const tapCountRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset tap count after timeout
  const resetTapCount = useCallback(() => {
    tapCountRef.current = 0;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Handle tap/click events
  const handleTap = useCallback(
    (event: MouseEvent | TouchEvent) => {
      // Get tap/click position
      let x: number, y: number;

      if (event instanceof MouseEvent) {
        x = event.clientX;
        y = event.clientY;
      } else {
        // TouchEvent
        const touch = event.touches[0] || event.changedTouches[0];
        x = touch.clientX;
        y = touch.clientY;
      }

      // Check if tap/click is in the center region (middle third of screen)
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const centerX = viewportWidth / 2;
      const centerY = viewportHeight / 2;

      const centerRegionWidth = viewportWidth / 3;
      const centerRegionHeight = viewportHeight / 3;

      const isInCenterRegion =
        Math.abs(x - centerX) <= centerRegionWidth / 2 &&
        Math.abs(y - centerY) <= centerRegionHeight / 2;

      if (!isInCenterRegion) {
        return;
      }

      // Increment tap count
      tapCountRef.current += 1;

      // Clear previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Check if triple tap detected
      if (tapCountRef.current >= 3) {
        onTripleTap();
        resetTapCount();
      } else {
        // Set timeout to reset count
        timeoutRef.current = setTimeout(() => {
          resetTapCount();
        }, tapTimeout);
      }
    },
    [tapTimeout, onTripleTap, resetTapCount]
  );

  // Set up event listeners
  useEffect(() => {
    // Use both click and touchend for cross-platform support
    window.addEventListener('click', handleTap);
    window.addEventListener('touchend', handleTap);

    return () => {
      window.removeEventListener('click', handleTap);
      window.removeEventListener('touchend', handleTap);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleTap]);
}
