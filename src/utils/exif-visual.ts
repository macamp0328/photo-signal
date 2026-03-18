/**
 * EXIF Visual Character System
 *
 * Derives CSS custom properties from EXIF metadata embedded in a Concert record.
 * Applied at match time so each photo's original shooting conditions bleed into
 * how the matched state is displayed.
 *
 * Mappings:
 *   ISO           → --exif-grain-opacity    (0.02 at ISO 100  → 0.12 at ISO 3200+)
 *   Shutter speed → --exif-transition-scale (0.6× at 1/1000s → 1.4× at 1/15s)
 *
 * All parsers return null for unknown formats; null means "leave CSS default in place".
 */

import type { Concert } from '../types';

/** Parses an ISO string (e.g. "800", "ISO 800", "1600") → numeric value or null. */
export function parseIso(str: string | undefined): number | null {
  if (!str) return null;
  const match = /(\d+)/.exec(str);
  if (!match) return null;
  const val = Number(match[1]);
  return Number.isFinite(val) && val > 0 ? val : null;
}

/** Parses an aperture string (e.g. "f/2.8", "F/2.8", "2.8") → f-number or null. */
export function parseAperture(str: string | undefined): number | null {
  if (!str) return null;
  const match = /^f?\/?(\d+(?:\.\d+)?)/i.exec(str.trim());
  if (!match) return null;
  const val = Number(match[1]);
  return Number.isFinite(val) && val > 0 ? val : null;
}

/**
 * Parses a shutter speed string (e.g. "1/30", "1/1000s", "0.5", "0.5s") → seconds or null.
 * Fraction format ("1/N") is the most common EXIF representation.
 */
export function parseShutterSpeed(str: string | undefined): number | null {
  if (!str) return null;
  const trimmed = str.trim();

  // Fraction format: 1/30, 1/1000
  const fractionMatch = /^(\d+)\/(\d+)/.exec(trimmed);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    if (denominator === 0) return null;
    const val = numerator / denominator;
    return Number.isFinite(val) && val > 0 ? val : null;
  }

  // Decimal format: 0.5, 0.5s, 1s
  const decimalMatch = /^(\d+(?:\.\d+)?)s?$/.exec(trimmed);
  if (decimalMatch) {
    const val = Number(decimalMatch[1]);
    return Number.isFinite(val) && val > 0 ? val : null;
  }

  return null;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function isoToGrainOpacity(iso: number): number {
  // ISO 100 → 0.02, ISO 3200+ → 0.12
  return clamp(0.02 + ((iso - 100) / (3200 - 100)) * 0.1, 0.02, 0.12);
}

function shutterSpeedToTransitionScale(seconds: number): number {
  // 1/1000s (0.001s) → 0.6×, 1/15s (~0.0667s) → 1.4×
  const fastEnd = 1 / 1000;
  const slowEnd = 1 / 15;
  return clamp(0.6 + ((seconds - fastEnd) / (slowEnd - fastEnd)) * 0.8, 0.6, 1.4);
}

/**
 * Reads EXIF fields from a Concert and sets CSS custom properties on <html>
 * to drive EXIF-based visual character. Also sets `data-exif-visual` on <html>
 * so CSS rules can be gated on that attribute — ensuring EXIF-driven styles are
 * fully inert when the feature is disabled. Any vars not derivable from this
 * concert's EXIF are removed so they fall back to :root defaults — preventing
 * a previous match's values from bleeding into the next concert.
 *
 * Note: aperture is stored per-concert and displayed in the UI, but does not
 * currently drive a CSS variable (backdrop-filter blur was removed to avoid
 * obscuring the matched photo display).
 */
export function applyExifVisualCharacter(concert: Concert): void {
  const root = document.documentElement;

  // Enable the CSS gate so EXIF-driven rules (grain, blur, animation) activate.
  root.setAttribute('data-exif-visual', '');

  // Always clear inline vars first so stale values from the previous match don't persist.
  root.style.removeProperty('--exif-grain-opacity');
  root.style.removeProperty('--exif-transition-scale');

  const iso = parseIso(concert.iso);
  if (iso !== null) {
    root.style.setProperty('--exif-grain-opacity', isoToGrainOpacity(iso).toFixed(4));
  }

  const shutterSpeed = parseShutterSpeed(concert.shutterSpeed);
  if (shutterSpeed !== null) {
    root.style.setProperty(
      '--exif-transition-scale',
      shutterSpeedToTransitionScale(shutterSpeed).toFixed(4)
    );
  }
}

/**
 * Removes all EXIF visual character CSS vars and the `data-exif-visual` gate
 * attribute, fully restoring pre-EXIF visual defaults.
 */
export function resetExifVisualCharacter(): void {
  const root = document.documentElement;
  root.removeAttribute('data-exif-visual');
  root.style.removeProperty('--exif-grain-opacity');
  root.style.removeProperty('--exif-transition-scale');
}
