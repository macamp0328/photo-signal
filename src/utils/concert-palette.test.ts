import { describe, it, expect, beforeEach } from 'vitest';
import { getConcertPalette, applyConcertPalette, resetToDeadSignal } from './concert-palette';

// Helpers ─────────────────────────────────────────────────────────────────────

/** Parse the numeric parts out of an hsl() string. */
function parseHsl(hsl: string): { h: number; s: number; l: number } {
  const m = hsl.match(/hsl\((\d+(?:\.\d+)?),\s*(\d+)%,\s*(\d+)%\)/);
  if (!m) throw new Error(`Not a valid hsl() string: ${hsl}`);
  return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
}

// getConcertPalette ────────────────────────────────────────────────────────────

describe('getConcertPalette', () => {
  it('returns an object with bg, primary, and accent', () => {
    const palette = getConcertPalette('Twin Shadow', '2025-03-15T17:20:15-05:00');
    expect(palette).toHaveProperty('bg');
    expect(palette).toHaveProperty('primary');
    expect(palette).toHaveProperty('accent');
  });

  it('is deterministic — same band + date always produces the same palette', () => {
    const a = getConcertPalette('Ringo Deathstarr', '2022-03-17T13:34:28-05:00');
    const b = getConcertPalette('Ringo Deathstarr', '2022-03-17T13:34:28-05:00');
    expect(a).toEqual(b);
  });

  it('is case- and whitespace-insensitive for band name', () => {
    const a = getConcertPalette('Twin Shadow', '2025-03-15T17:20:15-05:00');
    const b = getConcertPalette('  twin shadow  ', '2025-03-15T17:20:15-05:00');
    expect(a).toEqual(b);
  });

  it('produces different palettes for different bands on the same day', () => {
    const a = getConcertPalette('Jo Alice', '2025-03-15T14:21:24-05:00');
    const b = getConcertPalette('SNACKTIME', '2025-03-15T19:11:16-05:00');
    expect(a.primary).not.toBe(b.primary);
  });

  it('produces different palettes for the same band on different days of the week', () => {
    // Saturday vs Thursday
    const sat = getConcertPalette('Buffalo Rose', '2022-03-19T12:29:09-05:00'); // Saturday
    const thu = getConcertPalette('Buffalo Rose', '2022-03-17T12:29:09-05:00'); // Thursday
    expect(sat.primary).not.toBe(thu.primary);
  });

  it('primary hue falls within the correct day arc (Saturday = base 308°)', () => {
    // Saturday base = 308°; band hash adds 0–50°; wrap at 360°
    const palette = getConcertPalette('Jonny Fritz', '2025-03-22T12:00:00-05:00'); // a Saturday
    const { h } = parseHsl(palette.primary);
    const sat = new Date('2025-03-22T12:00:00-05:00').getDay(); // should be 6
    expect(sat).toBe(6);
    // Primary hue is in [308, 358] (Saturday arc, no wrap in this range)
    expect(h).toBeGreaterThanOrEqual(308);
    expect(h).toBeLessThanOrEqual(358);
  });

  it('primary hue falls within the correct day arc (Wednesday = base 154°)', () => {
    const palette = getConcertPalette('Ramesh', '2025-03-19T16:00:00-05:00'); // a Wednesday
    const { h } = parseHsl(palette.primary);
    expect(h).toBeGreaterThanOrEqual(154);
    expect(h).toBeLessThanOrEqual(204);
  });

  it('bg is always near-black (lightness ≤ 6%)', () => {
    const palette = getConcertPalette('Maz', '2025-03-15T15:30:11-05:00');
    const { l } = parseHsl(palette.bg);
    expect(l).toBeLessThanOrEqual(6);
  });

  it('primary lightness varies between 62–72%', () => {
    const bands = ['Teddy and the Rough Riders', 'Jo Alice', 'Maz', 'Twin Shadow', 'SNACKTIME'];
    for (const band of bands) {
      const { l } = parseHsl(getConcertPalette(band, '2025-03-15T12:00:00-05:00').primary);
      expect(l).toBeGreaterThanOrEqual(62);
      expect(l).toBeLessThanOrEqual(72);
    }
  });

  it('accent hue is approximately 137° offset from primary (golden angle)', () => {
    const palette = getConcertPalette('Twin Shadow', '2025-03-15T17:20:15-05:00');
    const primary = parseHsl(palette.primary);
    const accent = parseHsl(palette.accent);
    const diff = (accent.h - primary.h + 360) % 360;
    expect(diff).toBe(137);
  });
});

// applyConcertPalette ─────────────────────────────────────────────────────────

describe('applyConcertPalette', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-state');
    document.documentElement.style.removeProperty('--poster-bg');
    document.documentElement.style.removeProperty('--poster-primary');
    document.documentElement.style.removeProperty('--poster-accent');
  });

  it('sets --poster-* CSS vars on document root', () => {
    applyConcertPalette('Twin Shadow', '2025-03-15T17:20:15-05:00');
    const root = document.documentElement;
    const expected = getConcertPalette('Twin Shadow', '2025-03-15T17:20:15-05:00');
    expect(root.style.getPropertyValue('--poster-bg')).toBe(expected.bg);
    expect(root.style.getPropertyValue('--poster-primary')).toBe(expected.primary);
    expect(root.style.getPropertyValue('--poster-accent')).toBe(expected.accent);
  });

  it('sets data-state="matched" on document root', () => {
    applyConcertPalette('Jo Alice', '2025-03-15T14:21:24-05:00');
    expect(document.documentElement.getAttribute('data-state')).toBe('matched');
  });
});

// resetToDeadSignal ───────────────────────────────────────────────────────────

describe('resetToDeadSignal', () => {
  beforeEach(() => {
    document.documentElement.setAttribute('data-state', 'matched');
    document.documentElement.style.setProperty('--poster-bg', 'hsl(50, 75%, 5%)');
    document.documentElement.style.setProperty('--poster-primary', 'hsl(50, 100%, 65%)');
    document.documentElement.style.setProperty('--poster-accent', 'hsl(187, 100%, 58%)');
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

// Roundtrip ───────────────────────────────────────────────────────────────────

describe('applyConcertPalette + resetToDeadSignal roundtrip', () => {
  it('cleanly transitions from matched back to default', () => {
    applyConcertPalette('Ringo Deathstarr', '2022-03-17T13:34:28-05:00');
    expect(document.documentElement.getAttribute('data-state')).toBe('matched');

    resetToDeadSignal();
    expect(document.documentElement.getAttribute('data-state')).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--poster-bg')).toBe('');
  });
});
