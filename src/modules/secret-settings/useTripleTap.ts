/**
 * Secret Settings Module - Triple Tap Detection Hook
 *
 * Detects triple-tap/click gestures in the center of the screen
 * to activate the hidden settings menu.
 */

import { useEffect, useRef, useCallback } from 'react';
import type { UseTripleTapOptions } from './types';

/**
 * Hook for detecting rapid triple-tap/click gestures
 *
 * Monitors tap/click events and triggers callback when three
 * rapid taps/clicks occur in the center region of the screen.
 *
 * **Timing Requirement**: All three taps must occur within the
 * specified timeout (default 500ms) from the FIRST tap.
 *
 * @param options - Configuration options
 * @returns void
 *
 * @example
 * ```tsx
 * // Valid sequence (within 500ms):
 * // Tap 1 (t=0), Tap 2 (t=200ms), Tap 3 (t=400ms) ✅
 *
 * // Invalid sequence (exceeds 500ms):
 * // Tap 1 (t=0), Tap 2 (t=300ms), Tap 3 (t=600ms) ❌
 *
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
  const firstTapTimeRef = useRef<number | null>(null);

  // Reset tap count after timeout
  const resetTapCount = useCallback(() => {
    tapCountRef.current = 0;
    firstTapTimeRef.current = null;
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

      // Check if this tap is within the timeout window (prevents race condition)
      const now = Date.now();
      if (firstTapTimeRef.current !== null && now - firstTapTimeRef.current >= tapTimeout) {
        // Timeout has expired, reset and treat this as a new first tap
        resetTapCount();
      }

      // Increment tap count
      tapCountRef.current += 1;

      // On FIRST tap only, start the timeout and record timestamp
      // (Do NOT reset timeout on subsequent taps)
      if (tapCountRef.current === 1) {
        firstTapTimeRef.current = now;
        timeoutRef.current = setTimeout(() => {
          resetTapCount();
        }, tapTimeout);
      }

      // Check if triple tap detected
      if (tapCountRef.current >= 3) {
        onTripleTap();
        resetTapCount();
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
