import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isDemoNoAudioFadeEnabled } from './demoMode';

const FLAG_KEY = 'photo-signal-demo-no-audio-fade';

describe('isDemoNoAudioFadeEnabled', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns false when flag is not set', () => {
    expect(isDemoNoAudioFadeEnabled()).toBe(false);
  });

  it('returns true when flag is set to "true"', () => {
    localStorage.setItem(FLAG_KEY, 'true');
    expect(isDemoNoAudioFadeEnabled()).toBe(true);
  });

  it('returns false when flag is set to another value', () => {
    localStorage.setItem(FLAG_KEY, '1');
    expect(isDemoNoAudioFadeEnabled()).toBe(false);
  });

  it('returns false when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('storage unavailable');
      },
      clear: () => {},
    });
    try {
      expect(isDemoNoAudioFadeEnabled()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
