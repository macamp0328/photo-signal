import { useCallback, useMemo } from 'react';
import { useFeatureFlags } from './useFeatureFlags';
import { useCustomSettings } from './useCustomSettings';
import { CONFIG_PROFILES, CONFIG_PROFILE_SETTING_ID, type ConfigProfileId } from './config';
import type { CustomSetting } from './types';

const SEND_IT_RELOAD_DELAY_MS = 100;

interface SettingGroupDefinition {
  id: string;
  title: string;
  description?: string;
  settingIds: string[];
}

export interface ResolvedSettingGroup extends Omit<SettingGroupDefinition, 'settingIds'> {
  settings: CustomSetting[];
}

const SETTING_GROUP_DEFINITIONS: SettingGroupDefinition[] = [
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

export function useSecretSettingsController(onClose: () => void) {
  const { flags, toggleFlag, resetFlags, isEnabled, setFlagState } = useFeatureFlags();
  const { settings, updateSetting, resetSettings, getSetting } = useCustomSettings();

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

  const settingGroups = useMemo<ResolvedSettingGroup[]>(() => {
    return SETTING_GROUP_DEFINITIONS.map((group) => ({
      id: group.id,
      title: group.title,
      description: group.description,
      settings: group.settingIds
        .map((settingId) => settingMap.get(settingId))
        .filter(isSettingVisible) as CustomSetting[],
    })).filter((group) => group.settings.length > 0);
  }, [isSettingVisible, settingMap]);

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
      const profile = CONFIG_PROFILES.find((candidateProfile) => candidateProfile.id === profileId);

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

  const handleSendIt = useCallback(() => {
    onClose();

    window.setTimeout(() => {
      window.location.reload();
    }, SEND_IT_RELOAD_DELAY_MS);
  }, [onClose]);

  return {
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
  };
}
