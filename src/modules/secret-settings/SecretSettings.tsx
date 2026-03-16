/**
 * Secret Settings Module - Settings Page Component
 *
 * A modal/page that displays feature flags for advanced users and developers.
 * Opened via the Settings button.
 */

import type { SecretSettingsProps } from './types';
import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { useSecretSettingsController } from './useSecretSettingsController';
import styles from './SecretSettings.module.css';
import type { FeatureFlag } from './types';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
const DIALOG_DESCRIPTION_ID = 'secret-settings-intro-description';

interface FeatureFlagsSectionProps {
  flags: FeatureFlag[];
  onToggleFlag: (id: string) => void;
}

function FeatureFlagsSection({ flags, onToggleFlag }: FeatureFlagsSectionProps) {
  return (
    <section className={styles.section} aria-describedby="feature-flags-description">
      <h2 className={styles.sectionTitle}>⚡ Feature Flags</h2>
      <p id="feature-flags-description" className={styles.sectionDescription}>
        Toggle feature flags used for experiments and troubleshooting.
      </p>

      {flags.length > 0 ? (
        <>
          <div className={styles.flagList}>
            {flags.map((flag) => (
              <div key={flag.id} className={styles.flagItem}>
                <label className={styles.flagLabel}>
                  <input
                    type="checkbox"
                    checked={flag.enabled}
                    onChange={() => onToggleFlag(flag.id)}
                    className={styles.flagCheckbox}
                  />
                  <div className={styles.flagInfo}>
                    <span className={styles.flagName}>{flag.name}</span>
                    <span className={styles.flagDescription}>{flag.description}</span>
                    {flag.category && <span className={styles.flagCategory}>{flag.category}</span>}
                  </div>
                </label>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.placeholder}>
          <p className={styles.placeholderText}>No feature flags configured yet.</p>
        </div>
      )}
    </section>
  );
}

interface SaveAndReloadSectionProps {
  onSaveAndReload: () => void;
}

function SaveAndReloadSection({ onSaveAndReload }: SaveAndReloadSectionProps) {
  return (
    <section className={styles.section}>
      <button
        onClick={onSaveAndReload}
        className={styles.sendItButton}
        aria-label="Save & Reload - Apply changes and reload page"
        type="button"
      >
        Save & Reload 🚀
      </button>
      <p className={styles.sendItDescription}>
        Settings save instantly. Reload applies runtime-only changes.
      </p>
    </section>
  );
}

/**
 * Secret Settings Page Component
 *
 * Displays a modal with feature flags (experimental features on/off).
 * All recognition parameters are hardcoded and self-tune at runtime.
 *
 * @example
 * ```tsx
 * <SecretSettings
 *   isVisible={isOpen}
 *   onClose={() => setIsOpen(false)}
 * />
 * ```
 */
export function SecretSettings({ isVisible, onClose, onForceMatch }: SecretSettingsProps) {
  const { flags, toggleFlag, handleSendIt } = useSecretSettingsController(onClose);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !modalRef.current) {
        return;
      }

      const focusableElements = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1);

      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    return () => {
      previousFocusRef.current?.focus();
    };
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="secret-settings-title"
      aria-describedby={DIALOG_DESCRIPTION_ID}
    >
      <div
        ref={modalRef}
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="document"
        aria-label="Secret Settings Menu"
      >
        {/* Header */}
        <div className={styles.header}>
          <h1 id="secret-settings-title" className={styles.title}>
            🔧 Secret Settings
          </h1>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close settings menu"
            type="button"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Introduction */}
          <div className={styles.section}>
            <p id={DIALOG_DESCRIPTION_ID} className={styles.intro}>
              Tap the Settings button in the header — available after activating the camera — to
              return here at any time.
            </p>
          </div>

          <FeatureFlagsSection flags={flags} onToggleFlag={toggleFlag} />

          {onForceMatch && (
            <section className={styles.section}>
              <button
                type="button"
                className={styles.sendItButton}
                aria-label="Force a photo match for testing"
                onClick={() => {
                  onForceMatch();
                  onClose();
                }}
              >
                Force Match 🎯
              </button>
            </section>
          )}

          <SaveAndReloadSection onSaveAndReload={handleSendIt} />
        </div>
      </div>
    </div>
  );
}
