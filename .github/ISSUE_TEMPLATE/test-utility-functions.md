---
name: Add Tests for Utility Functions
about: Add comprehensive unit tests for telemetryUtils and guidanceConfig to ensure robust tracking and guidance functionality
title: 'test(utils): add tests for telemetryUtils and guidanceConfig'
labels: ['testing', 'utilities', 'ai-agent-ready']
assignees: ''
---

## Problem Statement

Currently, utility functions in `src/utils/telemetryUtils.ts` and `src/config/guidanceConfig.ts` lack test coverage. These utilities handle critical functionality for tracking user guidance effectiveness and configuring guidance behavior. Without tests, changes to these functions could break telemetry reporting or guidance selection logic.

**Current State:**

- ❌ **No tests** for `telemetryUtils.ts` (3 exported functions)
- ❌ **No tests** for `guidanceConfig.ts` (2 exported functions + config object)
- ✅ **Well documented** - Both files have clear JSDoc comments
- ✅ **Type safe** - Strong TypeScript types defined

**Risk Areas:**

1. **Telemetry formatting** - Console output could become malformed
2. **JSON export** - Export format could break downstream analysis tools
3. **Effectiveness calculation** - Math errors could give wrong metrics
4. **Guidance selection** - Wrong priority logic could show unhelpful guidance

---

## Proposed Solution

Add comprehensive unit tests for both utility modules following existing test patterns in the repository.

### Test Coverage Goals

**`telemetryUtils.ts`** (3 functions):

1. `formatGuidanceTelemetry()` - Format telemetry for console output
2. `exportGuidanceTelemetry()` - Export telemetry as JSON
3. `calculateGuidanceEffectiveness()` - Calculate before/after metrics

**`guidanceConfig.ts`** (2 functions + config):

1. `getGuidancePriority()` - Get priority for guidance type
2. `selectGuidanceToShow()` - Select highest priority guidance
3. `defaultGuidanceConfig` - Validate default configuration structure

---

## Implementation Plan

### Phase 1: Create Test Files

**Location**: `src/utils/` and `src/config/`

**Files to Create:**

1. `src/utils/telemetryUtils.test.ts`
2. `src/config/guidanceConfig.test.ts`

### Phase 2: Test `telemetryUtils.ts`

**File**: `src/utils/telemetryUtils.test.ts`

**Test Structure:**

