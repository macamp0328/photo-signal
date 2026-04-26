import { describe, it, expect, beforeEach } from 'vitest';
import { getUserType, setUserType, clearUserType, isDemoUser } from './userType';

beforeEach(() => {
  window.localStorage.clear();
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
