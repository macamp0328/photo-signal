/**
 * Tests for useSecretSettingsController hook
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSecretSettingsController } from './useSecretSettingsController';
import { CONFIG_PROFILES, CONFIG_PROFILE_SETTING_ID } from './config';

describe('useSecretSettingsController', () => {
  let mockOnClose: () => void;

  beforeEach(() => {
    localStorage.clear();
    mockOnClose = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      expect(result.current.flags).toBeDefined();
      expect(result.current.settingGroups).toBeDefined();
      expect(result.current.currentProfile).toBeDefined();
      expect(result.current.toggleFlag).toBeDefined();
      expect(result.current.resetFlags).toBeDefined();
      expect(result.current.isEnabled).toBeDefined();
      expect(result.current.setSettingValue).toBeDefined();
      expect(result.current.handleProfileSelection).toBeDefined();
      expect(result.current.resetSettings).toBeDefined();
      expect(result.current.handleSendIt).toBeDefined();
    });

    it('should start with custom profile by default', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      expect(result.current.currentProfile?.id).toBe('custom');
    });

    it('should resolve setting groups with correct structure', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      expect(result.current.settingGroups.length).toBeGreaterThan(0);
      result.current.settingGroups.forEach((group) => {
        expect(group).toHaveProperty('id');
        expect(group).toHaveProperty('title');
        expect(group).toHaveProperty('settings');
        expect(Array.isArray(group.settings)).toBe(true);
      });
    });
  });

  describe('Profile Selection', () => {
    it('should apply profile settings when selecting a profile', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      const profile = CONFIG_PROFILES.find((p) => p.id === 'baseline-phash');
      expect(profile).toBeDefined();

      act(() => {
        result.current.handleProfileSelection('baseline-phash');
      });

      expect(result.current.currentProfile?.id).toBe('baseline-phash');
    });

    it('should apply profile feature flags when selecting a profile', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      const profile = CONFIG_PROFILES.find((p) => p.id === 'baseline-phash');
      expect(profile).toBeDefined();
      expect(profile?.featureFlags).toBeDefined();

      act(() => {
        result.current.handleProfileSelection('baseline-phash');
      });

      // Check that rectangle-detection flag is enabled as per baseline-phash profile
      if (profile?.featureFlags?.['rectangle-detection'] !== undefined) {
        expect(result.current.isEnabled('rectangle-detection')).toBe(
          profile.featureFlags['rectangle-detection']
        );
      }
    });

    it('should handle custom profile selection', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      // First select a non-custom profile
      act(() => {
        result.current.handleProfileSelection('baseline-phash');
      });

      expect(result.current.currentProfile?.id).toBe('baseline-phash');

      // Then select custom
      act(() => {
        result.current.handleProfileSelection('custom');
      });

      expect(result.current.currentProfile?.id).toBe('custom');
    });

    it('should apply all settings from a profile', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      const profile = CONFIG_PROFILES.find((p) => p.id === 'baseline-phash');
      expect(profile).toBeDefined();

      act(() => {
        result.current.handleProfileSelection('baseline-phash');
      });

      // Verify the profile is applied
      expect(result.current.currentProfile?.id).toBe('baseline-phash');

      // Check that settings groups reflect the profile settings
      const recognitionGroup = result.current.settingGroups.find((g) => g.id === 'recognition');
      const similaritySetting = recognitionGroup?.settings.find(
        (s) => s.id === 'similarity-threshold'
      );
      expect(similaritySetting?.value).toBe(12);
    });

    it('should handle profile with no feature flags gracefully', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      act(() => {
        result.current.handleProfileSelection('custom');
      });

      expect(result.current.currentProfile?.id).toBe('custom');
    });
  });

  describe('Automatic Switch to Custom Profile', () => {
    it('should switch to custom profile when individual setting changes', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      // First select a profile
      act(() => {
        result.current.handleProfileSelection('baseline-phash');
      });

      expect(result.current.currentProfile?.id).toBe('baseline-phash');

      // Now change an individual setting
      act(() => {
        result.current.setSettingValue('recognition-delay', 2000);
      });

      // Should automatically switch to custom
      expect(result.current.currentProfile?.id).toBe('custom');
    });

    it('should not switch to custom when changing profile setting itself', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      act(() => {
        result.current.handleProfileSelection('baseline-phash');
      });

      expect(result.current.currentProfile?.id).toBe('baseline-phash');

      // Changing to another profile via setSettingValue
      act(() => {
        result.current.setSettingValue(CONFIG_PROFILE_SETTING_ID, 'baseline-phash');
      });

      // Should remain baseline-phash, not custom
      expect(result.current.currentProfile?.id).toBe('baseline-phash');
    });

    it('should not switch to custom when changing from within profile selection', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      act(() => {
        result.current.handleProfileSelection('baseline-phash');
      });

      expect(result.current.currentProfile?.id).toBe('baseline-phash');

      // The profile selection process internally uses setSettingValue with fromProfile flag
      // This should not switch to custom
      act(() => {
        result.current.handleProfileSelection('baseline-phash');
      });

      expect(result.current.currentProfile?.id).toBe('baseline-phash');
    });

    it('should switch to custom for any non-profile setting change', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      act(() => {
        result.current.handleProfileSelection('baseline-phash');
      });

      expect(result.current.currentProfile?.id).toBe('baseline-phash');

      // Change various settings and verify switch to custom each time
      act(() => {
        result.current.setSettingValue('similarity-threshold', 15);
      });

      expect(result.current.currentProfile?.id).toBe('custom');

      // Reset to a profile
      act(() => {
        result.current.handleProfileSelection('baseline-phash');
      });

      expect(result.current.currentProfile?.id).toBe('baseline-phash');

      // Change a different setting
      act(() => {
        result.current.setSettingValue('sharpness-threshold', 120);
      });

      expect(result.current.currentProfile?.id).toBe('custom');
    });
  });

  describe('Setting Visibility Filtering', () => {
    it('should include pHash recognition tuning settings', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      const recognitionGroup = result.current.settingGroups.find((g) => g.id === 'recognition');
      expect(recognitionGroup).toBeDefined();
      expect(recognitionGroup?.settings.some((s) => s.id === 'similarity-threshold')).toBe(true);
    });

    it('should not include legacy engine-specific groups', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      expect(result.current.settingGroups.find((g) => g.id === 'engine')).toBeUndefined();
      expect(result.current.settingGroups.find((g) => g.id === 'perceptual')).toBeUndefined();
      expect(result.current.settingGroups.find((g) => g.id === 'orb')).toBeUndefined();
      expect(result.current.settingGroups.find((g) => g.id === 'parallel')).toBeUndefined();
    });

    it('should keep group structure stable across setting updates', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      const initialGroupIds = result.current.settingGroups.map((group) => group.id);

      act(() => {
        result.current.setSettingValue('similarity-threshold', 16);
      });

      const updatedGroupIds = result.current.settingGroups.map((group) => group.id);
      expect(updatedGroupIds).toEqual(initialGroupIds);
    });
  });

  describe('Setting Group Resolution', () => {
    it('should resolve all setting groups with correct structure', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      result.current.settingGroups.forEach((group) => {
        expect(group.id).toBeDefined();
        expect(group.title).toBeDefined();
        expect(Array.isArray(group.settings)).toBe(true);
        expect(group.settings.length).toBeGreaterThan(0);

        group.settings.forEach((setting) => {
          expect(setting.id).toBeDefined();
          expect(setting.name).toBeDefined();
          expect(setting.type).toBeDefined();
          expect(setting.value).toBeDefined();
        });
      });
    });

    it('should filter out empty groups', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      // All groups should have at least one setting
      result.current.settingGroups.forEach((group) => {
        expect(group.settings.length).toBeGreaterThan(0);
      });
    });

    it('should maintain correct group metadata', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      const profilesGroup = result.current.settingGroups.find((g) => g.id === 'profiles');
      expect(profilesGroup).toBeDefined();
      expect(profilesGroup?.title).toBe('Profiles');
      expect(profilesGroup?.description).toContain('preset');

      const recognitionGroup = result.current.settingGroups.find((g) => g.id === 'recognition');
      expect(recognitionGroup).toBeDefined();
      expect(recognitionGroup?.title).toBe('Recognition Tuning');
    });

    it('should update groups when settings change', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      const initialGroups = result.current.settingGroups;
      expect(initialGroups.length).toBeGreaterThan(0);

      // Change a setting and verify groups are reactive
      act(() => {
        result.current.setSettingValue('similarity-threshold', 18);
      });

      const afterGroups = result.current.settingGroups;

      // Groups should still exist after mode change
      expect(afterGroups.length).toBeGreaterThan(0);

      // Verify groups are reactive to settings changes by checking the updated setting value
      const updatedSimilaritySetting = afterGroups
        .flatMap((group) => group.settings)
        .find((setting) => setting.id === 'similarity-threshold');

      expect(updatedSimilaritySetting).toBeDefined();
      expect(updatedSimilaritySetting?.value).toBe(18);
    });
  });

  describe('handleSendIt Behavior', () => {
    it('should call onClose callback', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      act(() => {
        result.current.handleSendIt();
      });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should trigger reload after delay', () => {
      const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});

      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      act(() => {
        result.current.handleSendIt();
      });

      // Reload should not be called immediately
      expect(reloadSpy).not.toHaveBeenCalled();

      // Advance timers by the delay
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Now reload should be called
      expect(reloadSpy).toHaveBeenCalledTimes(1);

      reloadSpy.mockRestore();
    });

    it('should use correct delay timing', () => {
      const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});

      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      act(() => {
        result.current.handleSendIt();
      });

      // Advance by less than the delay
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Should not have reloaded yet
      expect(reloadSpy).not.toHaveBeenCalled();

      // Advance to exactly 100ms
      act(() => {
        vi.advanceTimersByTime(50);
      });

      // Now it should reload
      expect(reloadSpy).toHaveBeenCalledTimes(1);

      reloadSpy.mockRestore();
    });

    it('should call onClose before reload', () => {
      const reloadSpy = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
      const callOrder: string[] = [];

      const trackedOnClose = () => {
        callOrder.push('onClose');
        mockOnClose();
      };

      const originalSetTimeout = window.setTimeout;
      vi.spyOn(window, 'setTimeout').mockImplementation((callback, delay) => {
        callOrder.push('setTimeout');
        return originalSetTimeout(() => {
          callOrder.push('reload');
          callback();
        }, delay) as unknown as ReturnType<typeof setTimeout>;
      });

      const { result } = renderHook(() => useSecretSettingsController(trackedOnClose));

      act(() => {
        result.current.handleSendIt();
      });

      // onClose should be called first
      expect(callOrder[0]).toBe('onClose');
      expect(callOrder[1]).toBe('setTimeout');

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(callOrder[2]).toBe('reload');

      reloadSpy.mockRestore();
    });
  });

  describe('Integration with Underlying Hooks', () => {
    it('should toggle feature flags via toggleFlag', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      const initialTestModeState = result.current.isEnabled('test-mode');

      act(() => {
        result.current.toggleFlag('test-mode');
      });

      expect(result.current.isEnabled('test-mode')).toBe(!initialTestModeState);
    });

    it('should reset feature flags via resetFlags', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      // Toggle some flags
      act(() => {
        result.current.toggleFlag('test-mode');
        result.current.toggleFlag('grayscale-mode');
      });

      // Reset all flags
      act(() => {
        result.current.resetFlags();
      });

      // Flags should be back to defaults
      expect(result.current.isEnabled('test-mode')).toBe(false);
      expect(result.current.isEnabled('grayscale-mode')).toBe(false);
    });

    it('should reset custom settings via resetSettings', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      // Change some settings
      act(() => {
        result.current.setSettingValue('recognition-delay', 2000);
        result.current.setSettingValue('similarity-threshold', 20);
      });

      // Reset all settings
      act(() => {
        result.current.resetSettings();
      });

      // Settings should be back to defaults
      const timingGroup = result.current.settingGroups.find((g) => g.id === 'timing');
      const recognitionDelaySetting = timingGroup?.settings.find(
        (s) => s.id === 'recognition-delay'
      );
      expect(recognitionDelaySetting?.value).toBe(1000); // default value
    });

    it('should properly expose flags from useFeatureFlags', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      expect(Array.isArray(result.current.flags)).toBe(true);
      expect(result.current.flags.length).toBeGreaterThan(0);

      result.current.flags.forEach((flag) => {
        expect(flag).toHaveProperty('id');
        expect(flag).toHaveProperty('name');
        expect(flag).toHaveProperty('enabled');
      });
    });

    it('should properly expose settings through settingGroups', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      expect(Array.isArray(result.current.settingGroups)).toBe(true);
      expect(result.current.settingGroups.length).toBeGreaterThan(0);

      // Verify that all settings are accessible through groups
      const allSettings = result.current.settingGroups.flatMap((group) => group.settings);
      expect(allSettings.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-existent profile gracefully', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      act(() => {
        // @ts-expect-error - Testing invalid profile ID
        result.current.handleProfileSelection('non-existent-profile');
      });

      // Should not crash, might stay on current profile
      expect(result.current.currentProfile).toBeDefined();
    });

    it('should handle setting value with non-existent setting id', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      // This should not crash
      act(() => {
        result.current.setSettingValue('non-existent-setting', 'value');
      });

      expect(result.current.settingGroups).toBeDefined();
    });

    it('should handle multiple rapid profile selections', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      act(() => {
        result.current.handleProfileSelection('baseline-phash');
        result.current.handleProfileSelection('custom');
      });

      expect(result.current.currentProfile?.id).toBe('custom');
    });

    it('should handle rapid setting changes', () => {
      const { result } = renderHook(() => useSecretSettingsController(mockOnClose));

      act(() => {
        result.current.setSettingValue('recognition-delay', 500);
        result.current.setSettingValue('recognition-delay', 1000);
        result.current.setSettingValue('recognition-delay', 1500);
        result.current.setSettingValue('recognition-delay', 2000);
      });

      const timingGroup = result.current.settingGroups.find((g) => g.id === 'timing');
      const recognitionDelaySetting = timingGroup?.settings.find(
        (s) => s.id === 'recognition-delay'
      );
      expect(recognitionDelaySetting?.value).toBe(2000);
    });
  });
});
