import { afterEach, describe, expect, it } from 'vitest';
import {
  applyExifVisualCharacter,
  parseAperture,
  parseIso,
  parseShutterSpeed,
  resetExifVisualCharacter,
} from './exif-visual';
import type { Concert } from '../types';

// Minimal Concert stub
function makeConcert(overrides: Partial<Concert> = {}): Concert {
  return {
    id: 1,
    band: 'Test Band',
    venue: 'Test Venue',
    date: '2025-03-15T17:00:00-05:00',
    audioFile: 'test.opus',
    ...overrides,
  };
}

describe('parseIso', () => {
  it('parses plain numeric string', () => {
    expect(parseIso('800')).toBe(800);
  });

  it('parses ISO-prefixed string', () => {
    expect(parseIso('ISO 1600')).toBe(1600);
  });

  it('parses ISO with no space', () => {
    expect(parseIso('ISO3200')).toBe(3200);
  });

  it('returns null for undefined', () => {
    expect(parseIso(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseIso('')).toBeNull();
  });

  it('returns null for non-numeric string', () => {
    expect(parseIso('auto')).toBeNull();
  });

  it('parses ISO 100', () => {
    expect(parseIso('100')).toBe(100);
  });

  it('parses ISO 6400', () => {
    expect(parseIso('6400')).toBe(6400);
  });
});

describe('parseAperture', () => {
  it('parses f/2.8 format', () => {
    expect(parseAperture('f/2.8')).toBe(2.8);
  });

  it('parses F/2.8 uppercase', () => {
    expect(parseAperture('F/2.8')).toBe(2.8);
  });

  it('parses f/1.8', () => {
    expect(parseAperture('f/1.8')).toBe(1.8);
  });

  it('parses f/8 without decimal', () => {
    expect(parseAperture('f/8')).toBe(8);
  });

  it('parses bare numeric string', () => {
    expect(parseAperture('4.0')).toBe(4.0);
  });

  it('returns null for undefined', () => {
    expect(parseAperture(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseAperture('')).toBeNull();
  });

  it('returns null for non-numeric string', () => {
    expect(parseAperture('auto')).toBeNull();
  });
});

describe('parseShutterSpeed', () => {
  it('parses fraction format 1/30', () => {
    expect(parseShutterSpeed('1/30')).toBeCloseTo(1 / 30);
  });

  it('parses fraction format 1/1000', () => {
    expect(parseShutterSpeed('1/1000')).toBeCloseTo(0.001);
  });

  it('parses fraction format 1/15', () => {
    expect(parseShutterSpeed('1/15')).toBeCloseTo(1 / 15);
  });

  it('parses decimal format 0.5', () => {
    expect(parseShutterSpeed('0.5')).toBe(0.5);
  });

  it('parses decimal with s suffix', () => {
    expect(parseShutterSpeed('0.5s')).toBe(0.5);
  });

  it('parses integer seconds', () => {
    expect(parseShutterSpeed('1s')).toBe(1);
  });

  it('returns null for undefined', () => {
    expect(parseShutterSpeed(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseShutterSpeed('')).toBeNull();
  });

  it('returns null for 0 denominator', () => {
    expect(parseShutterSpeed('1/0')).toBeNull();
  });

  it('returns null for non-numeric string', () => {
    expect(parseShutterSpeed('bulb')).toBeNull();
  });
});

describe('applyExifVisualCharacter', () => {
  afterEach(() => {
    resetExifVisualCharacter();
  });

  it('sets --exif-grain-opacity for a known ISO', () => {
    applyExifVisualCharacter(makeConcert({ iso: '800' }));
    const opacity = Number(document.documentElement.style.getPropertyValue('--exif-grain-opacity'));
    expect(opacity).toBeGreaterThan(0.02);
    expect(opacity).toBeLessThanOrEqual(0.12);
  });

  it('clamps grain opacity at 0.12 for very high ISO', () => {
    applyExifVisualCharacter(makeConcert({ iso: '6400' }));
    const opacity = Number(document.documentElement.style.getPropertyValue('--exif-grain-opacity'));
    expect(opacity).toBe(0.12);
  });

  it('clamps grain opacity at 0.02 for very low ISO', () => {
    applyExifVisualCharacter(makeConcert({ iso: '50' }));
    const opacity = Number(document.documentElement.style.getPropertyValue('--exif-grain-opacity'));
    expect(opacity).toBe(0.02);
  });

  it('sets --exif-blur-depth for a known aperture', () => {
    applyExifVisualCharacter(makeConcert({ aperture: 'f/2.8' }));
    const blur = document.documentElement.style.getPropertyValue('--exif-blur-depth');
    expect(blur).toMatch(/^\d+(\.\d+)?px$/);
  });

  it('sets wider blur for wide aperture (f/1.8)', () => {
    applyExifVisualCharacter(makeConcert({ aperture: 'f/1.8' }));
    const blur = document.documentElement.style.getPropertyValue('--exif-blur-depth');
    expect(parseFloat(blur)).toBe(14);
  });

  it('sets narrower blur for narrow aperture (f/8)', () => {
    applyExifVisualCharacter(makeConcert({ aperture: 'f/8' }));
    const blur = document.documentElement.style.getPropertyValue('--exif-blur-depth');
    expect(parseFloat(blur)).toBeLessThanOrEqual(2);
  });

  it('sets --exif-transition-scale for a known shutter speed', () => {
    applyExifVisualCharacter(makeConcert({ shutterSpeed: '1/60' }));
    const scale = Number(
      document.documentElement.style.getPropertyValue('--exif-transition-scale')
    );
    expect(scale).toBeGreaterThanOrEqual(0.6);
    expect(scale).toBeLessThanOrEqual(1.4);
  });

  it('sets fast transition scale for fast shutter speed', () => {
    applyExifVisualCharacter(makeConcert({ shutterSpeed: '1/1000' }));
    const scale = Number(
      document.documentElement.style.getPropertyValue('--exif-transition-scale')
    );
    expect(scale).toBe(0.6);
  });

  it('sets slow transition scale for slow shutter speed', () => {
    applyExifVisualCharacter(makeConcert({ shutterSpeed: '1/15' }));
    const scale = Number(
      document.documentElement.style.getPropertyValue('--exif-transition-scale')
    );
    expect(scale).toBe(1.4);
  });

  it('leaves CSS vars unset when no EXIF fields present', () => {
    applyExifVisualCharacter(makeConcert({}));
    expect(document.documentElement.style.getPropertyValue('--exif-grain-opacity')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--exif-blur-depth')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--exif-transition-scale')).toBe('');
  });

  it('leaves --exif-grain-opacity unset for unrecognised ISO format', () => {
    applyExifVisualCharacter(makeConcert({ iso: 'auto' }));
    expect(document.documentElement.style.getPropertyValue('--exif-grain-opacity')).toBe('');
  });

  it('sets all three vars when all EXIF fields are present', () => {
    applyExifVisualCharacter(makeConcert({ iso: '800', aperture: 'f/2.8', shutterSpeed: '1/60' }));
    expect(document.documentElement.style.getPropertyValue('--exif-grain-opacity')).not.toBe('');
    expect(document.documentElement.style.getPropertyValue('--exif-blur-depth')).not.toBe('');
    expect(document.documentElement.style.getPropertyValue('--exif-transition-scale')).not.toBe('');
  });

  it('clears stale vars when next concert has no EXIF fields', () => {
    // First match sets all three vars
    applyExifVisualCharacter(makeConcert({ iso: '800', aperture: 'f/2.8', shutterSpeed: '1/60' }));
    // Second match has no EXIF — stale values must not persist
    applyExifVisualCharacter(makeConcert({}));
    expect(document.documentElement.style.getPropertyValue('--exif-grain-opacity')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--exif-blur-depth')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--exif-transition-scale')).toBe('');
  });

  it('clears only unparseable vars when next concert has partial EXIF', () => {
    // First match sets all three
    applyExifVisualCharacter(makeConcert({ iso: '800', aperture: 'f/2.8', shutterSpeed: '1/60' }));
    // Second match has only ISO — aperture and shutter should revert to :root defaults
    applyExifVisualCharacter(makeConcert({ iso: '3200' }));
    expect(document.documentElement.style.getPropertyValue('--exif-grain-opacity')).not.toBe('');
    expect(document.documentElement.style.getPropertyValue('--exif-blur-depth')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--exif-transition-scale')).toBe('');
  });
});

describe('resetExifVisualCharacter', () => {
  it('removes all three EXIF CSS vars', () => {
    // Set them first
    applyExifVisualCharacter(makeConcert({ iso: '800', aperture: 'f/2.8', shutterSpeed: '1/60' }));

    resetExifVisualCharacter();

    expect(document.documentElement.style.getPropertyValue('--exif-grain-opacity')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--exif-blur-depth')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--exif-transition-scale')).toBe('');
  });

  it('is safe to call when no vars are set', () => {
    expect(() => resetExifVisualCharacter()).not.toThrow();
  });
});
