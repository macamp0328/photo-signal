import { useCallback } from 'react';
import { useFeatureFlags } from './useFeatureFlags';
import { useState } from 'react';
import type { VisualTheme } from './types';
import { applyVisualTheme, getStoredVisualTheme, persistVisualTheme } from './visual-theme';

const SEND_IT_RELOAD_DELAY_MS = 100;

export function useSecretSettingsController(onClose: () => void) {
  const { flags, toggleFlag, isEnabled } = useFeatureFlags();
  const [visualTheme, setVisualThemeState] = useState<VisualTheme>(() => getStoredVisualTheme());

  const setVisualTheme = useCallback((theme: VisualTheme) => {
    setVisualThemeState(theme);
    persistVisualTheme(theme);
    applyVisualTheme(theme);
  }, []);

  const handleSendIt = useCallback(() => {
    onClose();

    window.setTimeout(() => {
      window.location.reload();
    }, SEND_IT_RELOAD_DELAY_MS);
  }, [onClose]);

  return {
    flags,
    toggleFlag,
    isEnabled,
    handleSendIt,
    visualTheme,
    setVisualTheme,
  };
}
