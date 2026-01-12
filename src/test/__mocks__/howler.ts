/**
 * Mock implementation of Howler.js for testing
 *
 * This mock provides a simplified version of Howl that tracks method calls
 * and allows tests to trigger callbacks like onplay, onend, onloaderror, etc.
 */

import { vi } from 'vitest';

export interface HowlOptions {
  src: string[];
  html5?: boolean;
  volume?: number;
  onplay?: () => void;
  onend?: () => void;
  onstop?: () => void;
  onpause?: () => void;
  onloaderror?: (id: number, error: unknown) => void;
  onplayerror?: (id: number, error: unknown) => void;
}

export class Howl {
  private _volume: number;
  private _playing: boolean = false;
  private _position: number = 0;
  private _duration: number = 30;
  private _listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

  // Expose callbacks for testing
  public onplay?: () => void;
  public onend?: () => void;
  public onstop?: () => void;
  public onpause?: () => void;
  public onloaderror?: (id: number, error: unknown) => void;
  public onplayerror?: (id: number, error: unknown) => void;

  public on = vi.fn((event: string, callback: (...args: unknown[]) => void) => {
    this._listeners[event] = this._listeners[event] || [];
    this._listeners[event].push(callback);
    return this;
  });

  public off = vi.fn((event?: string) => {
    if (event) {
      delete this._listeners[event];
    } else {
      this._listeners = {};
    }
    return this;
  });

  private _emit(event: string, ...args: unknown[]) {
    const listeners = this._listeners[event] ?? [];
    listeners.forEach((cb) => cb(...args));
  }

  // Track method calls
  public play = vi.fn(() => {
    this._playing = true;
    this._emit('play');
    this.onplay?.();
    return 1; // Return sound ID
  });

  public pause = vi.fn(() => {
    this._playing = false;
    this._emit('pause');
    this.onpause?.();
    return this;
  });

  public stop = vi.fn(() => {
    this._playing = false;
    this._emit('stop');
    this.onstop?.();
    return this;
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public fade = vi.fn((_from: number, to: number, _duration: number) => {
    // Simulate fade by immediately setting the final volume
    this._volume = to;
    return this;
  });

  public volume = vi.fn((vol?: number) => {
    if (vol !== undefined) {
      this._volume = vol;
      return this;
    }
    return this._volume;
  });

  public unload = vi.fn(() => {
    this._playing = false;
    this._emit('stop');
    this._listeners = {};
    return this;
  });

  public playing = vi.fn(() => {
    return this._playing;
  });

  public duration = vi.fn(() => {
    return this._duration;
  });

  public seek = vi.fn((position?: number) => {
    if (typeof position === 'number') {
      this._position = position;
      return this;
    }
    return this._position;
  });

  constructor(options: HowlOptions) {
    this._volume = options.volume ?? 1.0;

    // Store callbacks
    this.onplay = options.onplay;
    this.onend = options.onend;
    this.onstop = options.onstop;
    this.onpause = options.onpause;
    this.onloaderror = options.onloaderror;
    this.onplayerror = options.onplayerror;
  }

  // Helper method for tests to trigger error callbacks
  public _triggerLoadError(error: unknown = new Error('Load error')) {
    if (this.onloaderror) {
      this.onloaderror(1, error);
    }
  }

  public _triggerPlayError(error: unknown = new Error('Play error')) {
    if (this.onplayerror) {
      this.onplayerror(1, error);
    }
  }
}

// Mock the default export
export default { Howl };
