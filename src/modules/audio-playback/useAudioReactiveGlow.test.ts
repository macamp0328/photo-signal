/**
 * Tests for useAudioReactiveGlow
 *
 * Validates:
 * - No-op when isActive or isEnabled is false
 * - AnalyserNode created and rAF loop started when both are true
 * - CSS var set during active state
 * - Teardown: rAF cancelled, CSS vars removed, nodes disconnected
 * - No-op when Howler.ctx is unavailable
 * - HTML5 audio path: createMediaElementSource used when html5 Howl is playing
 * - Web Audio fallback path: masterGain used when no HTML5 element found
 * - Suspended ctx: ctx.resume() called proactively; mounted guard prevents race
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

// ── Mock MediaElementAudioSourceNode ──────────────────────────────────────────

class MockMediaElementSource {
  connect = vi.fn();
  disconnect = vi.fn();
}

// ── Mock AudioContext ──────────────────────────────────────────────────────────

class MockAudioContext {
  state: AudioContextState = 'running';
  sampleRate = 44100;
  destination = {} as AudioDestinationNode;
  createAnalyser = vi.fn(() => new MockAnalyserNode());
  createMediaElementSource = vi.fn(() => new MockMediaElementSource());
  resume = vi.fn().mockImplementation(function (this: MockAudioContext) {
    this.state = 'running';
    return Promise.resolve();
  });
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
}

// ── Mock GainNode ──────────────────────────────────────────────────────────────

class MockGainNode {
  connect = vi.fn();
  disconnect = vi.fn();
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Returns a real HTMLAudioElement so instanceof checks pass in happy-dom. */
function makeAudioElement(): HTMLAudioElement {
  return document.createElement('audio');
}

// ── Howler module mock ─────────────────────────────────────────────────────────

let mockCtx: MockAudioContext | null = new MockAudioContext();
let mockMasterGain: MockGainNode | null = new MockGainNode();
let mockHowls: Array<{
  playing?: () => boolean;
  _webAudio?: boolean;
  _sounds?: Array<{ _node?: unknown }>;
}> = [];

