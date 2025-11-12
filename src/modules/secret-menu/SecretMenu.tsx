import type { SecretMenuProps } from './types';

/**
 * Secret Menu Component
 *
 * A hidden menu activated by triple-tapping the center of the screen.
 * Displays feature flags and custom settings for advanced configuration.
 *
 * Currently contains placeholder sections for:
 * - Feature Flags (experimental features)
 * - Custom Settings (user preferences)
 *
 * These sections are intentionally empty but documented for future expansion.
 */
export function SecretMenu({
  isOpen,
  onClose,
  featureFlags = [],
  customSettings = [],
  onFeatureFlagToggle,
  onSettingChange: _onSettingChange,
}: SecretMenuProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Modal Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="secret-menu-title"
      >
        <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2
              id="secret-menu-title"
              className="text-2xl font-bold text-main-text flex items-center gap-2"
            >
              <span role="img" aria-label="locked">
                🔒
              </span>
              Secret Menu
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
              aria-label="Close secret menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* Feature Flags Section */}
            <section className="mb-8">
              <h3 className="text-lg font-semibold text-main-text mb-2 flex items-center gap-2">
                <span role="img" aria-label="flag">
                  🚩
                </span>
                Feature Flags
              </h3>
              <p className="text-sm text-sub-text mb-4">
                Enable or disable experimental features. These flags allow early access to features
                in development.
              </p>

              {featureFlags.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                  <p className="text-gray-500 text-sm">
                    No feature flags available yet. Check back later for experimental features!
                  </p>
                  <p className="text-gray-400 text-xs mt-2">
                    See{' '}
                    <code className="bg-gray-200 px-1 py-0.5 rounded text-xs">
                      src/modules/secret-menu/README.md
                    </code>{' '}
                    for how to add new flags.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {featureFlags.map((flag) => (
                    <div
                      key={flag.id}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-start justify-between"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-main-text">{flag.name}</div>
                        <div className="text-sm text-sub-text mt-1">{flag.description}</div>
                        {flag.category && (
                          <div className="text-xs text-bonus-text mt-1">
                            Category: {flag.category}
                          </div>
                        )}
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer ml-4">
                        <input
                          type="checkbox"
                          checked={flag.enabled}
                          onChange={(e) => onFeatureFlagToggle?.(flag.id, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Custom Settings Section */}
            <section>
              <h3 className="text-lg font-semibold text-main-text mb-2 flex items-center gap-2">
                <span role="img" aria-label="settings">
                  ⚙️
                </span>
                Custom Settings
              </h3>
              <p className="text-sm text-sub-text mb-4">
                Advanced configuration options for power users. Adjust app behavior to your
                preferences.
              </p>

              {customSettings.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
                  <p className="text-gray-500 text-sm">
                    No custom settings available yet. Stay tuned for advanced configuration options!
                  </p>
                  <p className="text-gray-400 text-xs mt-2">
                    See{' '}
                    <code className="bg-gray-200 px-1 py-0.5 rounded text-xs">
                      src/modules/secret-menu/README.md
                    </code>{' '}
                    for how to add new settings.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customSettings.map((setting) => (
                    <div
                      key={setting.id}
                      className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                    >
                      <div className="font-medium text-main-text">{setting.name}</div>
                      <div className="text-sm text-sub-text mt-1">{setting.description}</div>
                      {setting.category && (
                        <div className="text-xs text-bonus-text mt-1">
                          Category: {setting.category}
                        </div>
                      )}
                      {/* Setting controls would go here based on setting.type */}
                      <div className="mt-2 text-xs text-gray-400">
                        Type: {setting.type} | Current: {String(setting.value)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              This is a hidden menu. Triple-tap the center of the screen to access it anytime.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
