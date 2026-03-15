import type { VisualTheme } from './types';

export const VISUAL_THEME_STORAGE_KEY = 'photo-signal-visual-theme';
export const DEFAULT_VISUAL_THEME: VisualTheme = 'stage-light';

const VALID_THEMES: VisualTheme[] = ['stage-light', 'contact-sheet', 'backstage-pass'];

export function isVisualTheme(value: string | null): value is VisualTheme {
  return value !== null && VALID_THEMES.includes(value as VisualTheme);
}

export function getStoredVisualTheme(): VisualTheme {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return DEFAULT_VISUAL_THEME;
  }

  try {
    const storedTheme = window.localStorage.getItem(VISUAL_THEME_STORAGE_KEY);
    return isVisualTheme(storedTheme) ? storedTheme : DEFAULT_VISUAL_THEME;
  } catch {
    return DEFAULT_VISUAL_THEME;
  }
}

export function applyVisualTheme(theme: VisualTheme): void {
  document.documentElement.setAttribute('data-theme', theme);
}

export function persistVisualTheme(theme: VisualTheme): void {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return;
  }

  try {
    window.localStorage.setItem(VISUAL_THEME_STORAGE_KEY, theme);
  } catch {
    // no-op: theme persistence is best effort
  }
}
