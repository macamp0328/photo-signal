import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getUserType, setUserType, clearUserType, isDemoUser } from './userType';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getUserType', () => {
  it('returns null when nothing is stored', () => {
    expect(getUserType()).toBeNull();
  });

  it('returns "gallery" when stored', () => {
    window.localStorage.setItem('photo-signal-user-type', 'gallery');
    expect(getUserType()).toBe('gallery');
  });

  it('returns "demo" when stored', () => {
    window.localStorage.setItem('photo-signal-user-type', 'demo');
    expect(getUserType()).toBe('demo');
  });

  it('returns null for invalid values', () => {
    window.localStorage.setItem('photo-signal-user-type', 'admin');
    expect(getUserType()).toBeNull();
  });

  it('returns null for empty string', () => {
    window.localStorage.setItem('photo-signal-user-type', '');
    expect(getUserType()).toBeNull();
  });

  it('returns null when localStorage getItem fails', () => {
    const getItemSpy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(getUserType()).toBeNull();
    getItemSpy.mockRestore();
  });
});

describe('setUserType', () => {
  it('persists gallery user type', () => {
    setUserType('gallery');
    expect(window.localStorage.getItem('photo-signal-user-type')).toBe('gallery');
  });

  it('persists demo user type', () => {
    setUserType('demo');
    expect(window.localStorage.getItem('photo-signal-user-type')).toBe('demo');
  });

  it('overwrites previous value', () => {
    setUserType('gallery');
    setUserType('demo');
    expect(window.localStorage.getItem('photo-signal-user-type')).toBe('demo');
  });

  it('does not throw when localStorage setItem fails', () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => setUserType('demo')).not.toThrow();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to persist user type to localStorage:',
      expect.any(Error)
    );
    setItemSpy.mockRestore();
  });
});

describe('clearUserType', () => {
  it('removes stored user type', () => {
    setUserType('demo');
    clearUserType();
    expect(getUserType()).toBeNull();
  });

  it('is safe to call when nothing is stored', () => {
    expect(() => clearUserType()).not.toThrow();
  });

  it('does not throw when localStorage removeItem fails', () => {
    const removeItemSpy = vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => clearUserType()).not.toThrow();
    removeItemSpy.mockRestore();
  });
});

describe('isDemoUser', () => {
  it('returns false when nothing is stored', () => {
    expect(isDemoUser()).toBe(false);
  });

  it('returns false for gallery user', () => {
    setUserType('gallery');
    expect(isDemoUser()).toBe(false);
  });

  it('returns true for demo user', () => {
    setUserType('demo');
    expect(isDemoUser()).toBe(true);
  });
});
