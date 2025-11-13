/**
 * Secret Settings Module - Settings Page Component
 *
 * A modal/page that displays feature flags and custom settings
 * for advanced users and developers.
 */

import type { SecretSettingsProps } from './types';
import { useFeatureFlags } from './useFeatureFlags';
import { useCustomSettings } from './useCustomSettings';
import styles from './SecretSettings.module.css';

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
  const { flags, toggleFlag, resetFlags } = useFeatureFlags();
  const { settings, updateSetting, resetSettings } = useCustomSettings();

  if (!isVisible) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="document"
        aria-label="Secret Settings Menu"
      >
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>🔧 Secret Settings</h1>
          <button
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
            <p className={styles.sectionDescription}>
              Adjust advanced parameters and preferences.
            </p>

            {settings.length > 0 ? (
              <>
                <div className={styles.settingList}>
                  {settings.map((setting) => (
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
                              value={setting.value as number}
                              onChange={(e) => updateSetting(setting.id, parseInt(e.target.value))}
                              className={styles.settingRange}
                            />
                            <span className={styles.settingValue}>{setting.value}</span>
                          </div>
                        )}

                        {setting.type === 'select' && (
                          <div className={styles.settingControl}>
                            <select
                              value={setting.value as string}
                              onChange={(e) => updateSetting(setting.id, e.target.value)}
                              className={styles.settingSelect}
                            >
                              {setting.options?.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {setting.type === 'boolean' && (
                          <div className={styles.settingControl}>
                            <input
                              type="checkbox"
                              checked={setting.value as boolean}
                              onChange={(e) => updateSetting(setting.id, e.target.checked)}
                              className={styles.flagCheckbox}
                            />
                          </div>
                        )}
                      </label>
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
