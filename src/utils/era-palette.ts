/**
 * Era Palette System
 *
 * Maps concert year to a gig-poster color palette.
 * Applied as CSS custom properties on the document root when a concert is matched.
 * Reverted to the default dead-signal palette when scanning resumes.
 */

export interface EraPalette {
  bg: string;
  primary: string;
  accent: string;
}

const ERA_PALETTES: { readonly [key: string]: EraPalette } = {
  pre70: { bg: '#1a1000', primary: '#e8c84a', accent: '#8b3a2a' },
  seventies: { bg: '#0f0018', primary: '#e05c1a', accent: '#9b2d9b' },
  eighties: { bg: '#000814', primary: '#ff2d78', accent: '#00d4ff' },
  nineties: { bg: '#0a0a0a', primary: '#f0f0e8', accent: '#cc1a1a' },
  aughts: { bg: '#000a00', primary: '#00ff41', accent: '#00cc33' },
  tens: { bg: '#111010', primary: '#c8b8a0', accent: '#b84a1a' },
  twenties: { bg: '#080808', primary: '#f5f5f5', accent: '#ff6b35' },
} as const;

function getEraKey(year: number): string {
  if (year < 1970) return 'pre70';
  if (year < 1980) return 'seventies';
  if (year < 1990) return 'eighties';
  if (year < 2000) return 'nineties';
  if (year < 2010) return 'aughts';
  if (year < 2020) return 'tens';
  return 'twenties';
}

export function getEraPalette(year: number): EraPalette {
  return ERA_PALETTES[getEraKey(year)];
}

export function applyEraPalette(concertDate: string): void {
  const year = new Date(concertDate).getFullYear();
  const palette = getEraPalette(year);
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
