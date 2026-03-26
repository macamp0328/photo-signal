import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAudioTest } from './useAudioTest';

// Mock diagnoseAudioUrl
vi.mock('../audio-playback', () => ({
  diagnoseAudioUrl: vi.fn(),
}));

// Mock Howler.js
vi.mock('howler', () => {
  class MockHowl {
    private _callbacks: Record<string, Array<(...args: unknown[]) => void>> = {};

    constructor() {
      MockHowl.instances.push(this);
    }

    static instances: MockHowl[] = [];

    on(event: string, callback: (...args: unknown[]) => void) {
      if (!this._callbacks[event]) {
        this._callbacks[event] = [];
      }
      this._callbacks[event].push(callback);
      return this;
    }

    play() {
      // Trigger play callback asynchronously
      setTimeout(() => {
        this._callbacks['play']?.forEach((cb) => cb());
      }, 10);
      return 1;
    }

    stop = vi.fn();
    unload = vi.fn();

    __triggerEvent(event: string, ...args: unknown[]) {
      this._callbacks[event]?.forEach((cb) => cb(...args));
    }
  }

  return { Howl: MockHowl };
});

import { diagnoseAudioUrl } from '../audio-playback';
import { Howl } from 'howler';

interface MockHowlInstance {
  __triggerEvent: (event: string, ...args: unknown[]) => void;
  stop: ReturnType<typeof vi.fn>;
  unload: ReturnType<typeof vi.fn>;
}

type MockedHowlClass = typeof Howl & { instances: MockHowlInstance[] };
const getMockedHowlClass = (): MockedHowlClass => Howl as unknown as MockedHowlClass;

describe('useAudioTest', () => {
  const testUrl = 'https://audio.example.com/song.opus';
  const successDiagnostic = {
    httpStatus: 200,
    corsOrigin: '*',
    contentType: 'audio/opus',
    contentLength: 123456,
    likelyCorsIssue: false,
    message: 'OK (200). Content-Type: audio/opus.',
  };

  const failedDiagnostic = {
    httpStatus: 404,
    corsOrigin: null,
    contentType: null,
    contentLength: null,
    likelyCorsIssue: false,
    message: 'Server returned Not Found.',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    getMockedHowlClass().instances.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should start in idle state', () => {
    const { result } = renderHook(() => useAudioTest());

    expect(result.current.isTestRunning).toBe(false);
    expect(result.current.testResult).toBeNull();
  });

  it('should set running state when test starts', async () => {
    vi.mocked(diagnoseAudioUrl).mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useAudioTest());

    act(() => {
      result.current.runTest(testUrl);
    });

    expect(result.current.isTestRunning).toBe(true);
  });

  it('should skip playback when fetch fails', async () => {
    vi.mocked(diagnoseAudioUrl).mockResolvedValue(failedDiagnostic);

    const { result } = renderHook(() => useAudioTest());

    act(() => {
      result.current.runTest(testUrl);
    });

    // Flush all promises
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.isTestRunning).toBe(false);
    expect(result.current.testResult).not.toBeNull();
    expect(result.current.testResult!.playbackOutcome).toBe('skipped');
    expect(result.current.testResult!.diagnostic).toBe(failedDiagnostic);
  });

  it('should report success when playback works', async () => {
    vi.mocked(diagnoseAudioUrl).mockResolvedValue(successDiagnostic);

    const { result } = renderHook(() => useAudioTest());

    await act(async () => {
      result.current.runTest(testUrl);
      // Resolve the diagnoseAudioUrl promise
      await vi.advanceTimersByTimeAsync(0);
      // Trigger the play callback from mock Howl
      await vi.advanceTimersByTimeAsync(20);
    });

    expect(result.current.isTestRunning).toBe(false);
    expect(result.current.testResult).not.toBeNull();
    expect(result.current.testResult!.playbackOutcome).toBe('success');
    expect(result.current.testResult!.playbackDetail).toContain('is now playing');

    const instances = getMockedHowlClass().instances;
    expect(instances[0].stop).not.toHaveBeenCalled();
    expect(instances[0].unload).not.toHaveBeenCalled();
  });

  it('should report load-error when Howler fails to load', async () => {
    vi.mocked(diagnoseAudioUrl).mockResolvedValue(successDiagnostic);

    const { result } = renderHook(() => useAudioTest());

    await act(async () => {
      result.current.runTest(testUrl);
      await vi.advanceTimersByTimeAsync(0);
    });

    // Trigger load error on the Howl instance
    await act(async () => {
      const instances = getMockedHowlClass().instances;
      instances[0].__triggerEvent('loaderror', 1, 'codec error');
    });

    expect(result.current.isTestRunning).toBe(false);
    expect(result.current.testResult!.playbackOutcome).toBe('load-error');
    expect(result.current.testResult!.playbackDetail).toContain('codec error');
  });

  it('should append codec hint when fetch succeeds but browser cannot play content type', async () => {
    vi.mocked(diagnoseAudioUrl).mockResolvedValue({
      ...successDiagnostic,
      contentType: 'audio/ogg; codecs=opus',
    });
    vi.spyOn(globalThis.Audio.prototype, 'canPlayType').mockReturnValue('');

    const { result } = renderHook(() => useAudioTest());

    await act(async () => {
      result.current.runTest(testUrl);
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      const instances = getMockedHowlClass().instances;
      instances[0].__triggerEvent('loaderror', 1, 'decode error');
    });

    expect(result.current.testResult!.playbackDetail).toContain(
      'Browser codec support issue likely (audio/ogg; codecs=opus)'
    );
  });

  it('should append codec hint when play error occurs with unsupported content type', async () => {
    vi.mocked(diagnoseAudioUrl).mockResolvedValue({
      ...successDiagnostic,
      contentType: 'audio/ogg; codecs=opus',
    });
    vi.spyOn(globalThis.Audio.prototype, 'canPlayType').mockReturnValue('');

    const { result } = renderHook(() => useAudioTest());

    await act(async () => {
      result.current.runTest(testUrl);
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      const instances = getMockedHowlClass().instances;
      instances[0].__triggerEvent('playerror', 1, 'decode error');
    });

    expect(result.current.testResult!.playbackDetail).toContain(
      'Browser codec support issue likely (audio/ogg; codecs=opus)'
    );
  });

  it('should reset test state', async () => {
    vi.mocked(diagnoseAudioUrl).mockResolvedValue(failedDiagnostic);

    const { result } = renderHook(() => useAudioTest());

    act(() => {
      result.current.runTest(testUrl);
    });

    // Flush all promises
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.testResult).not.toBeNull();

    act(() => {
      result.current.resetTest();
    });

    expect(result.current.testResult).toBeNull();
    expect(result.current.isTestRunning).toBe(false);
  });

  it('should not run test with empty url', () => {
    const { result } = renderHook(() => useAudioTest());

    act(() => {
      result.current.runTest('');
    });

    expect(result.current.isTestRunning).toBe(false);
  });

  it('should reset running state when diagnoseAudioUrl rejects', async () => {
    vi.mocked(diagnoseAudioUrl).mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useAudioTest());

    await act(async () => {
      result.current.runTest(testUrl);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.isTestRunning).toBe(false);
    expect(result.current.testResult).toBeNull();
  });
});
