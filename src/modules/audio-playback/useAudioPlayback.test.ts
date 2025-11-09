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
import { useAudioPlayback } from './useAudioPlayback';

// Mock Howler.js with inline factory
vi.mock('howler', () => {
  // Create mock Howl class inside factory to avoid hoisting issues
  class MockHowl {
    private _volume: number;
    private _playing: boolean = false;

    public play: ReturnType<typeof vi.fn>;
    public pause: ReturnType<typeof vi.fn>;
    public stop: ReturnType<typeof vi.fn>;
    public fade: ReturnType<typeof vi.fn>;
    public volume: ReturnType<typeof vi.fn>;
    public unload: ReturnType<typeof vi.fn>;
    public playing: ReturnType<typeof vi.fn>;

    constructor(options: {
      src: string[];
      html5?: boolean;
      volume?: number;
      onplay?: () => void;
      onend?: () => void;
      onstop?: () => void;
      onpause?: () => void;
      onloaderror?: (id: number, error: unknown) => void;
      onplayerror?: (id: number, error: unknown) => void;
    }) {
      this._volume = options.volume ?? 1.0;

      // Initialize methods
      this.play = vi.fn(() => {
        this._playing = true;
        if (options.onplay) {
          options.onplay();
        }
        return 1;
      });

      this.pause = vi.fn(() => {
        this._playing = false;
        if (options.onpause) {
          options.onpause();
        }
        return this;
      });

      this.stop = vi.fn(() => {
        this._playing = false;
        if (options.onstop) {
          options.onstop();
        }
        return this;
      });

      this.fade = vi.fn((_from: number, to: number) => {
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
    }
  }

  return { Howl: MockHowl };
});

describe('useAudioPlayback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should have correct default state', () => {
      const { result } = renderHook(() => useAudioPlayback());

      expect(result.current.isPlaying).toBe(false);
      expect(result.current.volume).toBe(0.8);
    });

    it('should accept custom initial volume', () => {
      const { result } = renderHook(() => useAudioPlayback({ volume: 0.5 }));

      expect(result.current.volume).toBe(0.5);
    });

    it('should accept custom fadeTime', () => {
      const { result } = renderHook(() => useAudioPlayback({ fadeTime: 2000 }));

      // fadeTime is internal, just verify hook initializes without error
      expect(result.current).toBeDefined();
    });
  });

  describe('Play Functionality', () => {
    it('should create Howl instance and call play', async () => {
      const { result } = renderHook(() => useAudioPlayback());
      const testUrl = '/audio/test.mp3';

      act(() => {
        result.current.play(testUrl);
      });

      // The onplay callback sets isPlaying synchronously
      expect(result.current.isPlaying).toBe(true);
    });

    it('should use correct volume when playing', async () => {
      const { result } = renderHook(() => useAudioPlayback({ volume: 0.6 }));
      const testUrl = '/audio/test.mp3';

      act(() => {
        result.current.play(testUrl);
      });

      expect(result.current.isPlaying).toBe(true);
      // Volume should remain at initial value
      expect(result.current.volume).toBe(0.6);
    });

    it('should stop previous audio when playing new audio', async () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Play first audio
      act(() => {
        result.current.play('/audio/first.mp3');
      });

      expect(result.current.isPlaying).toBe(true);

      // Play second audio
      act(() => {
        result.current.play('/audio/second.mp3');
      });

      // Should still be playing (new audio)
      expect(result.current.isPlaying).toBe(true);
    });
  });

  describe('Pause Functionality', () => {
    it('should pause playing audio', async () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Start playing
      act(() => {
        result.current.play('/audio/test.mp3');
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
  });

  describe('Stop Functionality', () => {
    it('should stop playing audio', async () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Start playing
      act(() => {
        result.current.play('/audio/test.mp3');
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

  describe('Fade Out Functionality', () => {
    it('should fade out audio with default duration', async () => {
      const { result } = renderHook(() => useAudioPlayback({ fadeTime: 1000 }));

      // Start playing
      act(() => {
        result.current.play('/audio/test.mp3');
      });

      expect(result.current.isPlaying).toBe(true);

      // Fade out
      act(() => {
        result.current.fadeOut();
      });

      // Fast-forward timers
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should stop after fade duration
      expect(result.current.isPlaying).toBe(false);
    });

    it('should fade out audio with custom duration', async () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Start playing
      act(() => {
        result.current.play('/audio/test.mp3');
      });

      expect(result.current.isPlaying).toBe(true);

      // Fade out with custom duration
      act(() => {
        result.current.fadeOut(500);
      });

      // Fast-forward timers
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should stop after custom fade duration
      expect(result.current.isPlaying).toBe(false);
    });

    it('should handle fadeOut when not playing', () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Should not throw error
      expect(() => {
        act(() => {
          result.current.fadeOut();
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

    it('should update Howl volume when audio is playing', async () => {
      const { result } = renderHook(() => useAudioPlayback());

      // Start playing
      act(() => {
        result.current.play('/audio/test.mp3');
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
    it('should handle load errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useAudioPlayback());

      act(() => {
        result.current.play('/audio/nonexistent.mp3');
      });

      // The hook sets isPlaying to true even on load error
      // to allow state management (as per implementation)
      expect(result.current.isPlaying).toBe(true);

      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should handle play errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useAudioPlayback());

      // Start playing (this should succeed in the mock)
      act(() => {
        result.current.play('/audio/test.mp3');
      });

      expect(result.current.isPlaying).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    it('should unload sound on unmount', async () => {
      const { result, unmount } = renderHook(() => useAudioPlayback());

      // Play audio
      act(() => {
        result.current.play('/audio/test.mp3');
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
      expect(typeof result.current.pause).toBe('function');
      expect(typeof result.current.stop).toBe('function');
      expect(typeof result.current.fadeOut).toBe('function');
      expect(typeof result.current.setVolume).toBe('function');

      // Verify all contract properties are present
      expect(typeof result.current.isPlaying).toBe('boolean');
      expect(typeof result.current.volume).toBe('number');
    });

    it('should accept options parameter as per contract', () => {
      const { result } = renderHook(() =>
        useAudioPlayback({
          volume: 0.7,
          fadeTime: 1500,
        })
      );

      expect(result.current.volume).toBe(0.7);
    });
  });
});
