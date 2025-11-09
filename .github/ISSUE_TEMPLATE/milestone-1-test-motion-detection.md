---
name: 'M1.3: Test Motion Detection Module'
about: Add unit tests for motion detection module
title: 'Test Motion Detection Module'
labels: ['milestone-1', 'testing', 'module-test']
assignees: ''
---

## Milestone

Milestone 1: Testing Infrastructure & Quality Assurance

## Objective

Create comprehensive unit tests for the motion-detection module to validate pixel difference calculation and motion state changes.

## Tasks

- [ ] Create `src/modules/motion-detection/useMotionDetection.test.ts`

- [ ] Mock video element and canvas context
  - Create mock video element with width/height
  - Mock `getContext('2d')` and `getImageData`
  - Create utility to generate mock frame data

- [ ] Test initial state
  - Verify `isMoving` is false initially
  - Verify default sensitivity value

- [ ] Test pixel difference calculation
  - Generate two identical frames → expect no motion
  - Generate two different frames → expect motion detected
  - Test threshold sensitivity

- [ ] Test sensitivity adjustment
  - Call `setSensitivity(value)`
  - Verify sensitivity changes
  - Test motion detection with different sensitivities

- [ ] Test motion state changes
  - Simulate frame changes over time
  - Verify `isMoving` toggles correctly
  - Test debouncing behavior

- [ ] Test with no stream
  - Pass null stream
  - Verify no errors occur
  - Verify `isMoving` remains false

- [ ] Test cleanup
  - Verify canvas resources are cleaned up
  - Test unmount behavior

## Acceptance Criteria

- [ ] All tests pass (`npm run test`)
- [ ] Code coverage >70% for motion-detection module
- [ ] Tests validate module contract from README.md
- [ ] Tests cover edge cases (null stream, extreme sensitivity)
- [ ] No breaking changes to module implementation

## Dependencies

Requires: M1.1 - Setup Testing Framework

## Estimated Effort

4-5 hours

## Files to Create

- `src/modules/motion-detection/useMotionDetection.test.ts`

## References

- [motion-detection module README](../../src/modules/motion-detection/README.md)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
