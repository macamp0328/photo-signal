import { describe, it, expect, beforeEach } from 'vitest';
import { getEraPalette, applyEraPalette, resetToDeadSignal } from './era-palette';

describe('getEraPalette', () => {
  it('returns pre-70s palette for years before 1970', () => {
    const palette = getEraPalette(1969);
    expect(palette.primary).toBe('#e8c84a');
  });

  it('returns 70s palette for years 1970–1979', () => {
    expect(getEraPalette(1970).primary).toBe('#e05c1a');
    expect(getEraPalette(1979).primary).toBe('#e05c1a');
  });

  it('returns 80s palette for years 1980–1989', () => {
    expect(getEraPalette(1980).primary).toBe('#ff2d78');
    expect(getEraPalette(1989).primary).toBe('#ff2d78');
  });

  it('returns 90s palette for years 1990–1999', () => {
    expect(getEraPalette(1990).primary).toBe('#f0f0e8');
    expect(getEraPalette(1999).primary).toBe('#f0f0e8');
  });

  it('returns 00s palette for years 2000–2009', () => {
    expect(getEraPalette(2000).primary).toBe('#00ff41');
    expect(getEraPalette(2009).primary).toBe('#00ff41');
  });

  it('returns 10s palette for years 2010–2019', () => {
    expect(getEraPalette(2010).primary).toBe('#c8b8a0');
    expect(getEraPalette(2019).primary).toBe('#c8b8a0');
  });

  it('returns 20s+ palette for 2020 and beyond', () => {
    expect(getEraPalette(2020).primary).toBe('#f5f5f5');
    expect(getEraPalette(2030).primary).toBe('#f5f5f5');
  });

  it('returns an object with bg, primary, and accent', () => {
    const palette = getEraPalette(1985);
    expect(palette).toHaveProperty('bg');
    expect(palette).toHaveProperty('primary');
    expect(palette).toHaveProperty('accent');
  });
});

describe('applyEraPalette', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-state');
    document.documentElement.style.removeProperty('--poster-bg');
    document.documentElement.style.removeProperty('--poster-primary');
    document.documentElement.style.removeProperty('--poster-accent');
  });

  it('sets --poster-* CSS vars on document root', () => {
    applyEraPalette('1985-06-15T00:00:00.000Z');
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--poster-bg')).toBe('#000814');
    expect(root.style.getPropertyValue('--poster-primary')).toBe('#ff2d78');
    expect(root.style.getPropertyValue('--poster-accent')).toBe('#00d4ff');
  });

  it('sets data-state="matched" on document root', () => {
    applyEraPalette('1992-03-01T00:00:00.000Z');
    expect(document.documentElement.getAttribute('data-state')).toBe('matched');
  });

  it('derives year correctly from ISO date string', () => {
    applyEraPalette('1975-01-01T00:00:00.000Z');
    expect(document.documentElement.style.getPropertyValue('--poster-primary')).toBe('#e05c1a');
  });
});

describe('resetToDeadSignal', () => {
  beforeEach(() => {
    document.documentElement.setAttribute('data-state', 'matched');
    document.documentElement.style.setProperty('--poster-bg', '#000814');
    document.documentElement.style.setProperty('--poster-primary', '#ff2d78');
    document.documentElement.style.setProperty('--poster-accent', '#00d4ff');
  });

  it('removes --poster-* CSS vars from document root', () => {
    resetToDeadSignal();
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--poster-bg')).toBe('');
    expect(root.style.getPropertyValue('--poster-primary')).toBe('');
    expect(root.style.getPropertyValue('--poster-accent')).toBe('');
  });

  it('removes data-state attribute from document root', () => {
    resetToDeadSignal();
    expect(document.documentElement.getAttribute('data-state')).toBeNull();
  });

  it('is safe to call when no state has been applied', () => {
    document.documentElement.removeAttribute('data-state');
    expect(() => resetToDeadSignal()).not.toThrow();
  });
});

describe('applyEraPalette + resetToDeadSignal roundtrip', () => {
  it('cleanly transitions from matched back to default', () => {
    applyEraPalette('1984-09-20T00:00:00.000Z');
    expect(document.documentElement.getAttribute('data-state')).toBe('matched');

    resetToDeadSignal();
    expect(document.documentElement.getAttribute('data-state')).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--poster-bg')).toBe('');
  });
});
