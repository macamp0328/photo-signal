/**
 * Secret Settings Module - Settings Page Component
 *
 * A modal/page that displays feature flags and custom settings
 * for advanced users and developers.
 */

import type { SecretSettingsProps } from './types';
import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { CONFIG_PROFILE_SETTING_ID, type ConfigProfileId } from './config';
import {
  useSecretSettingsController,
  type ResolvedSettingGroup,
} from './useSecretSettingsController';
import styles from './SecretSettings.module.css';
import type { FeatureFlag } from './types';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

type ConfigProfile = ReturnType<typeof useSecretSettingsController>['currentProfile'];

interface FeatureFlagsSectionProps {
  flags: FeatureFlag[];
  onToggleFlag: (id: string) => void;
  onResetFlags: () => void;
}

function FeatureFlagsSection({ flags, onToggleFlag, onResetFlags }: FeatureFlagsSectionProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>⚡ Feature Flags</h2>
      <p className={styles.sectionDescription}>
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
          <button onClick={onResetFlags} className={styles.resetButton}>
            Reset All Flags
          </button>
        </>
      ) : (
        <div className={styles.placeholder}>
          <p className={styles.placeholderText}>No feature flags configured yet.</p>
        </div>
      )}
    </section>
  );
}

interface CustomSettingsSectionProps {
  settingGroups: ResolvedSettingGroup[];
  currentProfile?: ConfigProfile;
  onSettingValue: (id: string, value: string | number | boolean) => void;
  onProfileSelection: (profileId: ConfigProfileId) => void;
  onResetSettings: () => void;
}

function CustomSettingsSection({
  settingGroups,
  currentProfile,
  onSettingValue,
  onProfileSelection,
  onResetSettings,
}: CustomSettingsSectionProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>⚙️ Custom Settings</h2>
      <p className={styles.sectionDescription}>
        Tune recognition, performance, and appearance behavior.
      </p>

      {settingGroups.length > 0 ? (
        <>
          <div className={styles.settingList}>
            {settingGroups.map((group) => (
              <div key={group.id} className={styles.settingGroup}>
                <div className={styles.settingGroupHeader}>
                  <h3 className={styles.settingGroupTitle}>{group.title}</h3>
                  {group.description && (
                    <p className={styles.settingGroupDescription}>{group.description}</p>
                  )}
                </div>
                <div className={styles.settingGroupItems}>
                  {group.settings.map((setting) => (
                    <div key={setting.id} className={styles.settingItem}>
                      <label className={styles.settingLabel}>
                        <div className={styles.settingInfo}>
                          <span className={styles.settingName}>{setting.name}</span>
                          <span className={styles.settingDescription}>{setting.description}</span>
                          {setting.category && (
                            <span className={styles.settingCategory}>{setting.category}</span>
                          )}
                        </div>

                        {setting.type === 'number' && (
                          <div className={styles.settingControl}>
                            <input
                              type="range"
                              min={setting.min}
                              max={setting.max}
                              step={setting.step ?? 100}
                              value={setting.value as number}
                              onChange={(event) =>
                                onSettingValue(setting.id, parseFloat(event.target.value))
                              }
                              className={styles.settingRange}
                            />
                            <div className={styles.settingValueGroup}>
                              <span className={styles.settingValue}>{setting.value}</span>
                              {setting.unit && (
                                <span className={styles.settingUnit}>{setting.unit}</span>
                              )}
                            </div>
                          </div>
                        )}

                        {setting.type === 'select' && (
                          <div className={styles.settingControl}>
                            <select
                              value={setting.value as string}
                              onChange={(event) =>
                                setting.id === CONFIG_PROFILE_SETTING_ID
                                  ? onProfileSelection(event.target.value as ConfigProfileId)
                                  : onSettingValue(setting.id, event.target.value)
                              }
                              className={styles.settingSelect}
                            >
                              {setting.options?.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {setting.id === CONFIG_PROFILE_SETTING_ID && currentProfile && (
                              <p className={styles.profileHelper}>{currentProfile.description}</p>
                            )}
                          </div>
                        )}

                        {setting.type === 'boolean' && (
                          <div className={styles.settingControl}>
                            <input
                              type="checkbox"
                              checked={setting.value as boolean}
                              onChange={(event) => onSettingValue(setting.id, event.target.checked)}
                              className={styles.flagCheckbox}
                            />
                          </div>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button onClick={onResetSettings} className={styles.resetButton}>
            Reset All Settings
          </button>
        </>
      ) : (
        <div className={styles.placeholder}>
          <p className={styles.placeholderText}>No custom settings configured yet.</p>
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

function DeveloperInfoSection() {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>📚 For Developers</h2>
      <p className={styles.sectionDescription}>
        This module is designed for extensibility. See{' '}
        <code>src/modules/secret-settings/DEVELOPER_GUIDE.md</code> for:
      </p>
      <ul className={styles.devList}>
        <li>How to add new feature flags</li>
        <li>How to add custom settings</li>
        <li>Type definitions and examples</li>
        <li>Best practices for UI integration</li>
      </ul>
    </section>
  );
}

/**
 * Secret Settings Page Component
 *
 * Displays a modal with:
 * - Feature flags (experimental features on/off)
 * - Custom settings (adjustable parameters)
 *
 * @param props - Component props
 * @returns React component
 *
 * @example
 * ```tsx
 * <SecretSettings
 *   isVisible={isOpen}
 *   onClose={() => setIsOpen(false)}
 * />
 * ```
 */
export function SecretSettings({ isVisible, onClose }: SecretSettingsProps) {
  const {
    flags,
    toggleFlag,
    resetFlags,
    isEnabled,
    settingGroups,
    currentProfile,
    setSettingValue,
    handleProfileSelection,
    resetSettings,
    handleSendIt,
  } = useSecretSettingsController(onClose);
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
            <p className={styles.intro}>
              This hidden menu opens with a triple tap in the center of the screen.
            </p>
            <p className={styles.intro}>
              <span
                className={`${styles.modeBadge} ${isEnabled('test-mode') ? styles.modeBadgeTest : styles.modeBadgeProduction}`}
              >
                {isEnabled('test-mode') ? '🧪 Test Mode' : '🎯 Production Mode'}
              </span>
            </p>
          </div>

          <FeatureFlagsSection flags={flags} onToggleFlag={toggleFlag} onResetFlags={resetFlags} />
          <CustomSettingsSection
            settingGroups={settingGroups}
            currentProfile={currentProfile}
            onSettingValue={setSettingValue}
            onProfileSelection={handleProfileSelection}
            onResetSettings={resetSettings}
          />
          <SaveAndReloadSection onSaveAndReload={handleSendIt} />
          <DeveloperInfoSection />
        </div>
      </div>
    </div>
  );
}
