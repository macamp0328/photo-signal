/**
 * @deprecated This file is deprecated. Import from `@/modules/secret-settings` instead.
 *
 * Old:
 * ```tsx
 * import { useFeatureFlags } from './contexts';
 * const { isTestMode, isGrayscaleMode } = useFeatureFlags();
 * ```
 *
 * New:
 * ```tsx
 * import { useFeatureFlags } from './modules/secret-settings';
 * const { isEnabled } = useFeatureFlags();
 * if (isEnabled('test-mode')) { }
 * if (isEnabled('grayscale-mode')) { }
 * ```
 *
 * See MIGRATION.md for complete migration guide.
 */

// Re-export for backwards compatibility
export { useFeatureFlags } from '../modules/secret-settings';