```typescript
import { describe, it, expect } from 'vitest';
import {
  formatGuidanceTelemetry,
  exportGuidanceTelemetry,
  calculateGuidanceEffectiveness,
} from './telemetryUtils';
import type { RecognitionTelemetry } from '../modules/photo-recognition/types';

describe('telemetryUtils', () => {
  describe('formatGuidanceTelemetry', () => {
    it('should format complete telemetry report', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 75,
        blurRejections: 15,
        glareRejections: 5,
        lightingRejections: 5,
        successfulRecognitions: 10,
        failedAttempts: 3,
        guidanceTracking: {
          shown: {
            'motion-blur': 5,
            glare: 2,
            'poor-lighting': 1,
            distance: 0,
            'off-center': 0,
          },
          duration: {
            'motion-blur': 15000,
            glare: 6000,
            'poor-lighting': 3000,
            distance: 0,
            'off-center': 0,
          },
        },
        failureByCategory: {
          'no-match': 2,
          'low-quality': 1,
        },
        failureHistory: [],
      };

      const output = formatGuidanceTelemetry(telemetry);

      expect(output).toContain('GUIDANCE TELEMETRY REPORT');
      expect(output).toContain('Total Frames: 100');
      expect(output).toContain('Quality Frames: 75 (75.0%)');
      expect(output).toContain('Blur Rejections: 15 (15.0%)');
      expect(output).toContain('motion-blur: 5 times');
      expect(output).toContain('motion-blur: 15.0s');
    });

    it('should handle zero guidance shown', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 50,
        qualityFrames: 50,
        blurRejections: 0,
        glareRejections: 0,
        lightingRejections: 0,
        successfulRecognitions: 5,
        failedAttempts: 0,
        guidanceTracking: {
          shown: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
          duration: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
        },
        failureByCategory: {},
        failureHistory: [],
      };

      const output = formatGuidanceTelemetry(telemetry);

      expect(output).toContain('Total Frames: 50');
      expect(output).toContain('Quality Frames: 50 (100.0%)');
      // Should not list guidance types with zero count
      expect(output).not.toContain('motion-blur: 0');
    });

    it('should calculate percentages correctly', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 200,
        qualityFrames: 150,
        blurRejections: 30,
        glareRejections: 10,
        lightingRejections: 10,
        successfulRecognitions: 20,
        failedAttempts: 5,
        guidanceTracking: {
          shown: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
          duration: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
        },
        failureByCategory: {},
        failureHistory: [],
      };

      const output = formatGuidanceTelemetry(telemetry);

      expect(output).toContain('Quality Frames: 150 (75.0%)');
      expect(output).toContain('Blur Rejections: 30 (15.0%)');
      expect(output).toContain('Glare Rejections: 10 (5.0%)');
      expect(output).toContain('Lighting Rejections: 10 (5.0%)');
    });
  });

  describe('exportGuidanceTelemetry', () => {
    it('should export valid JSON', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 80,
        blurRejections: 10,
        glareRejections: 5,
        lightingRejections: 5,
        successfulRecognitions: 15,
        failedAttempts: 2,
        guidanceTracking: {
          shown: {
            'motion-blur': 3,
            glare: 1,
            'poor-lighting': 1,
            distance: 0,
            'off-center': 0,
          },
          duration: {
            'motion-blur': 9000,
            glare: 3000,
            'poor-lighting': 3000,
            distance: 0,
            'off-center': 0,
          },
        },
        failureByCategory: {
          'no-match': 1,
          'low-quality': 1,
        },
        failureHistory: [],
      };

      const json = exportGuidanceTelemetry(telemetry);
      const parsed = JSON.parse(json);

      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('frameStats');
      expect(parsed).toHaveProperty('recognitionStats');
      expect(parsed).toHaveProperty('guidanceMetrics');
      expect(parsed).toHaveProperty('failureBreakdown');
    });

    it('should calculate frame stats percentages', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 75,
        blurRejections: 15,
        glareRejections: 5,
        lightingRejections: 5,
        successfulRecognitions: 10,
        failedAttempts: 2,
        guidanceTracking: {
          shown: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
          duration: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
        },
        failureByCategory: {},
        failureHistory: [],
      };

      const json = exportGuidanceTelemetry(telemetry);
      const parsed = JSON.parse(json);

      expect(parsed.frameStats.total).toBe(100);
      expect(parsed.frameStats.quality).toBe(75);
      expect(parsed.frameStats.qualityPercentage).toBe(75);
      expect(parsed.frameStats.blurRejections).toBe(15);
      expect(parsed.frameStats.blurPercentage).toBe(15);
    });

    it('should calculate success rate', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 100,
        blurRejections: 0,
        glareRejections: 0,
        lightingRejections: 0,
        successfulRecognitions: 8,
        failedAttempts: 2,
        guidanceTracking: {
          shown: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
          duration: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
        },
        failureByCategory: {},
        failureHistory: [],
      };

      const json = exportGuidanceTelemetry(telemetry);
      const parsed = JSON.parse(json);

      expect(parsed.recognitionStats.successful).toBe(8);
      expect(parsed.recognitionStats.failed).toBe(2);
      expect(parsed.recognitionStats.successRate).toBe(80);
    });

    it('should handle zero recognitions without dividing by zero', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 50,
        qualityFrames: 50,
        blurRejections: 0,
        glareRejections: 0,
        lightingRejections: 0,
        successfulRecognitions: 0,
        failedAttempts: 0,
        guidanceTracking: {
          shown: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
          duration: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
        },
        failureByCategory: {},
        failureHistory: [],
      };

      const json = exportGuidanceTelemetry(telemetry);
      const parsed = JSON.parse(json);

      expect(parsed.recognitionStats.successRate).toBe(0);
    });

    it('should convert duration to seconds', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 100,
        blurRejections: 0,
        glareRejections: 0,
        lightingRejections: 0,
        successfulRecognitions: 0,
        failedAttempts: 0,
        guidanceTracking: {
          shown: {
            'motion-blur': 1,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
          duration: {
            'motion-blur': 12345,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
        },
        failureByCategory: {},
        failureHistory: [],
      };

      const json = exportGuidanceTelemetry(telemetry);
      const parsed = JSON.parse(json);

      expect(parsed.guidanceMetrics.durationMs['motion-blur']).toBe(12345);
      expect(parsed.guidanceMetrics.durationSeconds['motion-blur']).toBe('12.3');
    });
  });

  describe('calculateGuidanceEffectiveness', () => {
    it('should calculate reduction in failure rates', () => {
      const before: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 50,
        blurRejections: 30,
        glareRejections: 10,
        lightingRejections: 10,
        successfulRecognitions: 5,
        failedAttempts: 10,
        guidanceTracking: {
          shown: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
          duration: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
        },
        failureByCategory: {},
        failureHistory: [],
      };

      const after: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 80,
        blurRejections: 10,
        glareRejections: 5,
        lightingRejections: 5,
        successfulRecognitions: 15,
        failedAttempts: 2,
        guidanceTracking: {
          shown: {
            'motion-blur': 5,
            glare: 2,
            'poor-lighting': 2,
            distance: 0,
            'off-center': 0,
          },
          duration: {
            'motion-blur': 15000,
            glare: 6000,
            'poor-lighting': 6000,
            distance: 0,
            'off-center': 0,
          },
        },
        failureByCategory: {},
        failureHistory: [],
      };

      const effectiveness = calculateGuidanceEffectiveness(before, after);

      expect(effectiveness.motionBlurReduction).toBe(20); // 30% -> 10%
      expect(effectiveness.glareReduction).toBe(5); // 10% -> 5%
      expect(effectiveness.lightingReduction).toBe(5); // 10% -> 5%
      expect(effectiveness.overallReduction).toBe(30); // 50% -> 20%
    });

    it('should handle improvement in quality', () => {
      const before: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 60,
        blurRejections: 40,
        glareRejections: 0,
        lightingRejections: 0,
        successfulRecognitions: 5,
        failedAttempts: 5,
        guidanceTracking: {
          shown: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
          duration: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
        },
        failureByCategory: {},
        failureHistory: [],
      };

      const after: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 90,
        blurRejections: 10,
        glareRejections: 0,
        lightingRejections: 0,
        successfulRecognitions: 20,
        failedAttempts: 1,
        guidanceTracking: {
          shown: {
            'motion-blur': 10,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
          duration: {
            'motion-blur': 30000,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
        },
        failureByCategory: {},
        failureHistory: [],
      };

      const effectiveness = calculateGuidanceEffectiveness(before, after);

      expect(effectiveness.motionBlurReduction).toBe(30); // 40% -> 10%
      expect(effectiveness.overallReduction).toBe(30); // 40% -> 10%
    });

    it('should handle no change', () => {
      const telemetry: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 80,
        blurRejections: 10,
        glareRejections: 5,
        lightingRejections: 5,
        successfulRecognitions: 10,
        failedAttempts: 2,
        guidanceTracking: {
          shown: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
          duration: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
        },
        failureByCategory: {},
        failureHistory: [],
      };

      const effectiveness = calculateGuidanceEffectiveness(telemetry, telemetry);

      expect(effectiveness.motionBlurReduction).toBe(0);
      expect(effectiveness.glareReduction).toBe(0);
      expect(effectiveness.lightingReduction).toBe(0);
      expect(effectiveness.overallReduction).toBe(0);
    });

    it('should handle negative reduction (worse performance)', () => {
      const before: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 90,
        blurRejections: 10,
        glareRejections: 0,
        lightingRejections: 0,
        successfulRecognitions: 15,
        failedAttempts: 1,
        guidanceTracking: {
          shown: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
          duration: {
            'motion-blur': 0,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
        },
        failureByCategory: {},
        failureHistory: [],
      };

      const after: RecognitionTelemetry = {
        totalFrames: 100,
        qualityFrames: 70,
        blurRejections: 30,
        glareRejections: 0,
        lightingRejections: 0,
        successfulRecognitions: 8,
        failedAttempts: 5,
        guidanceTracking: {
          shown: {
            'motion-blur': 5,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
          duration: {
            'motion-blur': 15000,
            glare: 0,
            'poor-lighting': 0,
            distance: 0,
            'off-center': 0,
          },
        },
        failureByCategory: {},
        failureHistory: [],
      };

      const effectiveness = calculateGuidanceEffectiveness(before, after);

      expect(effectiveness.motionBlurReduction).toBe(-20); // Worse: 10% -> 30%
      expect(effectiveness.overallReduction).toBe(-20);
    });
  });
});
```

