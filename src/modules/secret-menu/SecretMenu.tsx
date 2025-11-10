import type { SecretMenuProps } from './types';

/**
 * Secret Menu Component
 *
 * A hidden modal that can be activated by triple-tapping in the center of the screen.
 * Currently contains placeholder sections for feature flags and custom settings.
 *
 * Future developers can add actual feature flags and settings by:
 * 1. Adding state management for flags/settings
 * 2. Implementing UI controls (toggles, inputs, etc.)
 * 3. Persisting settings to localStorage or a backend
 * 4. Reading flags/settings in relevant components
 *
 * See README.md for detailed extension guide.
 */
export function SecretMenu({ isOpen, onClose }: SecretMenuProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-70 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 
                   md:w-full md:max-w-2xl bg-white rounded-lg shadow-2xl z-50 flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="secret-menu-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2
            id="secret-menu-title"
            className="text-2xl font-bold text-gray-900"
          >
            ⚙️ Developer Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
            aria-label="Close menu"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Placeholder: Feature Flags Section */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              🚩 Feature Flags
              <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Coming Soon
              </span>
            </h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">
                Feature flags allow you to enable/disable experimental features
                without code changes.
              </p>
              <p className="text-xs text-gray-500 italic">
                No feature flags configured yet. See README.md for
                implementation guide.
              </p>
            </div>
          </section>

          {/* Placeholder: Custom Settings Section */}
          <section>
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              🎛️ Custom Settings
              <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Coming Soon
              </span>
            </h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">
                Customize app behavior, adjust detection sensitivity, and more.
              </p>
              <p className="text-xs text-gray-500 italic">
                No custom settings configured yet. See README.md for
                implementation guide.
              </p>
            </div>
          </section>

          {/* Help Text */}
          <section className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              📚 For Developers
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              This secret menu is activated by triple-tapping in the center of
              the screen. To add feature flags or settings, see{' '}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">
                src/modules/secret-menu/README.md
              </code>{' '}
              for a complete implementation guide with examples.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 
                     transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
