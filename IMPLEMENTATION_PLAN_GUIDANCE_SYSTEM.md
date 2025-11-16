# Implementation Plan: Real-Time Guidance System for Photo Signal

**Issue**: #138 - Implement real-time guidance triggered by detection events  
**Created**: 2025-11-16  
**Status**: Planning Complete - Ready for Implementation

---

## Overview

### What Problem Are We Solving?

Photo Signal currently detects quality issues (blur, glare) but provides minimal user feedback. Users struggle to understand why photo recognition fails and how to improve their camera positioning. This leads to frustration and abandoned recognition attempts.

The data shows significant failure rates:
- **Motion blur**: 25% of recognition attempts (35% accuracy when present)
- **Glare/reflections**: 15% of attempts (38% accuracy)
- **Poor lighting**: 15% of attempts (52% accuracy)
- **Extreme angles**: 20% of attempts (48% accuracy)

### Success Criteria

1. **User Guidance**: Real-time, actionable prompts appear when quality issues are detected
2. **Non-Intrusive**: Guidance messages timeout automatically and don't block the camera view
3. **Measurable Impact**: Test Mode telemetry shows improved recognition success rates
4. **Performance**: No degradation in frame processing speed (<20ms total per frame)
5. **Minimal Changes**: Leverage existing detection logic, add event-driven UI layer

### Who Will Use This?

- **End Users**: Get helpful feedback when camera conditions are suboptimal
- **Developers**: Can tune thresholds and messages via configuration
- **Test Mode Users**: See detailed stats on guidance effectiveness

---

## Technical Approach

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│          usePhotoRecognition Hook (Detection Layer)          │
│  • Motion blur detection (Laplacian variance)                │
│  • Glare detection (blown-out pixels)                        │
│  • NEW: Lighting detection (histogram analysis)             │
│  • NEW: Distance detection (photo size in frame)            │
│  • NEW: Centering detection (photo position)                │
└─────────────────────┬───────────────────────────────────────┘
                      │ emits guidance events
                      ▼
┌─────────────────────────────────────────────────────────────┐
│          Guidance Configuration (guidanceConfig.ts)          │
│  • Message templates per guidance type                       │
│  • Thresholds for when to show guidance                      │
│  • Timeout durations                                         │
│  • Test Mode toggles                                         │
└─────────────────────┬───────────────────────────────────────┘
                      │ configures
                      ▼
┌─────────────────────────────────────────────────────────────┐
│        FrameGuidance Component (Enhanced UI Layer)           │
│  • Displays rich guidance messages with icons                │
│  • Timeout logic (auto-dismiss after N seconds)             │
│  • Smooth fade-in/fade-out animations                       │
│  • Optional haptic feedback (mobile)                         │
│  • Optional audio cues                                       │
└─────────────────────┬───────────────────────────────────────┘
                      │ tracks
                      ▼
┌─────────────────────────────────────────────────────────────┐
│           Telemetry System (Extended Tracking)               │
│  • Guidance shown counter per type                           │
│  • Recognition success rate before/after guidance            │
│  • Test Mode export functionality                            │
└─────────────────────────────────────────────────────────────┘
```

### Key Technology Choices

1. **Event-Driven Architecture**: Detection logic emits guidance state, UI reacts
2. **Single Configuration File**: All thresholds, messages, timeouts in one place
3. **Existing Detection Logic**: Reuse blur/glare detection, add 3 new detectors
4. **CSS Animations**: Lightweight fade-in/fade-out, no JavaScript animation library
5. **TypeScript Enums**: Type-safe guidance types
6. **Test Mode Integration**: Leverage existing telemetry system

### Data Structures

```typescript
// Guidance types (comprehensive quality issues)
export type GuidanceType =
  | 'motion-blur'
  | 'glare'
  | 'poor-lighting'
  | 'distance-too-close'
  | 'distance-too-far'
  | 'off-center'
  | 'none';

