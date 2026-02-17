/**
 * Secret Settings Module - Settings Page Component
 *
 * A modal/page that displays feature flags and custom settings
 * for advanced users and developers.
 */

import type { SecretSettingsProps } from './types';
import { useFeatureFlags } from './useFeatureFlags';
import { useCustomSettings } from './useCustomSettings';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { CONFIG_PROFILES, CONFIG_PROFILE_SETTING_ID, type ConfigProfileId } from './config';
import styles from './SecretSettings.module.css';
import type { CustomSetting } from './types';

const SEND_IT_RELOAD_DELAY_MS = 100;

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

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
  const { flags, toggleFlag, resetFlags, isEnabled, setFlagState } = useFeatureFlags();
  const { settings, updateSetting, resetSettings, getSetting } = useCustomSettings();
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const currentProfileId = getSetting<ConfigProfileId>(CONFIG_PROFILE_SETTING_ID) ?? 'custom';
  const recognitionMode =
    getSetting<'perceptual' | 'orb' | 'parallel'>('recognition-mode') ?? 'perceptual';
  const currentProfile = useMemo(() => {
    return CONFIG_PROFILES.find((profile) => profile.id === currentProfileId);
  }, [currentProfileId]);

  const settingMap = useMemo(
    () => new Map(settings.map((setting) => [setting.id, setting])),
    [settings]
  );

  const isSettingVisible = useCallback(
    (setting?: CustomSetting | undefined) => {
      if (!setting) {
        return false;
      }

      if (setting.engines && setting.engines.length > 0) {
        return setting.engines.includes(recognitionMode);
      }

      return true;
    },
    [recognitionMode]
  );

  const settingGroups = useMemo(() => {
    const groups: Array<{
      id: string;
      title: string;
      description?: string;
      settingIds: string[];
    }> = [
      {
        id: 'profiles',
        title: 'Profiles',
        description: 'Pick a preset or stay on Custom to tune every parameter.',
        settingIds: [CONFIG_PROFILE_SETTING_ID],
      },
      {
        id: 'engine',
        title: 'Recognition Engine',
        description: 'Choose which recognition pipeline to run.',
        settingIds: ['recognition-mode'],
      },
      {
        id: 'perceptual',
        title: 'Perceptual Hash Tuning',
        description: 'Fine-tune perceptual hash matching behavior.',
        settingIds: ['hash-algorithm', 'similarity-threshold'],
      },
      {
        id: 'parallel',
        title: 'Parallel Voting',
        description: 'Tune weighted voting across the multi-engine pipeline.',
        settingIds: [
          'parallel-recognition-enabled',
          'parallel-dhash-weight',
          'parallel-phash-weight',
          'parallel-orb-weight',
          'parallel-min-confidence',
        ],
      },
      {
        id: 'orb',
        title: 'ORB Feature Matching',
        description: 'Adjust ORB feature detection and matching parameters.',
        settingIds: [
          'orb-max-features',
          'orb-fast-threshold',
          'orb-min-match-count',
          'orb-match-ratio-threshold',
        ],
      },
      {
        id: 'timing',
        title: 'Timing & Performance',
        description: 'How long to wait for a steady frame and how often to scan.',
        settingIds: ['recognition-delay', 'recognition-check-interval'],
      },
      {
        id: 'frame-quality',
        title: 'Frame Quality Filters',
        description: 'Skip bad frames with glare, blur, or low confidence.',
        settingIds: [
          'sharpness-threshold',
          'glare-threshold',
          'glare-percentage-threshold',
          'rectangle-detection-confidence-threshold',
        ],
      },
      {
        id: 'appearance',
        title: 'Look & Feel',
        description: 'Visual and UI polish.',
        settingIds: ['theme-mode', 'ui-style'],
      },
    ];

    return groups
      .map((group) => ({
        ...group,
        settings: group.settingIds
          .map((settingId) => settingMap.get(settingId))
          .filter(isSettingVisible) as CustomSetting[],
      }))
      .filter((group) => group.settings.length > 0);
  }, [isSettingVisible, settingMap]);

  const handleSendIt = useCallback(() => {
    // Close the menu first (provides immediate feedback)
    onClose();

    // Reload page after short delay (100ms) to show close animation
    // Note: We don't track this timeout because we want it to execute
    // even if the component unmounts (which happens when onClose is called)
    window.setTimeout(() => {
      window.location.reload();
    }, SEND_IT_RELOAD_DELAY_MS);
  }, [onClose]);

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

  const setSettingValue = useCallback(
    (id: string, value: string | number | boolean, options?: { fromProfile?: boolean }) => {
      updateSetting(id, value);

      if (!options?.fromProfile && id !== CONFIG_PROFILE_SETTING_ID) {
        updateSetting(CONFIG_PROFILE_SETTING_ID, 'custom');
      }
    },
    [updateSetting]
  );

  const handleProfileSelection = useCallback(
    (profileId: ConfigProfileId) => {
      const profile = CONFIG_PROFILES.find((p) => p.id === profileId);

      if (!profile || profile.id === 'custom') {
        setSettingValue(CONFIG_PROFILE_SETTING_ID, 'custom', { fromProfile: true });
        return;
      }

      Object.entries(profile.settings).forEach(([settingId, value]) => {
        if (value !== undefined) {
          setSettingValue(settingId, value, { fromProfile: true });
        }
      });

      if (profile.featureFlags) {
        Object.entries(profile.featureFlags).forEach(([flagId, enabled]) => {
          if (typeof enabled === 'boolean') {
            setFlagState(flagId, enabled);
          }
        });
      }

      setSettingValue(CONFIG_PROFILE_SETTING_ID, profileId, { fromProfile: true });
    },
    [setFlagState, setSettingValue]
  );

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
              This hidden menu is activated by triple-tapping in the center of the screen. It's
              designed to hold feature flags and custom settings for advanced users and developers.
            </p>
            <p className={styles.intro}>
              <span
                className={`${styles.modeBadge} ${isEnabled('test-mode') ? styles.modeBadgeTest : styles.modeBadgeProduction}`}
              >
                {isEnabled('test-mode') ? '🧪 Test Mode' : '🎯 Production Mode'}
              </span>
            </p>
          </div>

          {/* Feature Flags Section */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>⚡ Feature Flags</h2>
            <p className={styles.sectionDescription}>
              Toggle experimental and creative features on or off.
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
                          onChange={() => toggleFlag(flag.id)}
                          className={styles.flagCheckbox}
                        />
                        <div className={styles.flagInfo}>
                          <span className={styles.flagName}>{flag.name}</span>
                          <span className={styles.flagDescription}>{flag.description}</span>
                          {flag.category && (
                            <span className={styles.flagCategory}>{flag.category}</span>
                          )}
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
                <button onClick={resetFlags} className={styles.resetButton}>
                  Reset All Flags
                </button>
              </>
            ) : (
              <div className={styles.placeholder}>
                <p className={styles.placeholderText}>No feature flags configured yet.</p>
              </div>
            )}
          </section>

          {/* Custom Settings Section */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>⚙️ Custom Settings</h2>
            <p className={styles.sectionDescription}>Adjust advanced parameters and preferences.</p>

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
                                <span className={styles.settingDescription}>
                                  {setting.description}
                                </span>
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
                                    onChange={(e) =>
                                      setSettingValue(setting.id, parseFloat(e.target.value))
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
                                    onChange={(e) =>
                                      setting.id === CONFIG_PROFILE_SETTING_ID
                                        ? handleProfileSelection(e.target.value as ConfigProfileId)
                                        : setSettingValue(setting.id, e.target.value)
                                    }
                                    className={styles.settingSelect}
                                  >
                                    {setting.options?.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                  {setting.id === CONFIG_PROFILE_SETTING_ID && currentProfile && (
                                    <p className={styles.profileHelper}>
                                      {currentProfile.description}
                                    </p>
                                  )}
                                </div>
                              )}

                              {setting.type === 'boolean' && (
                                <div className={styles.settingControl}>
                                  <input
                                    type="checkbox"
                                    checked={setting.value as boolean}
                                    onChange={(e) => setSettingValue(setting.id, e.target.checked)}
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
                <button onClick={resetSettings} className={styles.resetButton}>
                  Reset All Settings
                </button>
              </>
            ) : (
              <div className={styles.placeholder}>
                <p className={styles.placeholderText}>No custom settings configured yet.</p>
              </div>
            )}
          </section>

          {/* Send It Button */}
          <section className={styles.section}>
            <button
              onClick={handleSendIt}
              className={styles.sendItButton}
              aria-label="Save & Reload - Apply changes and reload page"
              type="button"
            >
              Save & Reload 🚀
            </button>
            <p className={styles.sendItDescription}>
              Settings are saved immediately. Reload applies all changes across the app.
            </p>
          </section>

          {/* Developer Info */}
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
        </div>
      </div>
    </div>
  );
}