### Phase 3: Test `guidanceConfig.ts`

**File**: `src/config/guidanceConfig.test.ts`

**Test Structure:**

```typescript
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
      expect(thresholds.minFrameFillPercentage).toBeLessThan(
        thresholds.maxFrameFillPercentage
      );
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
      const result = selectGuidanceToShow(
        ['poor-lighting', 'glare'],
        defaultGuidanceConfig
      );
      expect(result).toBe('glare');
    });

    it('should prioritize poor-lighting over off-center', () => {
      const result = selectGuidanceToShow(
        ['off-center', 'poor-lighting'],
        defaultGuidanceConfig
      );
      expect(result).toBe('poor-lighting');
    });

    it('should handle multiple guidance types at same priority', () => {
      // poor-lighting and distance both have priority 3
      const result = selectGuidanceToShow(
        ['distance', 'poor-lighting'],
        defaultGuidanceConfig
      );
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

      const result = selectGuidanceToShow(
        ['motion-blur', 'glare', 'off-center'],
        customConfig
      );
      expect(result).toBe('off-center');
    });

    it('should ignore none in selection', () => {
      const result = selectGuidanceToShow(
        ['none', 'motion-blur'],
        defaultGuidanceConfig
      );
      expect(result).toBe('motion-blur');
    });

    it('should return none if only none is provided', () => {
      const result = selectGuidanceToShow(['none'], defaultGuidanceConfig);
      expect(result).toBe('none');
    });
  });
});
```

