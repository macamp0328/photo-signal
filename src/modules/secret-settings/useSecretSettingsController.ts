import { useCallback } from 'react';
import { useFeatureFlags } from './useFeatureFlags';

const SEND_IT_RELOAD_DELAY_MS = 100;

export function useSecretSettingsController(onClose: () => void) {
  const { flags, toggleFlag, isEnabled } = useFeatureFlags();

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
  };
}
