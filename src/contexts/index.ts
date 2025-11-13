/**
 * Contexts Module
 *
 * Re-exports feature flags from the secret-settings module.
 * The old FeatureFlagContext has been removed in favor of the
 * secret-settings module's useFeatureFlags hook.
 *
 * @deprecated Import directly from '@/modules/secret-settings' instead
 */

export { useFeatureFlags } from '../modules/secret-settings';