### Phase 4: Update Documentation

**Files to Update:**

1. `TESTING.md` - Update test coverage table
2. `DOCUMENTATION_INDEX.md` - No changes needed (no new files)

**TESTING.md Update:**

Add to "Test Coverage Status" section:

```markdown
| utils/telemetryUtils  | 12    | ✅ Pass | Formatting & calculations |
| config/guidanceConfig | 15    | ✅ Pass | Config validation & logic |
```

---

## Acceptance Criteria

- [ ] `src/utils/telemetryUtils.test.ts` created with 12+ tests
- [ ] `src/config/guidanceConfig.test.ts` created with 15+ tests
- [ ] All tests pass: `npm run test:run` exits with code 0
- [ ] Coverage >80% for both modules (verify with `npm run test:coverage`)
- [ ] Tests validate all edge cases:
  - Empty/zero values
  - Divide-by-zero scenarios
  - Negative values
  - Missing data
  - Invalid configurations
- [ ] Tests follow existing patterns (describe/it/expect structure)
- [ ] Tests use proper TypeScript types
- [ ] No console warnings or errors during test runs
- [ ] TESTING.md updated with new coverage stats
- [ ] All quality checks pass:
  - `npm run lint:fix`
  - `npm run format`
  - `npm run type-check`
  - `npm run build`

---

## Testing Checklist

### Manual Verification

- [ ] Run tests: `npm run test:run`
- [ ] Check coverage: `npm run test:coverage`
- [ ] Verify no warnings in test output
- [ ] Verify tests are fast (<100ms per test)
- [ ] Verify tests are isolated (no shared state)

### Edge Cases Covered

**telemetryUtils.ts:**

- [ ] Zero frames (division by zero)
- [ ] All guidance types shown
- [ ] No guidance shown
- [ ] Large numbers (>1000 frames)
- [ ] Fractional percentages
- [ ] Negative effectiveness (worse performance)
- [ ] Empty failure categories

**guidanceConfig.ts:**

- [ ] All guidance types have messages
- [ ] All priorities are positive integers
- [ ] Threshold ranges are valid
- [ ] Empty guidance array
- [ ] Single guidance type
- [ ] Multiple types at same priority
- [ ] Custom config overrides

---

## Code Quality Requirements

- [ ] **Type Safety**: All test data uses proper TypeScript types
- [ ] **No `any` Types**: Use `RecognitionTelemetry`, `GuidanceConfig`, etc.
- [ ] **ESLint Pass**: `npm run lint` passes with zero errors
- [ ] **Prettier Format**: `npm run format` applied
- [ ] **Type Check**: `npm run type-check` passes
- [ ] **Build Success**: `npm run build` completes
- [ ] **Tests Pass**: `npm run test:run` exits with code 0
- [ ] **No Console Spam**: Clean test output (zero warnings)

---

## Performance Considerations

- **Fast Tests**: Each test should run in <50ms
- **No Real Timers**: Use mock timers if needed (not needed for these utils)
- **Minimal Overhead**: Test data should be lightweight
- **Isolated Tests**: No shared mocks or state between tests

---

## Future Enhancements

- [ ] Add property-based testing for math functions
- [ ] Add benchmark tests for large telemetry datasets
- [ ] Add snapshot tests for formatted output
- [ ] Add tests for config migration/upgrade scenarios

---

## References

- **Existing Test Patterns**: `src/modules/photo-recognition/algorithms/__tests__/`
- **Type Definitions**: `src/modules/photo-recognition/types.ts`
- **Testing Guide**: `TESTING.md`
- **Vitest Docs**: https://vitest.dev/

---

## AI Agent Guidelines

This issue is **AI agent-ready** and follows the project's testing standards.

### Testing Workflow

1. **Read the source files** to understand what to test
2. **Copy test patterns** from existing tests (e.g., `dhash.test.ts`)
3. **Create test files** in same directory as source
4. **Write comprehensive tests** covering all functions and edge cases
5. **Run quality checks** before committing:
   ```bash
   npm run lint:fix
   npm run format
   npm run type-check
   npm run test:run
   npm run build
   ```

### Test Structure

- Use `describe` for grouping tests by function
- Use `it` for individual test cases
- Use descriptive test names (what should happen)
- Test happy path first, then edge cases
- Include comments for complex test scenarios

### Commit Messages

Use conventional commits format:

```
test(utils): add tests for telemetryUtils formatting functions
test(utils): add tests for guidance effectiveness calculation
test(config): add tests for guidanceConfig selection logic
test(config): add tests for default configuration validation
docs(testing): update coverage stats in TESTING.md
```

---

**Last Updated**: 2025-11-21
