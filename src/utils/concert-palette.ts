/**
 * Concert Palette System
 *
 * Generates a unique gig-poster color palette from two inputs:
 *   1. Band name  — FNV-1a hash rotates hue within the day's arc
 *   2. Day of week — anchors the hue to a 51° band of the color wheel
 *
 * Every concert gets its own fingerprint. Same band on same day of week
 * always produces the same palette (deterministic). Applied as CSS custom
 * properties on the document root when a concert is matched.
 */

export interface ConcertPalette {
  bg: string;
  primary: string;
  accent: string;
}

// Each day owns a ~51° arc of the 360° color wheel (360 / 7 ≈ 51.4)
const DAY_HUE_BASE = [0, 51, 103, 154, 205, 257, 308] as const; // Sun–Sat

/**
 * Extracts the day of week from an ISO 8601 string using the *source* timezone,
 * not the viewer's local timezone. Concert dates are stored with an explicit
 * offset (e.g. "2025-03-15T17:20:15-05:00"); parsing via new Date().getDay()
 * would return the day in the viewer's locale, which diverges around midnight.
 * Reading YYYY-MM-DD from the string directly and interpreting it as UTC gives
 * the calendar day as intended by the original timezone.
 */
function dayOfWeekFromIso(isoDate: string): number {
  const datePart = isoDate.slice(0, 10); // 'YYYY-MM-DD'
  return new Date(`${datePart}T00:00:00Z`).getUTCDay();
}

/**
 * FNV-1a 32-bit hash — fast, well-distributed, no dependencies.
 * Normalises band name to lowercase + trimmed before hashing.
 */
function hashBandName(name: string): number {
  let h = 2166136261; // FNV offset basis
  const normalised = name.toLowerCase().trim();
  for (let i = 0; i < normalised.length; i++) {
    h ^= normalised.charCodeAt(i);
    h = Math.imul(h, 16777619);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h;
}

/**
 * Derives a generative palette from band name + concert date.
 *
 * Primary hue  = dayBase + (hash % 51)  — band shifts within the day's arc
 * Accent hue   = primary + 137°          — golden angle, maximises wheel contrast
 * Bg hue       = primary + 20°           — slight shift, near-black (5% lightness)
 * Primary L    = 62–72%                  — varied by upper hash bits for extra character
 */
export function getConcertPalette(band: string, date: string): ConcertPalette {
  const hash = hashBandName(band);
  const day = dayOfWeekFromIso(date) as 0 | 1 | 2 | 3 | 4 | 5 | 6;

  const primaryHue = (DAY_HUE_BASE[day] + (hash % 51)) % 360;
  const accentHue = (primaryHue + 137) % 360;
  const bgHue = (primaryHue + 20) % 360;
  const primaryL = 62 + ((hash >>> 8) % 11); // 62–72%

  return {
    bg: `hsl(${bgHue}, 75%, 5%)`,
    primary: `hsl(${primaryHue}, 100%, ${primaryL}%)`,
    accent: `hsl(${accentHue}, 100%, 58%)`,
  };
}

export function applyConcertPalette(band: string, date: string): void {
  const palette = getConcertPalette(band, date);
  const root = document.documentElement;
  root.style.setProperty('--poster-bg', palette.bg);
  root.style.setProperty('--poster-primary', palette.primary);
  root.style.setProperty('--poster-accent', palette.accent);
  root.setAttribute('data-state', 'matched');
}

export function resetToDeadSignal(): void {
  const root = document.documentElement;
  root.style.removeProperty('--poster-bg');
  root.style.removeProperty('--poster-primary');
  root.style.removeProperty('--poster-accent');
  root.removeAttribute('data-state');
}
