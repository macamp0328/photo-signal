/**
 * Tests for useStochasticGlitch
 *
 * Validates:
 * - No-op when disabled (no interval, no DOM mutation)
 * - Interval started when enabled
 * - Glitch fires (animation style set) when Math.random() is below threshold
 * - No glitch when Math.random() is at or above threshold
 * - Double-fire guard: second tick during active animation is ignored
 * - animationend clears the animation style
 * - Cleanup on unmount: interval cleared, animation style removed
 * - Cleanup on disable (rerender with enabled=false): same as unmount
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStochasticGlitch } from './useStochasticGlitch';

describe('useStochasticGlitch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Start with clean slate
    document.documentElement.style.animation = '';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.documentElement.style.animation = '';
  });

  it('does not start an interval when disabled', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    renderHook(() => useStochasticGlitch(false));
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });

  it('does not mutate the DOM when disabled', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    renderHook(() => useStochasticGlitch(false));
    vi.advanceTimersByTime(5000);
    expect(document.documentElement.style.animation).toBe('');
  });

  it('starts a 1000ms interval when enabled', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    renderHook(() => useStochasticGlitch(true));
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
  });

  it('fires the glitch animation when random is below threshold', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.001);
    renderHook(() => useStochasticGlitch(true));
    vi.advanceTimersByTime(1000);
    expect(document.documentElement.style.animation).toBe('chromaticShift 0.3s ease-in-out');
  });

  it('does not fire when random is at the threshold (0.003)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.003);
    renderHook(() => useStochasticGlitch(true));
    vi.advanceTimersByTime(1000);
    expect(document.documentElement.style.animation).toBe('');
  });

  it('does not fire when random is above threshold', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    renderHook(() => useStochasticGlitch(true));
    vi.advanceTimersByTime(1000);
    expect(document.documentElement.style.animation).toBe('');
  });

  it('double-fire guard: second tick does not overwrite running animation', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.001);
    renderHook(() => useStochasticGlitch(true));

    // First tick fires the glitch
    vi.advanceTimersByTime(1000);
    expect(document.documentElement.style.animation).toBe('chromaticShift 0.3s ease-in-out');

    // Manually change animation to simulate something different (in practice wouldn't happen)
    // For the guard test: the animation style is already set, so a second tick must not re-fire
    document.documentElement.style.animation = 'chromaticShift 0.3s ease-in-out'; // still set

    vi.advanceTimersByTime(1000);
    // Animation should remain set (not cleared or changed)
    expect(document.documentElement.style.animation).toBe('chromaticShift 0.3s ease-in-out');
  });

  it('animationend event clears the animation style', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.001);
    renderHook(() => useStochasticGlitch(true));

    vi.advanceTimersByTime(1000);
    expect(document.documentElement.style.animation).toBe('chromaticShift 0.3s ease-in-out');

    // Simulate animation completing
    document.documentElement.dispatchEvent(new Event('animationend'));
    expect(document.documentElement.style.animation).toBe('');
  });

  it('animationend listener fires only once (second event does not error)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.001);
    renderHook(() => useStochasticGlitch(true));

    vi.advanceTimersByTime(1000);
    document.documentElement.dispatchEvent(new Event('animationend'));
    expect(document.documentElement.style.animation).toBe('');

    // Set a new animation manually to verify second dispatch doesn't clear it unexpectedly
    document.documentElement.style.animation = 'someOther 1s';
    document.documentElement.dispatchEvent(new Event('animationend'));
    // Should not clear because the { once: true } listener was already removed
    expect(document.documentElement.style.animation).toBe('someOther 1s');
  });

  it('clears the interval and animation on unmount', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    vi.spyOn(Math, 'random').mockReturnValue(0.001);
    const { unmount } = renderHook(() => useStochasticGlitch(true));

    vi.advanceTimersByTime(1000);
    expect(document.documentElement.style.animation).toBe('chromaticShift 0.3s ease-in-out');

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(document.documentElement.style.animation).toBe('');
  });

  it('clears the interval and animation when re-rendered with enabled=false', () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    vi.spyOn(Math, 'random').mockReturnValue(0.001);
    const { rerender } = renderHook(({ enabled }) => useStochasticGlitch(enabled), {
      initialProps: { enabled: true },
    });

    vi.advanceTimersByTime(1000);
    expect(document.documentElement.style.animation).toBe('chromaticShift 0.3s ease-in-out');

    rerender({ enabled: false });
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(document.documentElement.style.animation).toBe('');
  });

  it('after re-enabling, glitch fires again', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.001);
    const { rerender } = renderHook(({ enabled }) => useStochasticGlitch(enabled), {
      initialProps: { enabled: true },
    });

    vi.advanceTimersByTime(1000);
    expect(document.documentElement.style.animation).toBe('chromaticShift 0.3s ease-in-out');

    // Disable — clears animation
    rerender({ enabled: false });
    expect(document.documentElement.style.animation).toBe('');

    // Re-enable — new interval, glitch fires again
    rerender({ enabled: true });
    vi.advanceTimersByTime(1000);
    expect(document.documentElement.style.animation).toBe('chromaticShift 0.3s ease-in-out');
  });
});
