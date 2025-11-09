---
name: 'M1.4: Test Photo Recognition Module'
about: Add unit tests for photo recognition module
title: 'Test Photo Recognition Module'
labels: ['milestone-1', 'testing', 'module-test']
assignees: ''
---

## Milestone
Milestone 1: Testing Infrastructure & Quality Assurance

## Objective
Create comprehensive unit tests for the photo-recognition module to validate placeholder recognition logic and state management.

## Tasks

- [ ] Create `src/modules/photo-recognition/usePhotoRecognition.test.ts`

- [ ] Mock data service
  - Mock `getRandomConcert()` method
  - Return predictable concert data for testing

- [ ] Test initial state
  - Verify `recognizedConcert` is null initially
  - Verify `isRecognizing` is false

- [ ] Test recognition delay timing
  - Mock timers with `vi.useFakeTimers()`
  - Verify recognition doesn't trigger before 3 seconds
  - Advance timers and verify recognition triggers
  - Test timing accuracy

- [ ] Test recognition flow
  - Provide mock stream
  - Verify `isRecognizing` becomes true
  - Verify concert is recognized after delay
  - Verify `isRecognizing` becomes false after recognition

- [ ] Test reset functionality
  - Recognize a concert
  - Call `reset()`
  - Verify `recognizedConcert` is null
  - Verify recognition can happen again

- [ ] Test enabled/disabled state
  - Set `enabled: false` option
  - Verify no recognition occurs
  - Set `enabled: true`
  - Verify recognition resumes

- [ ] Test with no stream
  - Pass null stream
  - Verify no recognition occurs
  - Verify no errors

## Acceptance Criteria

- [ ] All tests pass (`npm run test`)
- [ ] Code coverage >70% for photo-recognition module
- [ ] Tests validate module contract from README.md
- [ ] Tests properly use fake timers for timing tests
- [ ] No breaking changes to module implementation

## Dependencies
Requires: M1.1 - Setup Testing Framework

## Estimated Effort
3-4 hours

## Files to Create
- `src/modules/photo-recognition/usePhotoRecognition.test.ts`

## References
- [photo-recognition module README](../../src/modules/photo-recognition/README.md)
- [Vitest Timer Mocks](https://vitest.dev/api/vi.html#vi-usefaketimers)