// Guidance event emitted by detection layer
export interface GuidanceEvent {
  type: GuidanceType;
  severity: 'low' | 'medium' | 'high';
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// Guidance configuration
export interface GuidanceConfig {
  type: GuidanceType;
  message: string;
  icon: string; // Emoji or icon identifier
  timeout: number; // milliseconds
  threshold: number; // When to trigger
  enableHaptic?: boolean;
  enableAudio?: boolean;
}

// Extended telemetry
export interface GuidanceTelemetry {
  guidanceShownCount: Record<GuidanceType, number>;
  successAfterGuidance: number;
  totalAttempts: number;
  averageTimeToSuccess: number;
}
```

---

## Implementation Plan

### Phase 1: Foundation & Detection (Days 1-2)

**Goal**: Extend detection logic to cover all quality issue types

#### Tasks

1. **Create guidance configuration file** (Small)
   - File: `src/modules/photo-recognition/guidanceConfig.ts`
   - Define all guidance types, messages, thresholds
   - Export configuration object
   - Add TypeScript types for guidance events
   - **Dependencies**: None
   - **Estimated Time**: 2 hours

2. **Add lighting detection to utils** (Medium)
   - File: `src/modules/photo-recognition/algorithms/utils.ts`
   - Function: `detectPoorLighting(imageData: ImageData): LightingInfo`
   - Use histogram analysis to detect under/overexposure
   - Return: `{ isUnderexposed, isOverexposed, brightnessScore }`
   - **Dependencies**: Task 1
   - **Estimated Time**: 3 hours

3. **Add distance/framing detection to utils** (Medium)
   - File: `src/modules/photo-recognition/algorithms/utils.ts`
   - Function: `detectFramingIssues(frameRegion, videoSize): FramingInfo`
   - Calculate photo fill percentage in frame
   - Return: `{ tooClose, tooFar, fillPercentage }`
   - **Dependencies**: Task 1
   - **Estimated Time**: 3 hours

4. **Add centering detection to utils** (Small)
   - File: `src/modules/photo-recognition/algorithms/utils.ts`
   - Function: `detectOffCenter(frameRegion, videoSize): CenteringInfo`
   - Calculate deviation from center
   - Return: `{ isOffCenter, offsetX, offsetY }`
   - **Dependencies**: Task 1
   - **Estimated Time**: 2 hours

5. **Extend types.ts with guidance types** (Small)
   - File: `src/modules/photo-recognition/types.ts`
   - Add `GuidanceType`, `GuidanceEvent`, `GuidanceConfig`
   - Add guidance telemetry to `RecognitionTelemetry`
   - **Dependencies**: Task 1
   - **Estimated Time**: 1 hour

6. **Update usePhotoRecognition hook to emit guidance** (Medium)
   - File: `src/modules/photo-recognition/usePhotoRecognition.ts`
   - Add `currentGuidance: GuidanceEvent | null` to state
   - Call detection functions in `checkFrame()`
   - Emit guidance events based on detection results
   - Prioritize guidance (e.g., blur > glare > lighting)
   - **Dependencies**: Tasks 2-5
   - **Estimated Time**: 4 hours

**Phase 1 Total**: ~15 hours (~2 days)

---

### Phase 2: UI Components & Visual Feedback (Days 3-4)

**Goal**: Create enhanced UI to display guidance messages

#### Tasks

7. **Create FrameGuidance component** (Large)
   - File: `src/modules/photo-recognition/FrameGuidance.tsx`
   - Replace/enhance existing `FrameQualityIndicator.tsx`
   - Accept `guidance: GuidanceEvent | null` prop
   - Display message with icon
   - Implement auto-dismiss timeout
   - Add fade-in/fade-out animations
   - **Dependencies**: Tasks 5-6
   - **Estimated Time**: 5 hours

8. **Create FrameGuidance styles** (Medium)
   - File: `src/modules/photo-recognition/FrameGuidance.module.css`
   - Animated entrance/exit (fade + slide)
   - Non-intrusive positioning (bottom-center or top-center)
   - Responsive sizing
   - Icon + text layout
   - Severity-based color coding (low=blue, medium=yellow, high=red)
   - **Dependencies**: Task 7
   - **Estimated Time**: 3 hours

9. **Add haptic feedback support** (Small, Optional)
   - File: `src/modules/photo-recognition/FrameGuidance.tsx`
   - Use Vibration API when guidance changes
   - Only trigger for medium/high severity
   - Check browser support gracefully
   - **Dependencies**: Task 7
   - **Estimated Time**: 2 hours

10. **Add audio cues support** (Small, Optional)
    - File: `src/modules/photo-recognition/FrameGuidance.tsx`
    - Play subtle sound when guidance appears
    - Use Web Audio API for low-latency playback
    - Respect system volume/mute
    - **Dependencies**: Task 7
    - **Estimated Time**: 2 hours

11. **Update photo-recognition module exports** (Small)
    - File: `src/modules/photo-recognition/index.ts`
    - Export `FrameGuidance` component
    - Export guidance types and configs
    - **Dependencies**: Task 7
    - **Estimated Time**: 30 minutes

**Phase 2 Total**: ~12.5 hours (~1.5 days)

---

### Phase 3: Telemetry & Test Mode Integration (Day 5)

**Goal**: Track guidance effectiveness and enable data-driven tuning

#### Tasks

12. **Extend telemetry tracking** (Medium)
    - File: `src/modules/photo-recognition/usePhotoRecognition.ts`
    - Add guidance counters to `telemetryRef`
    - Track `guidanceShownCount` per type
    - Track `successAfterGuidance` counter
    - Track `averageTimeToSuccess`
    - **Dependencies**: Task 6
    - **Estimated Time**: 3 hours

13. **Add telemetry export to Test Mode** (Medium)
    - File: `src/modules/debug-overlay/DebugOverlay.tsx`
    - Display guidance stats in Test Mode panel
    - Add "Export Telemetry" button
    - Export JSON with before/after comparison
    - Include failure attribution percentages
    - **Dependencies**: Task 12
    - **Estimated Time**: 3 hours

14. **Update guidance config based on telemetry** (Small)
    - File: `src/modules/photo-recognition/guidanceConfig.ts`
    - Tune thresholds based on initial testing
    - Document recommended values in comments
    - Add Test Mode overrides for experimentation
    - **Dependencies**: Tasks 12-13
    - **Estimated Time**: 2 hours

15. **Add guidance effectiveness logging** (Small)
    - File: `src/modules/photo-recognition/usePhotoRecognition.ts`
    - Log when guidance appears vs. when recognition succeeds
    - Calculate correlation metrics
    - Output stats to console in Test Mode
    - **Dependencies**: Task 12
    - **Estimated Time**: 2 hours

**Phase 3 Total**: ~10 hours (~1.5 days)

---

### Phase 4: Integration & Documentation (Day 6)

**Goal**: Wire everything together and document for users/developers

#### Tasks

16. **Integrate FrameGuidance into App.tsx** (Small)
    - File: `src/App.tsx`
    - Replace `FrameQualityIndicator` with `FrameGuidance`
    - Pass guidance prop from `usePhotoRecognition`
    - **Dependencies**: Tasks 7, 11
    - **Estimated Time**: 1 hour

17. **Update CameraView to support guidance overlay** (Small)
    - File: `src/modules/camera-view/CameraView.tsx`
    - Add optional `guidanceOverlay` prop
    - Render guidance component in overlay layer
    - **Dependencies**: Task 16
    - **Estimated Time**: 1 hour

18. **Update photo-recognition README** (Small)
    - File: `src/modules/photo-recognition/README.md`
    - Document guidance event system
    - Explain configuration options
    - Add usage examples
    - Document telemetry fields
    - **Dependencies**: All previous
    - **Estimated Time**: 2 hours

19. **Update DOCUMENTATION_INDEX.md** (Small)
    - File: `DOCUMENTATION_INDEX.md`
    - Add link to guidance config file
    - Add link to telemetry documentation
    - **Dependencies**: Task 18
    - **Estimated Time**: 30 minutes

20. **Add guidance configuration to secret settings** (Medium, Optional)
    - File: `src/modules/secret-settings/customSettingsConfig.ts`
    - Add toggles for each guidance type
    - Add timeout slider
    - Add threshold sliders
    - **Dependencies**: Task 1
    - **Estimated Time**: 3 hours

**Phase 4 Total**: ~7.5 hours (~1 day)

---

### Phase 5: Testing & Polish (Days 7-8)

**Goal**: Validate functionality, fix bugs, optimize performance

#### Tasks

21. **Write unit tests for detection functions** (Large)
    - File: `src/modules/photo-recognition/algorithms/utils.test.ts`
    - Test lighting detection edge cases
    - Test distance/framing calculations
    - Test centering detection
    - **Dependencies**: Tasks 2-4
    - **Estimated Time**: 4 hours

22. **Write integration tests for guidance system** (Large)
    - File: `src/modules/photo-recognition/usePhotoRecognition.test.ts`
    - Test guidance emission on quality issues
    - Test guidance prioritization
    - Test telemetry tracking
    - **Dependencies**: Tasks 6, 12
    - **Estimated Time**: 4 hours

23. **Write component tests for FrameGuidance** (Medium)
    - File: `src/modules/photo-recognition/FrameGuidance.test.tsx`
    - Test rendering different guidance types
    - Test timeout behavior
    - Test animation states
    - **Dependencies**: Task 7
    - **Estimated Time**: 3 hours

24. **Performance testing** (Medium)
    - Measure frame processing time with new detections
    - Ensure <20ms per frame on mobile devices
    - Optimize detection algorithms if needed
    - **Dependencies**: All detection tasks
    - **Estimated Time**: 3 hours

25. **User acceptance testing** (Medium)
    - Test on real devices (iOS, Android, desktop)
    - Validate guidance messages are helpful
    - Adjust message copy based on feedback
    - Test haptic/audio features
    - **Dependencies**: All previous
    - **Estimated Time**: 4 hours

26. **Accessibility review** (Small)
    - Ensure guidance messages are screen-reader friendly
    - Add ARIA labels
    - Test keyboard navigation
    - Check color contrast for visibility
    - **Dependencies**: Task 7
    - **Estimated Time**: 2 hours

**Phase 5 Total**: ~20 hours (~2.5 days)

---

## Total Estimated Time

- **Phase 1**: 15 hours (~2 days)
- **Phase 2**: 12.5 hours (~1.5 days)
- **Phase 3**: 10 hours (~1.5 days)
- **Phase 4**: 7.5 hours (~1 day)
- **Phase 5**: 20 hours (~2.5 days)

**Grand Total**: ~65 hours (~8-9 days for solo developer)

With parallel development (2 developers or AI agents):
- Developer A: Phases 1-2 (detection + UI)
- Developer B: Phases 3-4 (telemetry + integration)
- Both: Phase 5 (testing)
- **Parallel Total**: ~5-6 days

---

## Considerations

### Assumptions

1. **Existing detection works**: Blur and glare detection already functional
2. **Canvas API available**: For image analysis in all target browsers
3. **Performance headroom**: Current frame processing is <10ms, we can add ~10ms
4. **Test Mode exists**: Infrastructure for telemetry already present
5. **Mobile support**: Vibration API and Web Audio API available on target devices

### Constraints

1. **Performance**: Must not slow down recognition (keep under 20ms per frame)
2. **Bundle Size**: Keep new code under 10KB gzipped
3. **Backward Compatibility**: Don't break existing photo recognition behavior
4. **Accessibility**: Must work with screen readers and keyboard navigation
5. **Browser Support**: Same as existing app (modern browsers, iOS Safari 14+)

### Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Detection algorithms too slow | High | Medium | Benchmark early (Task 24), optimize or disable slow detections |
| Guidance messages annoy users | Medium | Medium | Make timeout configurable, add "Dismiss" button, collect feedback |
| False positive guidance | Medium | High | Tune thresholds conservatively, use multi-frame averaging |
| Haptic/audio not supported | Low | Medium | Graceful degradation, feature detection before use |
| Telemetry data inconclusive | Low | Low | Ensure sufficient sample size in Test Mode, export raw data for analysis |

---

## Not Included (Future Enhancements)

These features are valuable but not essential for MVP:

1. **Machine Learning-based guidance**: Train model to predict optimal adjustments
2. **Multi-language support**: Translate guidance messages
3. **Custom guidance messages**: User-defined message templates
4. **Visual arrows/overlays**: Show direction to move camera (e.g., arrow pointing up)
5. **Tutorial mode**: First-time user walkthrough
6. **Guidance history**: Show log of past guidance events
7. **A/B testing framework**: Compare different guidance strategies
8. **Voice guidance**: Audio instructions instead of text
9. **AR overlays**: Overlay ideal photo position on camera view

---

## File Structure

After implementation, the photo-recognition module will have:

```
src/modules/photo-recognition/
├── README.md                     # Updated with guidance docs
├── index.ts                      # Export FrameGuidance
├── types.ts                      # Add guidance types
├── usePhotoRecognition.ts        # Emit guidance events
├── guidanceConfig.ts             # NEW: Configuration file
├── FrameGuidance.tsx             # NEW: Enhanced UI component
├── FrameGuidance.module.css      # NEW: Styles
├── FrameGuidance.test.tsx        # NEW: Component tests
├── FrameQualityIndicator.tsx     # DEPRECATED (replaced by FrameGuidance)
├── algorithms/
│   ├── utils.ts                  # Add 3 new detection functions
│   └── utils.test.ts             # Add tests for new detections
└── __tests__/
    └── usePhotoRecognition.test.ts  # Add guidance integration tests
```

**Total New Files**: 4  
**Modified Files**: 6  
**Deprecated Files**: 1

---

## Configuration Example

`guidanceConfig.ts` structure:

```typescript
export const GUIDANCE_CONFIGS: Record<GuidanceType, GuidanceConfig> = {
  'motion-blur': {
    type: 'motion-blur',
    message: 'Hold steady...',
    icon: '📹',
    timeout: 3000,
    threshold: 100, // Laplacian variance
    enableHaptic: true,
    enableAudio: false,
  },
  'glare': {
    type: 'glare',
    message: 'Tilt to avoid glare',
    icon: '✨',
    timeout: 4000,
    threshold: 20, // % of frame blown out
    enableHaptic: true,
    enableAudio: false,
  },
  'poor-lighting': {
    type: 'poor-lighting',
    message: 'Improve lighting',
    icon: '💡',
    timeout: 5000,
    threshold: 0.3, // Histogram darkness score
    enableHaptic: false,
    enableAudio: false,
  },
  'distance-too-close': {
    type: 'distance-too-close',
    message: 'Move back a bit',
    icon: '👈',
    timeout: 3000,
    threshold: 0.9, // Frame fill %
    enableHaptic: false,
    enableAudio: false,
  },
  'distance-too-far': {
    type: 'distance-too-far',
    message: 'Move closer',
    icon: '👉',
    timeout: 3000,
    threshold: 0.4, // Frame fill %
    enableHaptic: false,
    enableAudio: false,
  },
  'off-center': {
    type: 'off-center',
    message: 'Center the photo',
    icon: '🎯',
    timeout: 3000,
    threshold: 0.2, // Normalized offset from center
    enableHaptic: false,
    enableAudio: false,
  },
};

// Test Mode overrides (stricter thresholds for experimentation)
export const TEST_MODE_OVERRIDES: Partial<Record<GuidanceType, Partial<GuidanceConfig>>> = {
  'motion-blur': { threshold: 120 }, // More lenient
  'glare': { threshold: 15 }, // Stricter
};
```

---

## Telemetry Export Format

Example JSON structure for Test Mode export:

```json
{
  "session": {
    "startTime": 1700000000000,
    "endTime": 1700003600000,
    "duration": 3600000
  },
  "recognition": {
    "totalFrames": 3600,
    "qualityFrames": 2400,
    "successfulRecognitions": 15,
    "failedAttempts": 8,
    "successRate": 0.652
  },
  "guidance": {
    "shown": {
      "motion-blur": 45,
      "glare": 23,
      "poor-lighting": 12,
      "distance-too-close": 8,
      "distance-too-far": 15,
      "off-center": 19
    },
    "total": 122,
    "successAfterGuidance": 12,
    "improvementRate": 0.8
  },
  "failures": {
    "byCategory": {
      "motion-blur": 18,
      "glare": 12,
      "poor-quality": 6,
      "no-match": 5,
      "collision": 1,
      "unknown": 3
    },
    "attributionPercentage": {
      "motion-blur": 40.0,
      "glare": 26.7,
      "poor-quality": 13.3,
      "no-match": 11.1,
      "collision": 2.2,
      "unknown": 6.7
    }
  }
}
```

---

## Success Metrics

After implementation, measure these KPIs in Test Mode:

| Metric | Baseline (Before) | Target (After) |
|--------|------------------|----------------|
| Recognition success rate | 67% | 80%+ |
| Motion blur rejections | 25% | <15% |
| Glare rejections | 15% | <10% |
| Average time to recognition | 8 seconds | 5 seconds |
| User frustration rate (inferred) | High | Low |

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Approve/adjust** scope and timeline
3. **Assign tasks** to developers or AI agents
4. **Create GitHub issues** for each phase
5. **Start with Phase 1** (Foundation & Detection)

---

## References

- **Issue #138**: Original requirements
- **docs/image-recognition-exploratory-analysis.md**: Failure mode analysis (sections 2 & 6)
- **src/modules/photo-recognition/README.md**: Current module documentation
- **ARCHITECTURE.md**: System architecture overview

---

**Plan Status**: ✅ Ready for Implementation  
**Estimated Completion**: 8-9 days (solo) or 5-6 days (parallel development)
