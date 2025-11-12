/**
 * Secret Settings Module - Settings Page Component
 *
 * A modal/page that displays placeholder sections for feature flags
 * and custom settings. This is scaffolding for future implementation.
 */

import type { SecretSettingsProps } from './types';
import styles from './SecretSettings.module.css';

/**
 * Secret Settings Page Component
 *
 * Displays a modal with placeholder sections for:
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
              Toggle experimental features on or off. Feature flags will be added here in future
              updates.
            </p>
            <div className={styles.placeholder}>
              <p className={styles.placeholderText}>No feature flags configured yet.</p>
              <p className={styles.placeholderHint}>
                See the module README for instructions on adding feature flags.
              </p>
            </div>
          </section>

          {/* Custom Settings Section */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>⚙️ Custom Settings</h2>
            <p className={styles.sectionDescription}>
              Adjust advanced parameters and preferences. Custom settings will be added here in
              future updates.
            </p>
            <div className={styles.placeholder}>
              <p className={styles.placeholderText}>No custom settings configured yet.</p>
              <p className={styles.placeholderHint}>
                See the module README for instructions on adding custom settings.
              </p>
            </div>
          </section>

          {/* Developer Info */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>📚 For Developers</h2>
            <p className={styles.sectionDescription}>
              This module is designed for extensibility. See{' '}
              <code>src/modules/secret-settings/README.md</code> for:
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
