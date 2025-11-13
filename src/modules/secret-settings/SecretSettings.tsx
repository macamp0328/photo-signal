/**
 * Secret Settings Module - Settings Page Component
 *
 * A modal/page that displays feature flags and custom settings.
 * Includes test data mode toggle for development and testing.
 */

import type { SecretSettingsProps } from './types';
import { useFeatureFlags } from '../../contexts';
import styles from './SecretSettings.module.css';

/**
 * Secret Settings Page Component
 *
 * Displays a modal with sections for:
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
  const { isTestMode, setTestMode, isGrayscaleMode, setGrayscaleMode } = useFeatureFlags();

  const handleTestModeToggle = () => {
    const newMode = !isTestMode;
    setTestMode(newMode);
  };

  const handleGrayscaleModeToggle = () => {
    const newMode = !isGrayscaleMode;
    setGrayscaleMode(newMode);
  };

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
            <p className={styles.intro}>
              <span
                className={`${styles.modeBadge} ${isTestMode ? styles.modeBadgeTest : styles.modeBadgeProduction}`}
              >
                {isTestMode ? '🧪 Test Mode' : '🎯 Production Mode'}
              </span>
            </p>
          </div>

          {/* Feature Flags Section */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>⚡ Feature Flags</h2>
            <p className={styles.sectionDescription}>Toggle experimental features on or off.</p>

            {/* Test Data Mode Toggle */}
            <div className={styles.featureFlagItem}>
              <div className={styles.featureFlagInfo}>
                <h3 className={styles.featureFlagName}>Test Data Mode</h3>
                <p className={styles.featureFlagDescription}>
                  Use test data from <code>assets/test-*</code> directories instead of production
                  data. Perfect for testing with mobile devices using the provided test images.
                </p>
              </div>
              <label className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  checked={isTestMode}
                  onChange={handleTestModeToggle}
                  aria-label="Toggle test data mode"
                />
                <span className={styles.slider}></span>
              </label>
            </div>

            {/* Grayscale Conversion Toggle */}
            <div className={styles.featureFlagItem}>
              <div className={styles.featureFlagInfo}>
                <h3 className={styles.featureFlagName}>Grayscale Conversion</h3>
                <p className={styles.featureFlagDescription}>
                  Convert camera frames to black and white before photo recognition. May improve
                  accuracy since printed reference photos are monochrome, and can reduce noise in
                  low-light conditions.
                </p>
              </div>
              <label className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  checked={isGrayscaleMode}
                  onChange={handleGrayscaleModeToggle}
                  aria-label="Toggle grayscale conversion mode"
                />
                <span className={styles.slider}></span>
              </label>
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
