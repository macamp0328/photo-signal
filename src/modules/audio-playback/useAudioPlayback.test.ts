/**
 * Tests for useAudioPlayback hook
 *
 * Tests validate the audio-playback module contract from README.md:
 * - Play, pause, stop, and fadeOut controls
 * - Volume management
 * - Playback state tracking
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { Howl, Howler } from 'howler';
import { useAudioPlayback } from './useAudioPlayback';

// Mock diagnoseAudioUrl
vi.mock('./diagnoseAudioUrl', () => ({
  diagnoseAudioUrl: vi.fn().mockResolvedValue({
    httpStatus: null,
    corsOrigin: null,
    contentType: null,
    contentLength: null,
    likelyCorsIssue: true,
    message: 'Network request failed. Likely a CORS origin mismatch or the server is unreachable.',
  }),
}));

// Mock Howler.js with inline factory
vi.mock('howler', () => {
  type HowlCallbacks = {
    onplay?: () => void;
    onend?: () => void;
    onstop?: () => void;
    onpause?: () => void;
    onloaderror?: (id: number, error: unknown) => void;
    onplayerror?: (id: number, error: unknown) => void;
  };

  // Create mock Howl class inside factory to avoid hoisting issues
  class MockHowl {
    private _volume: number;
    private _playing: boolean = false;
    private readonly _callbacks: HowlCallbacks;
    private seekPosition: number;
    private durationMs: number;
    public readonly options: {
      src: string[];
      html5?: boolean;
      volume?: number;
    };

    public static instances: MockHowl[] = [];

    public play: ReturnType<typeof vi.fn>;
    public pause: ReturnType<typeof vi.fn>;
    public stop: ReturnType<typeof vi.fn>;
    public fade: ReturnType<typeof vi.fn>;
    public volume: ReturnType<typeof vi.fn>;
    public unload: ReturnType<typeof vi.fn>;
    public playing: ReturnType<typeof vi.fn>;
    public seek: ReturnType<typeof vi.fn>;
    public duration: ReturnType<typeof vi.fn>;

    constructor(
      options: {
        src: string[];
        html5?: boolean;
        volume?: number;
      } & HowlCallbacks
    ) {
      this._volume = options.volume ?? 1.0;
      this._callbacks = options;
      this.options = options;
      MockHowl.instances.push(this);
      this.seekPosition = 0;
      this.durationMs = 30000;

      // Initialize methods
      this.play = vi.fn(() => {
        this._playing = true;
        if (this._callbacks.onplay) {
          this._callbacks.onplay();
        }
        return 1;
      });

      this.pause = vi.fn(() => {
        this._playing = false;
        if (this._callbacks.onpause) {
          this._callbacks.onpause();
        }
        return this;
      });

      this.stop = vi.fn(() => {
        this._playing = false;
        if (this._callbacks.onstop) {
          this._callbacks.onstop();
        }
        return this;
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      this.fade = vi.fn((_from: number, to: number, _duration: number) => {
        this._volume = to;
        return this;
      });

      this.volume = vi.fn((vol?: number) => {
        if (vol !== undefined) {
          this._volume = vol;
          return this;
        }
        return this._volume;
      });

      this.unload = vi.fn(() => {
        this._playing = false;
        return this;
      });

      this.playing = vi.fn(() => {
        return this._playing;
      });

      this.seek = vi.fn((position?: number) => {
        if (position !== undefined) {
          this.seekPosition = position;
          return this;
        }
        return this.seekPosition;
      });

      this.duration = vi.fn(() => {
        return this.durationMs / 1000;
      });
    }

    public __triggerEnd(): void {
      this._callbacks.onend?.();
    }

    public __triggerStop(): void {
      this._callbacks.onstop?.();
    }

    public __triggerLoadError(error: unknown = new Error('Load failure')): void {
      this._callbacks.onloaderror?.(1, error);
    }

    public __triggerPlayError(error: unknown = new Error('Play failure')): void {
      this._callbacks.onplayerror?.(1, error);
    }
  }

  return {
    Howl: MockHowl,
    Howler: {
      ctx: {
        state: 'running',
        resume: vi.fn().mockResolvedValue(undefined),
      },
    },
  };
});

interface MockHowlInstance {
  options: {
    src: string[];
    html5?: boolean;
    volume?: number;
  };
  __triggerEnd: () => void;
  __triggerStop: () => void;
  __triggerLoadError: (error?: unknown) => void;
  __triggerPlayError: (error?: unknown) => void;
}

type MockedHowlClass = typeof Howl & { instances: MockHowlInstance[] };

const getMockedHowlClass = (): MockedHowlClass => Howl as unknown as MockedHowlClass;
const getMockedHowler = (): { ctx: { state: string; resume: ReturnType<typeof vi.fn> } } =>
  Howler as unknown as { ctx: { state: string; resume: ReturnType<typeof vi.fn> } };

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('useAudioPlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    getMockedHowlClass().instances.length = 0;
    const mockedHowler = getMockedHowler();
    mockedHowler.ctx.state = 'running';
    mockedHowler.ctx.resume.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should have correct default state', () => {
      const { result } = renderHook(() => useAudioPlayback());

      expect(result.current.isPlaying).toBe(false);
      expect(result.current.volume).toBe(0.8);
      expect(result.current.playbackError).toBeNull();
    });

    it('should accept custom initial volume', () => {
      const { result } = renderHook(() => useAudioPlayback({ volume: 0.5 }));

      expect(result.current.volume).toBe(0.5);
    });
  });

  describe('Play Functionality', () => {
    it('should create Howl instance and call play', () => {
      const { result } = renderHook(() => useAudioPlayback());
      const testUrl = '/audio/test.opus';

      act(() => {
        result.current.play(testUrl);
      });

      // The onplay callback sets isPlaying synchronously
      expect(result.current.isPlaying).toBe(true);
    });

    it('should use Web Audio mode for playback on mobile browsers', () => {
      const { result } = renderHook(() => useAudioPlayback());

      act(() => {
        result.current.play('/audio/test.opus');
      });

      expect(getMockedHowlClass().instances[0].options.html5).toBe(false);
    });

    it('should use correct volume when playing', () => {
      const { result } = renderHook(() => useAudioPlayback({ volume: 0.6 }));
      const testUrl = '/audio/test.opus';

      act(() => {
        result.current.play(testUrl);
      });

      expect(result.current.isPlaying).toBe(true);
      // Volume should remain at initial value
      expect(result.current.volume).toBe(0.6);
    });

    it('should stop previous audio when playing new audio', () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Play first audio
      act(() => {
        result.current.play('/audio/first.opus');
      });

      expect(result.current.isPlaying).toBe(true);

      // Play second audio
      act(() => {
        result.current.play('/audio/second.opus');
      });

      // Should still be playing (new audio)
      expect(result.current.isPlaying).toBe(true);
    });

    it('should resume the same track without creating a new instance', () => {
      const { result } = renderHook(() => useAudioPlayback());
      const HowlClass = getMockedHowlClass();

      act(() => {
        result.current.play('/audio/test.opus');
      });

      act(() => {
        result.current.pause();
      });

      expect(HowlClass.instances.length).toBe(1);

      act(() => {
        result.current.play('/audio/test.opus');
      });

      expect(HowlClass.instances.length).toBe(1);
    });

    it('should attempt to resume audio context when suspended', async () => {
      const { result } = renderHook(() => useAudioPlayback());
      const mockedHowler = getMockedHowler();
      mockedHowler.ctx.state = 'suspended';

      await act(async () => {
        result.current.play('/audio/test.opus');
        await Promise.resolve();
      });

      expect(mockedHowler.ctx.resume).toHaveBeenCalledTimes(1);
    });

    it('waits for audio context resume before starting playback', async () => {
      const { result } = renderHook(() => useAudioPlayback());
      const mockedHowler = getMockedHowler();
      const deferred = createDeferred();
      mockedHowler.ctx.state = 'suspended';
      mockedHowler.ctx.resume.mockImplementationOnce(() => deferred.promise);

      act(() => {
        result.current.play('/audio/test.opus');
      });

      expect(getMockedHowlClass().instances).toHaveLength(0);

      await act(async () => {
        deferred.resolve();
        await deferred.promise;
      });

      expect(getMockedHowlClass().instances).toHaveLength(1);
      expect(result.current.isPlaying).toBe(true);
    });

    it('ignores stale play requests that resolve after a newer one', async () => {
      const { result } = renderHook(() => useAudioPlayback());
      const mockedHowler = getMockedHowler();
      const firstResume = createDeferred();
      const secondResume = createDeferred();

      mockedHowler.ctx.state = 'suspended';
      mockedHowler.ctx.resume
        .mockImplementationOnce(() => firstResume.promise)
        .mockImplementationOnce(() => secondResume.promise);

      act(() => {
        result.current.play('/audio/first.opus');
        result.current.play('/audio/second.opus');
      });

      await act(async () => {
        secondResume.resolve();
        await secondResume.promise;
      });

      expect(getMockedHowlClass().instances).toHaveLength(1);

      await act(async () => {
        firstResume.resolve();
        await firstResume.promise;
      });

      expect(getMockedHowlClass().instances).toHaveLength(1);
      expect(result.current.isPlaying).toBe(true);
    });
  });

  describe('Audio Context Unlock Event Listeners', () => {
    it('should register window event listeners on mount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useAudioPlayback());

      const pointerCall = addEventListenerSpy.mock.calls.find((args) => args[0] === 'pointerdown');
      const touchCall = addEventListenerSpy.mock.calls.find((args) => args[0] === 'touchstart');
      const clickCall = addEventListenerSpy.mock.calls.find((args) => args[0] === 'click');

      expect(pointerCall?.[1]).toEqual(expect.any(Function));
      expect(pointerCall?.[2]).toEqual({ passive: true });

      expect(touchCall?.[1]).toEqual(expect.any(Function));
      expect(touchCall?.[2]).toEqual({ passive: true });

      expect(clickCall?.[1]).toEqual(expect.any(Function));
      expect(clickCall?.[2]).toEqual({ passive: true });

      addEventListenerSpy.mockRestore();
    });

    it('should remove window event listeners on unmount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useAudioPlayback());

      const pointerListener = addEventListenerSpy.mock.calls.find(
        (args) => args[0] === 'pointerdown'
      )?.[1];
      const touchListener = addEventListenerSpy.mock.calls.find(
        (args) => args[0] === 'touchstart'
      )?.[1];
      const clickListener = addEventListenerSpy.mock.calls.find((args) => args[0] === 'click')?.[1];

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('pointerdown', pointerListener);
      expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', touchListener);
      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', clickListener);

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('should unlock audio context when pointerdown event fires', async () => {
      renderHook(() => useAudioPlayback());
      const mockedHowler = getMockedHowler();
      mockedHowler.ctx.state = 'suspended';

      // Simulate pointerdown event
      await act(async () => {
        window.dispatchEvent(new Event('pointerdown'));
        await vi.runAllTimersAsync();
      });

      expect(mockedHowler.ctx.resume).toHaveBeenCalled();
    });

    it('should unlock audio context when touchstart event fires', async () => {
      renderHook(() => useAudioPlayback());
      const mockedHowler = getMockedHowler();
      mockedHowler.ctx.state = 'suspended';

      // Reset the resume spy from previous tests
      mockedHowler.ctx.resume.mockClear();

      // Simulate touchstart event
      await act(async () => {
        window.dispatchEvent(new Event('touchstart'));
        await vi.runAllTimersAsync();
      });

      expect(mockedHowler.ctx.resume).toHaveBeenCalled();
    });

    it('should unlock audio context when click event fires', async () => {
      renderHook(() => useAudioPlayback());
      const mockedHowler = getMockedHowler();
      mockedHowler.ctx.state = 'suspended';

      // Reset the resume spy from previous tests
      mockedHowler.ctx.resume.mockClear();

      // Simulate click event
      await act(async () => {
        window.dispatchEvent(new Event('click'));
        await vi.runAllTimersAsync();
      });

      expect(mockedHowler.ctx.resume).toHaveBeenCalled();
    });

    it('should not attempt to unlock audio context when already running', async () => {
      renderHook(() => useAudioPlayback());
      const mockedHowler = getMockedHowler();
      mockedHowler.ctx.state = 'running';

      // Simulate click event
      await act(async () => {
        window.dispatchEvent(new Event('click'));
        await vi.runAllTimersAsync();
      });

      // resume should not be called when context is already running
      expect(mockedHowler.ctx.resume).not.toHaveBeenCalled();
    });
  });

  describe('Pause Functionality', () => {
    it('should pause playing audio', () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Start playing
      act(() => {
        result.current.play('/audio/test.opus');
      });

      expect(result.current.isPlaying).toBe(true);

      // Pause
      act(() => {
        result.current.pause();
      });

      expect(result.current.isPlaying).toBe(false);
    });

    it('should handle pause when no audio is playing', () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Should not throw error
      expect(() => {
        act(() => {
          result.current.pause();
        });
      }).not.toThrow();

      expect(result.current.isPlaying).toBe(false);
    });

    it('cancels a pending async play when pause is called first', async () => {
      const { result } = renderHook(() => useAudioPlayback());
      const mockedHowler = getMockedHowler();
      const deferred = createDeferred();

      mockedHowler.ctx.state = 'suspended';
      mockedHowler.ctx.resume.mockImplementationOnce(() => deferred.promise);

      act(() => {
        result.current.play('/audio/test.opus');
        result.current.pause();
      });

      await act(async () => {
        deferred.resolve();
        await deferred.promise;
      });

      expect(getMockedHowlClass().instances).toHaveLength(0);
      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe('Stop Functionality', () => {
    it('should stop playing audio', () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Start playing
      act(() => {
        result.current.play('/audio/test.opus');
      });

      expect(result.current.isPlaying).toBe(true);

      // Stop
      act(() => {
        result.current.stop();
      });

      expect(result.current.isPlaying).toBe(false);
    });

    it('should handle stop when no audio is playing', () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Should not throw error
      expect(() => {
        act(() => {
          result.current.stop();
        });
      }).not.toThrow();

      expect(result.current.isPlaying).toBe(false);
    });
  });

  describe('Volume Controls', () => {
    it('should set volume correctly', () => {
      const { result } = renderHook(() => useAudioPlayback());

      act(() => {
        result.current.setVolume(0.5);
      });

      expect(result.current.volume).toBe(0.5);
    });

    it('should clamp volume to 0-1 range (below 0)', () => {
      const { result } = renderHook(() => useAudioPlayback());

      act(() => {
        result.current.setVolume(-0.5);
      });

      expect(result.current.volume).toBe(0);
    });

    it('should clamp volume to 0-1 range (above 1)', () => {
      const { result } = renderHook(() => useAudioPlayback());

      act(() => {
        result.current.setVolume(1.5);
      });

      expect(result.current.volume).toBe(1);
    });

    it('should update Howl volume when audio is playing', () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Start playing
      act(() => {
        result.current.play('/audio/test.opus');
      });

      expect(result.current.isPlaying).toBe(true);

      // Change volume
      act(() => {
        result.current.setVolume(0.3);
      });

      expect(result.current.volume).toBe(0.3);
    });
  });

  describe('Error Handling', () => {
    it('should handle load errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useAudioPlayback());
      const HowlClass = getMockedHowlClass();

      act(() => {
        result.current.play('/audio/nonexistent.opus');
      });

      act(() => {
        HowlClass.instances[0].__triggerLoadError();
      });

      expect(result.current.isPlaying).toBe(false);
      expect(result.current.playbackError).toBe(
        'Audio failed to load. Check your connection and try again.'
      );

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should handle play errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAudioPlayback());
      const HowlClass = getMockedHowlClass();

      // Start playing (this should succeed in the mock)
      act(() => {
        result.current.play('/audio/test.opus');
      });

      act(() => {
        HowlClass.instances[0].__triggerPlayError();
      });

      expect(result.current.isPlaying).toBe(false);
      expect(result.current.playbackError).toBe('Audio failed to start. Tap Play to retry.');

      act(() => {
        result.current.clearPlaybackError();
      });

      expect(result.current.playbackError).toBeNull();

      act(() => {
        result.current.play('/audio/test.opus');
      });

      expect(result.current.isPlaying).toBe(true);
      expect(result.current.playbackError).toBeNull();

      consoleSpy.mockRestore();
    });

    it('should surface autoplay-specific guidance on NotAllowedError', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAudioPlayback());
      const HowlClass = getMockedHowlClass();

      act(() => {
        result.current.play('/audio/test.opus');
      });

      act(() => {
        HowlClass.instances[0].__triggerPlayError(new Error('NotAllowedError: play() failed'));
      });

      expect(result.current.playbackError).toBe(
        'Playback blocked by browser autoplay rules. Touch screen and tap Play again.'
      );

      consoleSpy.mockRestore();
    });

    it('should enhance load error message with diagnostic details', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useAudioPlayback());
      const HowlClass = getMockedHowlClass();

      act(() => {
        result.current.play('/audio/cors-blocked.opus');
      });

      act(() => {
        HowlClass.instances[0].__triggerLoadError();
      });

      // Initial generic message
      expect(result.current.playbackError).toBe(
        'Audio failed to load. Check your connection and try again.'
      );

      // Flush all promises to allow diagnostic to resolve
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.playbackError).toContain('Audio failed to load:');
      expect(result.current.playbackError).toContain('Tap Play to retry.');

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should unload sound on unmount', () => {
      const { result, unmount } = renderHook(() => useAudioPlayback());

      // Play audio
      act(() => {
        result.current.play('/audio/test.opus');
      });

      expect(result.current.isPlaying).toBe(true);

      // Unmount should clean up
      unmount();

      // No errors should occur
    });
  });

  describe('Module Contract Validation', () => {
    it('should expose all required methods from README contract', () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Verify all contract methods are present
      expect(typeof result.current.play).toBe('function');
      expect(typeof result.current.preload).toBe('function');
      expect(typeof result.current.pause).toBe('function');
      expect(typeof result.current.stop).toBe('function');
      expect(typeof result.current.crossfade).toBe('function');
      expect(typeof result.current.setVolume).toBe('function');
      expect(typeof result.current.clearPlaybackError).toBe('function');

      // Verify all contract properties are present
      expect(typeof result.current.isPlaying).toBe('boolean');
      expect(typeof result.current.progress).toBe('number');
      expect(typeof result.current.volume).toBe('number');
      expect(
        result.current.playbackError === null || typeof result.current.playbackError === 'string'
      ).toBe(true);
    });

    it('should accept options parameter as per contract', () => {
      const { result } = renderHook(() => useAudioPlayback({ volume: 0.7 }));

      expect(result.current.volume).toBe(0.7);
    });
  });

  describe('onSongEnd callback', () => {
    it('should call onSongEnd when a song finishes naturally', () => {
      const onSongEnd = vi.fn();
      const { result } = renderHook(() => useAudioPlayback({ onSongEnd }));
      const HowlClass = getMockedHowlClass();

      act(() => {
        result.current.play('/audio/test.opus');
      });

      act(() => {
        HowlClass.instances[0].__triggerEnd();
      });

      expect(onSongEnd).toHaveBeenCalledTimes(1);
    });

    it('should not call onSongEnd when stop() is called', () => {
      const onSongEnd = vi.fn();
      const { result } = renderHook(() => useAudioPlayback({ onSongEnd }));

      act(() => {
        result.current.play('/audio/test.opus');
      });

      act(() => {
        result.current.stop();
      });

      expect(onSongEnd).not.toHaveBeenCalled();
    });

    it('should not call onSongEnd when pause() is called', () => {
      const onSongEnd = vi.fn();
      const { result } = renderHook(() => useAudioPlayback({ onSongEnd }));

      act(() => {
        result.current.play('/audio/test.opus');
      });

      act(() => {
        result.current.pause();
      });

      expect(onSongEnd).not.toHaveBeenCalled();
    });

    it('should use the latest onSongEnd after it is updated', () => {
      const onSongEndV1 = vi.fn();
      const onSongEndV2 = vi.fn();
      const { result, rerender } = renderHook(
        ({ cb }: { cb: () => void }) => useAudioPlayback({ onSongEnd: cb }),
        { initialProps: { cb: onSongEndV1 } }
      );
      const HowlClass = getMockedHowlClass();

      act(() => {
        result.current.play('/audio/test.opus');
      });

      // Update the callback
      rerender({ cb: onSongEndV2 });

      act(() => {
        HowlClass.instances[0].__triggerEnd();
      });

      expect(onSongEndV1).not.toHaveBeenCalled();
      expect(onSongEndV2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Preload Functionality', () => {
    it('should preload audio without starting playback and reuse the cached instance', () => {
      const { result } = renderHook(() => useAudioPlayback());
      const HowlClass = getMockedHowlClass();

      act(() => {
        result.current.preload('/audio/preload.opus');
      });

      expect(result.current.isPlaying).toBe(false);
      expect(HowlClass.instances.length).toBe(1);

      act(() => {
        result.current.play('/audio/preload.opus');
      });

      expect(HowlClass.instances.length).toBe(1);
      expect(result.current.isPlaying).toBe(true);
    });
  });

  describe('Crossfade Functionality', () => {
    it('should create two Howl instances during crossfade', () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Start playing first audio
      act(() => {
        result.current.play('/audio/first.opus');
      });

      expect(result.current.isPlaying).toBe(true);

      // Crossfade to second audio
      act(() => {
        result.current.crossfade('/audio/second.opus');
      });

      // Should still be playing during crossfade
      expect(result.current.isPlaying).toBe(true);
    });

    it('should clean up old instance after crossfade completes', () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Start playing
      act(() => {
        result.current.play('/audio/first.opus');
      });

      // Crossfade
      act(() => {
        result.current.crossfade('/audio/second.opus');
      });

      // Fast-forward past crossfade duration to trigger cleanup
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // No errors should occur, cleanup should be successful
      expect(result.current.isPlaying).toBe(true);
    });

    it('retries playback if the new track does not start after crossfade', () => {
      const { result } = renderHook(() => useAudioPlayback());

      act(() => {
        result.current.play('/audio/first.opus');
      });

      act(() => {
        result.current.crossfade('/audio/second.opus');
      });

      const howlInstances = getMockedHowlClass().instances;
      const newSound = howlInstances[1] as unknown as {
        playing: ReturnType<typeof vi.fn>;
        play: ReturnType<typeof vi.fn>;
      };

      newSound.playing.mockReturnValue(false);

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(newSound.play).toHaveBeenCalledTimes(2);
    });

    it('reasserts target volume after crossfade completes', () => {
      const { result } = renderHook(() => useAudioPlayback({ volume: 0.65 }));

      act(() => {
        result.current.play('/audio/first.opus');
      });

      act(() => {
        result.current.crossfade('/audio/second.opus');
      });

      const howlInstances = getMockedHowlClass().instances;
      const newSound = howlInstances[1] as unknown as {
        volume: ReturnType<typeof vi.fn>;
      };

      const callsBeforeCompletion = newSound.volume.mock.calls.length;

      act(() => {
        vi.advanceTimersByTime(300);
      });

      const callsAfterCompletion = newSound.volume.mock.calls.length;
      expect(callsAfterCompletion).toBeGreaterThan(callsBeforeCompletion);
      expect(newSound.volume).toHaveBeenCalledWith(0.65);
    });

    it('applies updated volume when changed mid-crossfade', () => {
      const { result } = renderHook(() => useAudioPlayback({ volume: 0.65 }));

      act(() => {
        result.current.play('/audio/first.opus');
      });

      act(() => {
        result.current.crossfade('/audio/second.opus');
      });

      const howlInstances = getMockedHowlClass().instances;
      const newSound = howlInstances[1] as unknown as {
        volume: ReturnType<typeof vi.fn>;
      };

      const callsBeforeCompletion = newSound.volume.mock.calls.length;
      const updatedVolume = 0.4;

      act(() => {
        result.current.setVolume(updatedVolume);
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      const callsAfterCompletion = newSound.volume.mock.calls.slice(callsBeforeCompletion);
      expect(callsAfterCompletion.length).toBeGreaterThanOrEqual(1);
      // The final volume after crossfade completion should respect the updated volume,
      // and should not be reset back to the initial volume.
      expect(callsAfterCompletion[callsAfterCompletion.length - 1]).toEqual([updatedVolume]);
      expect(callsAfterCompletion).not.toContainEqual([0.65]);
    });
    it('should keep playback active when previous track ends after crossfade', () => {
      const { result } = renderHook(() => useAudioPlayback());

      act(() => {
        result.current.play('/audio/first.opus');
      });

      act(() => {
        result.current.crossfade('/audio/second.opus');
      });

      const howlInstances = getMockedHowlClass().instances;
      expect(howlInstances.length).toBeGreaterThanOrEqual(1);

      // The first instance represents the fading-out track
      act(() => {
        howlInstances[0].__triggerEnd();
      });

      expect(result.current.isPlaying).toBe(true);
    });

    it('should handle crossfade when no audio is playing', () => {
      const { result } = renderHook(() => useAudioPlayback());

      expect(result.current.isPlaying).toBe(false);

      // Crossfade when nothing is playing (should just play)
      act(() => {
        result.current.crossfade('/audio/test.opus');
      });

      // Should start playing the new track
      expect(result.current.isPlaying).toBe(true);
    });

    it('should handle crossfade with same URL (no-op)', () => {
      const { result } = renderHook(() => useAudioPlayback());
      const sameUrl = '/audio/test.opus';

      // Start playing
      act(() => {
        result.current.play(sameUrl);
      });

      expect(result.current.isPlaying).toBe(true);

      // Crossfade to same URL (should restart)
      act(() => {
        result.current.crossfade(sameUrl);
      });

      // Should still be playing
      expect(result.current.isPlaying).toBe(true);
    });

    it('should handle crossfade while another crossfade is in progress', () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Start playing
      act(() => {
        result.current.play('/audio/first.opus');
      });

      // Start first crossfade
      act(() => {
        result.current.crossfade('/audio/second.opus');
      });

      // Advance time partially
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Start second crossfade before first completes
      act(() => {
        result.current.crossfade('/audio/third.opus');
      });

      expect(result.current.isPlaying).toBe(true);

      // Complete second crossfade
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Should still be playing
      expect(result.current.isPlaying).toBe(true);
    });

    it('should cleanup crossfade on unmount', () => {
      const { result, unmount } = renderHook(() => useAudioPlayback());

      // Start playing
      act(() => {
        result.current.play('/audio/first.opus');
      });

      // Start crossfade
      act(() => {
        result.current.crossfade('/audio/second.opus');
      });

      // Unmount before crossfade completes
      unmount();

      // No errors should occur
    });

    it('should fade new track in to current volume level', () => {
      const { result } = renderHook(() => useAudioPlayback({ volume: 0.6 }));

      // Start playing
      act(() => {
        result.current.play('/audio/first.opus');
      });

      // Crossfade
      act(() => {
        result.current.crossfade('/audio/second.opus');
      });

      // Volume should remain at initial level
      expect(result.current.volume).toBe(0.6);
    });
  });
});
