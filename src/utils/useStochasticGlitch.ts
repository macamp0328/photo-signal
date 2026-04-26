/**
 * useStochasticGlitch
 *
 * Poisson-style timer that occasionally fires a brief CRT chromatic aberration
 * glitch (~once every 5 minutes on average). When triggered, applies the
 * `chromaticShift` keyframe animation to `<html>` via inline style, creating
 * a full-screen box-shadow spike with offset red/blue RGB fringing at the
 * viewport edges.
 *
 * Activation: only when `enabled` is true (gated by `stochastic-glitch` flag).
 * The animation clears itself via `animationend`. The handler is stored so it
 * can be explicitly removed during cleanup, preventing listener leaks if the
 * hook is disabled or unmounted while an animation is mid-flight.
 */

import { useEffect } from 'react';

/** ~0.3% per second → average glitch interval of ~333 s (~5.5 minutes). */
const GLITCH_PROBABILITY_PER_SECOND = 0.003;
const TICK_INTERVAL_MS = 1000;
const GLITCH_ANIMATION = 'chromaticShift 0.3s ease-in-out';

export function useStochasticGlitch(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    let animationEndHandler: (() => void) | null = null;

    const tick = () => {
      if (Math.random() >= GLITCH_PROBABILITY_PER_SECOND) return;

      const root = document.documentElement;
      // Don't double-fire while a glitch animation is already running.
      if (root.style.animation) return;

      animationEndHandler = () => {
        root.style.animation = '';
        animationEndHandler = null;
      };

      root.style.animation = GLITCH_ANIMATION;
      root.addEventListener('animationend', animationEndHandler, { once: true });
    };

    const intervalId = setInterval(tick, TICK_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      if (animationEndHandler !== null) {
        document.documentElement.removeEventListener('animationend', animationEndHandler);
        animationEndHandler = null;
      }
      document.documentElement.style.animation = '';
    };
  }, [enabled]);
}
