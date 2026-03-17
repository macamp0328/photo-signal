/**
 * Tests for useAudioReactiveGlow
 *
 * Validates:
 * - No-op when isActive or isEnabled is false
 * - AnalyserNode created and rAF loop started when both are true
 * - CSS var set during active state
 * - Teardown: rAF cancelled, CSS var removed, analyser disconnected
 * - No-op when Howler.ctx is unavailable or suspended
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioReactiveGlow } from './useAudioReactiveGlow';

// ── Mock AnalyserNode ──────────────────────────────────────────────────────────

class MockAnalyserNode {
  fftSize = 256;
  smoothingTimeConstant = 0;
  frequencyBinCount = 128;
  getByteFrequencyData = vi.fn((array: Uint8Array) => {
    // Simulate 50% bass energy for deterministic assertions
    array.fill(128);
  });
  connect = vi.fn();
  disconnect = vi.fn();
}

// ── Mock AudioContext ──────────────────────────────────────────────────────────

class MockAudioContext {
  state: AudioContextState = 'running';
  sampleRate = 44100;
  createAnalyser = vi.fn(() => new MockAnalyserNode());
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}

// ── Mock GainNode ──────────────────────────────────────────────────────────────

class MockGainNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

// ── Howler module mock ─────────────────────────────────────────────────────────

let mockCtx: MockAudioContext | null = new MockAudioContext();
let mockMasterGain: MockGainNode | null = new MockGainNode();

vi.mock('howler', () => ({
  Howler: {
    get ctx() {
      return mockCtx;
    },
    get masterGain() {
      return mockMasterGain;
    },
  },
  Howl: vi.fn(),
}));

// ── rAF / cAF stubs ────────────────────────────────────────────────────────────

let rafCallbacks: Map<number, FrameRequestCallback>;
let rafCounter: number;

beforeEach(() => {
  rafCallbacks = new Map();
  rafCounter = 1;

  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    const id = rafCounter++;
    rafCallbacks.set(id, cb);
    return id;
  });

  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    rafCallbacks.delete(id);
  });

  // Reset mocks between tests
  mockCtx = new MockAudioContext();
  mockMasterGain = new MockGainNode();
});

afterEach(() => {
  vi.restoreAllMocks();
  // Clear any leftover CSS var
  document.documentElement.style.removeProperty('--glow-reactive-scale');
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function flushRaf() {
  // Run one tick of any pending rAF callbacks
  const entries = Array.from(rafCallbacks.entries());
  for (const [id, cb] of entries) {
    rafCallbacks.delete(id);
    cb(performance.now());
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useAudioReactiveGlow', () => {
  it('does nothing when isActive is false', () => {
    renderHook(() => useAudioReactiveGlow(false, true));

    expect(mockCtx!.createAnalyser).not.toHaveBeenCalled();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue('--glow-reactive-scale')).toBe('');
  });

  it('does nothing when isEnabled is false', () => {
    renderHook(() => useAudioReactiveGlow(true, false));

    expect(mockCtx!.createAnalyser).not.toHaveBeenCalled();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('does nothing when Howler.ctx is null', () => {
    mockCtx = null;
    renderHook(() => useAudioReactiveGlow(true, true));

    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('waits for statechange when Howler.ctx is suspended, then activates', () => {
    mockCtx!.state = 'suspended';
    const listeners = new Map<string, EventListenerOrEventListenerObject>();
    mockCtx!.addEventListener = vi.fn((type, listener) => {
      listeners.set(type, listener as EventListenerOrEventListenerObject);
    });
    mockCtx!.removeEventListener = vi.fn();

    renderHook(() => useAudioReactiveGlow(true, true));

    // Not yet active — waiting for statechange
    expect(mockCtx!.createAnalyser).not.toHaveBeenCalled();
    expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    expect(mockCtx!.addEventListener).toHaveBeenCalledWith('statechange', expect.any(Function));

    // Simulate AudioContext resuming
    act(() => {
      mockCtx!.state = 'running';
      const handler = listeners.get('statechange') as EventListener;
      handler(new Event('statechange'));
    });

    expect(mockCtx!.createAnalyser).toHaveBeenCalledOnce();
    expect(window.requestAnimationFrame).toHaveBeenCalledOnce();
  });

  it('creates AnalyserNode and starts rAF when active and enabled', () => {
    renderHook(() => useAudioReactiveGlow(true, true));

    expect(mockCtx!.createAnalyser).toHaveBeenCalled();
    expect(mockMasterGain!.connect).toHaveBeenCalled();
    expect(window.requestAnimationFrame).toHaveBeenCalled();
  });

  it('configures AnalyserNode with correct settings', () => {
    const { result } = renderHook(() => useAudioReactiveGlow(true, true));

    // Access the analyser that was created
    const analyser = mockCtx!.createAnalyser.mock.results[0]?.value as MockAnalyserNode;
    expect(analyser.fftSize).toBe(256);
    expect(analyser.smoothingTimeConstant).toBe(0.85);

    // Satisfy linter — result is void hook
    expect(result.current).toBeUndefined();
  });

  it('sets --glow-reactive-scale on each rAF tick', () => {
    renderHook(() => useAudioReactiveGlow(true, true));

    act(() => {
      flushRaf(); // first tick
    });

    const val = document.documentElement.style.getPropertyValue('--glow-reactive-scale');
    expect(val).not.toBe('');
    const parsed = parseFloat(val);
    expect(parsed).toBeGreaterThanOrEqual(0.85);
    expect(parsed).toBeLessThanOrEqual(1.2);
  });

  it('re-schedules rAF on each tick to create a loop', () => {
    renderHook(() => useAudioReactiveGlow(true, true));

    const callsBefore = (window.requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls
      .length;
    act(() => {
      flushRaf();
    });
    const callsAfter = (window.requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls.length;

    expect(callsAfter).toBeGreaterThan(callsBefore);
  });

  it('cancels rAF and removes CSS var when deactivated', () => {
    const { rerender } = renderHook(
      ({ active, enabled }: { active: boolean; enabled: boolean }) =>
        useAudioReactiveGlow(active, enabled),
      { initialProps: { active: true, enabled: true } }
    );

    act(() => flushRaf());

    const varAfterActive = document.documentElement.style.getPropertyValue('--glow-reactive-scale');
    expect(varAfterActive).not.toBe('');

    act(() => {
      rerender({ active: false, enabled: true });
    });

    expect(rafCallbacks.size).toBe(0);
    expect(document.documentElement.style.getPropertyValue('--glow-reactive-scale')).toBe('');
  });

  it('disconnects AnalyserNode when deactivated', () => {
    const { rerender } = renderHook(
      ({ active, enabled }: { active: boolean; enabled: boolean }) =>
        useAudioReactiveGlow(active, enabled),
      { initialProps: { active: true, enabled: true } }
    );

    const analyser = mockCtx!.createAnalyser.mock.results[0]?.value as MockAnalyserNode;

    act(() => {
      rerender({ active: false, enabled: true });
    });

    expect(mockMasterGain!.disconnect).toHaveBeenCalledWith(analyser);
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() => useAudioReactiveGlow(true, true));

    act(() => flushRaf());

    unmount();

    expect(rafCallbacks.size).toBe(0);
    expect(document.documentElement.style.getPropertyValue('--glow-reactive-scale')).toBe('');
  });

  it('does not create multiple AnalyserNodes on re-render with same props', () => {
    const { rerender } = renderHook(
      ({ active, enabled }: { active: boolean; enabled: boolean }) =>
        useAudioReactiveGlow(active, enabled),
      { initialProps: { active: true, enabled: true } }
    );

    rerender({ active: true, enabled: true });

    expect(mockCtx!.createAnalyser).toHaveBeenCalledOnce();
  });

  it('does not activate when statechange fires after unmount (race guard)', () => {
    mockCtx!.state = 'suspended';
    let capturedHandler: EventListener | null = null;
    mockCtx!.addEventListener = vi.fn((type, listener) => {
      if (type === 'statechange') capturedHandler = listener as EventListener;
    });
    mockCtx!.removeEventListener = vi.fn();

    const { unmount } = renderHook(() => useAudioReactiveGlow(true, true));

    // Confirm listener registered, nothing activated yet
    expect(capturedHandler).not.toBeNull();
    expect(mockCtx!.createAnalyser).not.toHaveBeenCalled();

    // Unmount — cleanup sets mounted=false and removes listener
    unmount();

    // Simulate late statechange arriving after cleanup (e.g., already queued)
    act(() => {
      mockCtx!.state = 'running';
      capturedHandler!(new Event('statechange'));
    });

    // The guard must prevent activate() from running — no analyser created
    expect(mockCtx!.createAnalyser).not.toHaveBeenCalled();
  });

  it('cancels rAF and removes CSS var when isEnabled is toggled off mid-session', () => {
    const { rerender } = renderHook(
      ({ active, enabled }: { active: boolean; enabled: boolean }) =>
        useAudioReactiveGlow(active, enabled),
      { initialProps: { active: true, enabled: true } }
    );

    // Run a tick so the CSS var gets set
    act(() => flushRaf());

    const varAfterActive = document.documentElement.style.getPropertyValue('--glow-reactive-scale');
    expect(varAfterActive).not.toBe('');

    // Disable the feature flag while the hook remains active
    act(() => {
      rerender({ active: true, enabled: false });
    });

    expect(rafCallbacks.size).toBe(0);
    expect(document.documentElement.style.getPropertyValue('--glow-reactive-scale')).toBe('');
  });
});
