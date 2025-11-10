import { useState, useEffect, useCallback, useRef } from 'react';
import type { TripleTapConfig, TripleTapHook } from './types';

/**
 * Hook to detect triple tap/click on an element
 *
 * Supports both mouse clicks (desktop) and touch taps (mobile).
 * Can detect taps in the center of the screen or anywhere.
 *
 * @param elementRef - Ref to the element to attach listeners to
 * @param config - Configuration for triple tap detection
 * @returns Object with isTripleTap flag and reset function
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { isTripleTap, reset } = useTripleTap(containerRef, {
 *   maxDelay: 500,
 *   targetArea: 'center',
 *   centerThreshold: 0.3
 * });
 *
 * useEffect(() => {
 *   if (isTripleTap) {
 *     console.log('Triple tap detected!');
 *     reset();
 *   }
 * }, [isTripleTap, reset]);
 * ```
 */
export function useTripleTap(
  elementRef: React.RefObject<HTMLElement | null>,
  config: TripleTapConfig = {}
): TripleTapHook {
  const {
    maxDelay = 500,
    targetArea = 'center',
    centerThreshold = 0.3,
  } = config;

  const [isTripleTap, setIsTripleTap] = useState(false);
  const tapTimesRef = useRef<number[]>([]);
  const tapCountRef = useRef(0);

  /**
   * Check if a tap/click occurred in the center of the element
   */
  const isInCenter = useCallback(
    (event: MouseEvent | TouchEvent, element: HTMLElement): boolean => {
      if (targetArea === 'anywhere') {
        return true;
      }

      const rect = element.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const threshold = centerThreshold;

      let clientX: number;
      let clientY: number;

      if ('touches' in event) {
        // Touch event
        if (event.touches.length === 0) {
          return false;
        }
        clientX = event.touches[0].clientX - rect.left;
        clientY = event.touches[0].clientY - rect.top;
      } else {
        // Mouse event
        clientX = event.clientX - rect.left;
        clientY = event.clientY - rect.top;
      }

      const distanceX = Math.abs(clientX - centerX);
      const distanceY = Math.abs(clientY - centerY);

      return (
        distanceX < rect.width * threshold &&
        distanceY < rect.height * threshold
      );
    },
    [targetArea, centerThreshold]
  );

  /**
   * Handle tap/click event
   */
  const handleTap = useCallback(
    (event: MouseEvent | TouchEvent) => {
      const element = elementRef.current;
      if (!element) {
        return;
      }

      // Check if tap is in the target area
      if (!isInCenter(event, element)) {
        return;
      }

      const now = Date.now();
      tapTimesRef.current.push(now);

      // Keep only recent taps within maxDelay window
      tapTimesRef.current = tapTimesRef.current.filter(
        (time) => now - time < maxDelay
      );

      tapCountRef.current = tapTimesRef.current.length;

      // Check if we have triple tap
      if (tapCountRef.current >= 3) {
        setIsTripleTap(true);
        tapTimesRef.current = [];
        tapCountRef.current = 0;
      }
    },
    [elementRef, isInCenter, maxDelay]
  );

  /**
   * Reset the triple tap state
   */
  const reset = useCallback(() => {
    setIsTripleTap(false);
    tapTimesRef.current = [];
    tapCountRef.current = 0;
  }, []);

  // Attach event listeners
  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }

    // Add both click (mouse) and touchstart (touch) listeners
    element.addEventListener('click', handleTap as EventListener);
    element.addEventListener('touchstart', handleTap as EventListener);

    return () => {
      element.removeEventListener('click', handleTap as EventListener);
      element.removeEventListener('touchstart', handleTap as EventListener);
    };
  }, [elementRef, handleTap]);

  return {
    isTripleTap,
    reset,
  };
}