vi.mock('howler', () => ({
  Howler: {
    get ctx() {
      return mockCtx;
    },
    get masterGain() {
      return mockMasterGain;
    },
    get _howls() {
      return mockHowls;
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
  mockHowls = [];
});

afterEach(() => {
  vi.restoreAllMocks();
  // Clear any leftover CSS vars
  document.documentElement.style.removeProperty('--glow-reactive-scale');
  document.documentElement.style.removeProperty('--glow-reactive-scale-ring');
});

// ── Test helpers ───────────────────────────────────────────────────────────────

function flushRaf() {
  // Run one tick of any pending rAF callbacks
  const entries = Array.from(rafCallbacks.entries());
  for (const [id, cb] of entries) {
    rafCallbacks.delete(id);
    cb(performance.now());
  }
}

function makeHtml5Howl(audioElement: HTMLAudioElement) {
  return {
    playing: () => true,
    _webAudio: false,
    _sounds: [{ _node: audioElement }],
  };
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

  it('falls back to Web Audio path when HTML5 howl inspection throws', () => {
    mockHowls = [
      {
        playing: () => true,
        _webAudio: false,
        get _sounds() {
          throw new Error('Howl internals unavailable');
        },
      } as unknown as {
        playing?: () => boolean;
        _webAudio?: boolean;
        _sounds?: Array<{ _node?: unknown }>;
      },
    ];

    renderHook(() => useAudioReactiveGlow(true, true));

    expect(mockCtx!.createMediaElementSource).not.toHaveBeenCalled();
    expect(mockMasterGain!.connect).toHaveBeenCalled();
  });

  // ── Suspended ctx: ctx.resume() ──────────────────────────────────────────────

  it('calls ctx.resume() and activates when Howler.ctx is suspended', async () => {
    mockCtx!.state = 'suspended';

    renderHook(() => useAudioReactiveGlow(true, true));

    // Not yet active — waiting for resume .then() to run
    expect(mockCtx!.createAnalyser).not.toHaveBeenCalled();

    // Flush microtask so the .then() callback runs
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockCtx!.resume).toHaveBeenCalled();
    expect(mockCtx!.createAnalyser).toHaveBeenCalledOnce();
    expect(window.requestAnimationFrame).toHaveBeenCalled();
  });

  it('resumes again if context auto-suspends after activation wiring', async () => {
    mockCtx!.state = 'suspended';

    mockCtx!.resume = vi.fn().mockImplementation(function (this: MockAudioContext) {
      this.state = 'running';
      return Promise.resolve();
    });

    mockCtx!.createAnalyser = vi.fn(() => {
      const analyser = new MockAnalyserNode();
      // Simulate Chrome auto-suspending immediately after source wiring.
      mockCtx!.state = 'suspended';
      return analyser;
    });

    renderHook(() => useAudioReactiveGlow(true, true));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockCtx!.resume).toHaveBeenCalledTimes(2);
  });

  it('does not activate after unmount during suspended ctx.resume() (race guard)', async () => {
    mockCtx!.state = 'suspended';
    let resolveResume!: () => void;
    mockCtx!.resume = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveResume = resolve;
        })
    );

    const { unmount } = renderHook(() => useAudioReactiveGlow(true, true));

    // Unmount before resume resolves
    unmount();

    // Now resolve the resume promise
    await act(async () => {
      resolveResume();
      await Promise.resolve();
    });

    // mounted=false guard prevents doActivate() from running
    expect(mockCtx!.createAnalyser).not.toHaveBeenCalled();
  });

  // ── Web Audio fallback path (no HTML5 howl playing) ──────────────────────────

  it('uses masterGain (Web Audio path) when no HTML5 audio element is playing', () => {
    renderHook(() => useAudioReactiveGlow(true, true));

    expect(mockCtx!.createAnalyser).toHaveBeenCalled();
    expect(mockMasterGain!.connect).toHaveBeenCalled();
    expect(window.requestAnimationFrame).toHaveBeenCalled();
  });

  it('configures AnalyserNode with correct settings', () => {
    const { result } = renderHook(() => useAudioReactiveGlow(true, true));

    const analyser = mockCtx!.createAnalyser.mock.results[0]?.value as MockAnalyserNode;
    expect(analyser.fftSize).toBe(256);
    expect(analyser.smoothingTimeConstant).toBe(0.7);

    // Satisfy linter — result is void hook
    expect(result.current).toBeUndefined();
  });

  it('sets --glow-reactive-scale on each rAF tick within the expanded range', () => {
    renderHook(() => useAudioReactiveGlow(true, true));

    act(() => {
      flushRaf(); // first tick
    });

    const val = document.documentElement.style.getPropertyValue('--glow-reactive-scale');
    expect(val).not.toBe('');
    const parsed = parseFloat(val);
    expect(parsed).toBeGreaterThanOrEqual(0.6);
    expect(parsed).toBeLessThanOrEqual(1.8);
  });

  it('sets --glow-reactive-scale-ring on each rAF tick within the ring range', () => {
    renderHook(() => useAudioReactiveGlow(true, true));

    act(() => {
      flushRaf(); // first tick
    });

    const val = document.documentElement.style.getPropertyValue('--glow-reactive-scale-ring');
    expect(val).not.toBe('');
    const parsed = parseFloat(val);
    expect(parsed).toBeGreaterThanOrEqual(0.4);
    expect(parsed).toBeLessThanOrEqual(2.0);
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

  it('resumes and retries next frame when AudioContext suspends mid-loop', () => {
    renderHook(() => useAudioReactiveGlow(true, true));

    // Simulate mid-session auto-suspend before the first tick runs.
    mockCtx!.state = 'suspended';

    act(() => {
      flushRaf();
    });

    expect(mockCtx!.resume).toHaveBeenCalled();
    expect(rafCallbacks.size).toBeGreaterThan(0);
  });

  it('cancels rAF and removes CSS vars when deactivated', () => {
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
    expect(document.documentElement.style.getPropertyValue('--glow-reactive-scale-ring')).toBe('');
  });

  it('disconnects masterGain from AnalyserNode when deactivated (Web Audio path)', () => {
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
    expect(document.documentElement.style.getPropertyValue('--glow-reactive-scale-ring')).toBe('');
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

  it('cancels rAF and removes CSS vars when isEnabled is toggled off mid-session', () => {
    const { rerender } = renderHook(
      ({ active, enabled }: { active: boolean; enabled: boolean }) =>
        useAudioReactiveGlow(active, enabled),
      { initialProps: { active: true, enabled: true } }
    );

    act(() => flushRaf());

    const varAfterActive = document.documentElement.style.getPropertyValue('--glow-reactive-scale');
    expect(varAfterActive).not.toBe('');

    act(() => {
      rerender({ active: true, enabled: false });
    });

    expect(rafCallbacks.size).toBe(0);
    expect(document.documentElement.style.getPropertyValue('--glow-reactive-scale')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--glow-reactive-scale-ring')).toBe('');
  });

  // ── HTML5 audio path ─────────────────────────────────────────────────────────

  it('uses createMediaElementSource when an HTML5 audio element is playing', () => {
    const audioEl = makeAudioElement();
    mockHowls = [makeHtml5Howl(audioEl)];

    renderHook(() => useAudioReactiveGlow(true, true));

    expect(mockCtx!.createMediaElementSource).toHaveBeenCalledWith(audioEl);
    expect(mockCtx!.createAnalyser).toHaveBeenCalled();
    expect(window.requestAnimationFrame).toHaveBeenCalled();
    // masterGain should NOT be used when HTML5 path is taken
    expect(mockMasterGain!.connect).not.toHaveBeenCalled();
  });

  it('prefers the newest active HTML5 howl during crossfade', () => {
    const fadingOutEl = makeAudioElement();
    const newestEl = makeAudioElement();
    mockHowls = [makeHtml5Howl(fadingOutEl), makeHtml5Howl(newestEl)];

    renderHook(() => useAudioReactiveGlow(true, true));

    expect(mockCtx!.createMediaElementSource).toHaveBeenCalledWith(newestEl);
  });

  it('prefers the newest sound node within the selected HTML5 howl', () => {
    const olderNode = makeAudioElement();
    const newerNode = makeAudioElement();
    mockHowls = [
      {
        playing: () => true,
        _webAudio: false,
        _sounds: [{ _node: olderNode }, { _node: newerNode }],
      },
    ];

    renderHook(() => useAudioReactiveGlow(true, true));

    expect(mockCtx!.createMediaElementSource).toHaveBeenCalledWith(newerNode);
  });

  it('connects source to destination to preserve audio output', () => {
    const audioEl = makeAudioElement();
    mockHowls = [makeHtml5Howl(audioEl)];

    renderHook(() => useAudioReactiveGlow(true, true));

    const source = mockCtx!.createMediaElementSource.mock.results[0]!
      .value as MockMediaElementSource;
    expect(source.connect).toHaveBeenCalledWith(mockCtx!.destination);
  });

  it('connects source to analyser on the HTML5 path', () => {
    const audioEl = makeAudioElement();
    mockHowls = [makeHtml5Howl(audioEl)];

    renderHook(() => useAudioReactiveGlow(true, true));

    const source = mockCtx!.createMediaElementSource.mock.results[0]!
      .value as MockMediaElementSource;
    const analyser = mockCtx!.createAnalyser.mock.results[0]!.value as MockAnalyserNode;
    expect(source.connect).toHaveBeenCalledWith(analyser);
  });

  it('reuses existing MediaElementSource for the same audio element (no duplicate creation)', () => {
    const audioEl = makeAudioElement();
    mockHowls = [makeHtml5Howl(audioEl)];

    // First activation
    const { rerender } = renderHook(
      ({ active }: { active: boolean }) => useAudioReactiveGlow(active, true),
      { initialProps: { active: true } }
    );

    expect(mockCtx!.createMediaElementSource).toHaveBeenCalledOnce();

    // Deactivate then reactivate (same element still playing)
    act(() => rerender({ active: false }));
    act(() => rerender({ active: true }));

    // Should NOT create a second MediaElementSource for the same element
    expect(mockCtx!.createMediaElementSource).toHaveBeenCalledOnce();
  });

  it('bails out cleanly when createMediaElementSource throws', () => {
    const audioEl = makeAudioElement();
    mockHowls = [makeHtml5Howl(audioEl)];

    mockCtx!.createMediaElementSource = vi.fn(() => {
      throw new Error('InvalidStateError');
    });

    renderHook(() => useAudioReactiveGlow(true, true));

    const analyser = mockCtx!.createAnalyser.mock.results[0]!.value as MockAnalyserNode;
    expect(analyser.disconnect).toHaveBeenCalled();
    expect(mockMasterGain!.connect).not.toHaveBeenCalled();
  });

  it('disconnects mediaSource from analyser on teardown (HTML5 path)', () => {
    const audioEl = makeAudioElement();
    mockHowls = [makeHtml5Howl(audioEl)];

    const { rerender } = renderHook(
      ({ active }: { active: boolean }) => useAudioReactiveGlow(active, true),
      { initialProps: { active: true } }
    );

    const source = mockCtx!.createMediaElementSource.mock.results[0]!
      .value as MockMediaElementSource;
    const analyser = mockCtx!.createAnalyser.mock.results[0]!.value as MockAnalyserNode;

    act(() => rerender({ active: false }));

    expect(source.disconnect).toHaveBeenCalledWith(analyser);
  });

  it('falls back to masterGain when Howl is using Web Audio (not html5)', () => {
    mockHowls = [
      {
        playing: () => true,
        _webAudio: true, // Web Audio mode — no HTML element
        _sounds: [],
      },
    ];

    renderHook(() => useAudioReactiveGlow(true, true));

    expect(mockCtx!.createMediaElementSource).not.toHaveBeenCalled();
    expect(mockMasterGain!.connect).toHaveBeenCalled();
  });
});
