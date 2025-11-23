/**
 * Tests for Guidance Configuration
 */

import { describe, it, expect } from 'vitest';
import {
  defaultGuidanceConfig,
  getGuidancePriority,
  selectGuidanceToShow,
  type GuidanceType,
  type GuidanceConfig,
} from './guidanceConfig';

describe('guidanceConfig', () => {
  describe('defaultGuidanceConfig', () => {
    it('should have all required properties', () => {
      expect(defaultGuidanceConfig).toHaveProperty('enabled');
      expect(defaultGuidanceConfig).toHaveProperty('messages');
      expect(defaultGuidanceConfig).toHaveProperty('thresholds');
      expect(defaultGuidanceConfig).toHaveProperty('displayDuration');
      expect(defaultGuidanceConfig).toHaveProperty('cooldownDuration');
      expect(defaultGuidanceConfig).toHaveProperty('enableHaptics');
      expect(defaultGuidanceConfig).toHaveProperty('enableAudioCues');
      expect(defaultGuidanceConfig).toHaveProperty('showInProduction');
    });

    it('should have messages for all guidance types', () => {
      const guidanceTypes: GuidanceType[] = [
        'motion-blur',
        'glare',
        'poor-lighting',
        'distance',
        'off-center',
        'none',
      ];

      guidanceTypes.forEach((type) => {
        expect(defaultGuidanceConfig.messages).toHaveProperty(type);
        expect(defaultGuidanceConfig.messages[type]).toHaveProperty('icon');
        expect(defaultGuidanceConfig.messages[type]).toHaveProperty('text');
        expect(defaultGuidanceConfig.messages[type]).toHaveProperty('priority');
      });
    });

    it('should have valid threshold values', () => {
      const { thresholds } = defaultGuidanceConfig;

      expect(thresholds.sharpness).toBeGreaterThan(0);
      expect(thresholds.glarePixelThreshold).toBeGreaterThanOrEqual(0);
      expect(thresholds.glarePixelThreshold).toBeLessThanOrEqual(255);
      expect(thresholds.glarePercentageThreshold).toBeGreaterThan(0);
      expect(thresholds.glarePercentageThreshold).toBeLessThanOrEqual(100);
      expect(thresholds.minBrightness).toBeGreaterThanOrEqual(0);
      expect(thresholds.minBrightness).toBeLessThanOrEqual(255);
      expect(thresholds.maxBrightness).toBeGreaterThanOrEqual(0);
      expect(thresholds.maxBrightness).toBeLessThanOrEqual(255);
      expect(thresholds.minBrightness).toBeLessThan(thresholds.maxBrightness);
      expect(thresholds.minFrameFillPercentage).toBeGreaterThan(0);
      expect(thresholds.minFrameFillPercentage).toBeLessThan(thresholds.maxFrameFillPercentage);
      expect(thresholds.maxHorizontalOffsetPercentage).toBeGreaterThan(0);
      expect(thresholds.maxVerticalOffsetPercentage).toBeGreaterThan(0);
    });

    it('should have valid duration values', () => {
      expect(defaultGuidanceConfig.displayDuration).toBeGreaterThan(0);
      expect(defaultGuidanceConfig.cooldownDuration).toBeGreaterThan(0);
    });

    it('should have priority order: motion-blur > glare > poor-lighting', () => {
      const motionPriority = defaultGuidanceConfig.messages['motion-blur'].priority;
      const glarePriority = defaultGuidanceConfig.messages.glare.priority;
      const lightingPriority = defaultGuidanceConfig.messages['poor-lighting'].priority;

      expect(motionPriority).toBeGreaterThan(glarePriority);
      expect(glarePriority).toBeGreaterThanOrEqual(lightingPriority);
    });

    it('should have none guidance with zero priority', () => {
      expect(defaultGuidanceConfig.messages.none.priority).toBe(0);
      expect(defaultGuidanceConfig.messages.none.text).toBe('');
    });
  });

  describe('getGuidancePriority', () => {
    it('should return correct priority for each guidance type', () => {
      expect(getGuidancePriority('motion-blur', defaultGuidanceConfig)).toBe(5);
      expect(getGuidancePriority('glare', defaultGuidanceConfig)).toBe(4);
      expect(getGuidancePriority('poor-lighting', defaultGuidanceConfig)).toBe(3);
      expect(getGuidancePriority('distance', defaultGuidanceConfig)).toBe(3);
      expect(getGuidancePriority('off-center', defaultGuidanceConfig)).toBe(2);
      expect(getGuidancePriority('none', defaultGuidanceConfig)).toBe(0);
    });

    it('should work with custom config', () => {
      const customConfig: GuidanceConfig = {
        ...defaultGuidanceConfig,
        messages: {
          ...defaultGuidanceConfig.messages,
          glare: {
            ...defaultGuidanceConfig.messages.glare,
            priority: 10,
          },
        },
      };

      expect(getGuidancePriority('glare', customConfig)).toBe(10);
    });
  });

  describe('selectGuidanceToShow', () => {
    it('should return none for empty array', () => {
      const result = selectGuidanceToShow([], defaultGuidanceConfig);
      expect(result).toBe('none');
    });

    it('should return the only guidance when array has one element', () => {
      const result = selectGuidanceToShow(['motion-blur'], defaultGuidanceConfig);
      expect(result).toBe('motion-blur');
    });

    it('should return highest priority guidance', () => {
      const result = selectGuidanceToShow(
        ['off-center', 'motion-blur', 'glare'],
        defaultGuidanceConfig
      );
      expect(result).toBe('motion-blur'); // Priority 5 > 4 > 2
    });

    it('should prioritize motion-blur over glare', () => {
      const result = selectGuidanceToShow(['glare', 'motion-blur'], defaultGuidanceConfig);
      expect(result).toBe('motion-blur');
    });

    it('should prioritize glare over poor-lighting', () => {
      const result = selectGuidanceToShow(['poor-lighting', 'glare'], defaultGuidanceConfig);
      expect(result).toBe('glare');
    });

    it('should prioritize poor-lighting over off-center', () => {
      const result = selectGuidanceToShow(['off-center', 'poor-lighting'], defaultGuidanceConfig);
      expect(result).toBe('poor-lighting');
    });

    it('should handle multiple guidance types at same priority', () => {
      // poor-lighting and distance both have priority 3
      const result = selectGuidanceToShow(['distance', 'poor-lighting'], defaultGuidanceConfig);
      // Either is acceptable (same priority)
      expect(['distance', 'poor-lighting']).toContain(result);
    });

    it('should work with custom config', () => {
      const customConfig: GuidanceConfig = {
        ...defaultGuidanceConfig,
        messages: {
          ...defaultGuidanceConfig.messages,
          'off-center': {
            ...defaultGuidanceConfig.messages['off-center'],
            priority: 10, // Make it highest priority
          },
        },
      };

      const result = selectGuidanceToShow(['motion-blur', 'glare', 'off-center'], customConfig);
      expect(result).toBe('off-center');
    });

    it('should ignore none in selection', () => {
      const result = selectGuidanceToShow(['none', 'motion-blur'], defaultGuidanceConfig);
      expect(result).toBe('motion-blur');
    });

    it('should return none if only none is provided', () => {
      const result = selectGuidanceToShow(['none'], defaultGuidanceConfig);
      expect(result).toBe('none');
    });
  });
});
