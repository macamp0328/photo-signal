---
name: 'M1.2: Test Camera Access Module'
about: Add unit tests for camera access module
title: 'Test Camera Access Module'
labels: ['milestone-1', 'testing', 'module-test']
assignees: ''
---

## Milestone

Milestone 1: Testing Infrastructure & Quality Assurance

## Objective

Create comprehensive unit tests for the camera-access module to validate its contract and functionality.

## Tasks

- [ ] Create `src/modules/camera-access/useCameraAccess.test.ts`

- [ ] Test camera permission request on mount
  - Mock `getUserMedia` to resolve successfully
  - Verify stream is set correctly
  - Verify `hasPermission` is true

- [ ] Test permission denied scenario
  - Mock `getUserMedia` to reject
  - Verify error message is set
  - Verify `hasPermission` is false
  - Verify stream is null

- [ ] Test permission pending/loading state
  - Verify initial state before permission granted
  - Verify `hasPermission` is null during request

- [ ] Test stream cleanup on unmount
  - Verify `stream.getTracks().forEach(track => track.stop())` is called
  - Test cleanup happens when component unmounts

- [ ] Test retry functionality
  - Call `retry()` method after error
  - Verify `getUserMedia` is called again
  - Verify error is cleared before retry

- [ ] Test constraint options
  - Verify camera constraints (facingMode: 'environment')
  - Test with different constraint options

## Acceptance Criteria

- [ ] All tests pass (`npm run test`)
- [ ] Code coverage >70% for camera-access module
- [ ] Tests validate module contract from README.md
- [ ] Tests use proper mocks from test setup
- [ ] No breaking changes to module implementation

## Dependencies

Requires: M1.1 - Setup Testing Framework

## Estimated Effort

3-4 hours

## Files to Create

- `src/modules/camera-access/useCameraAccess.test.ts`

## References

- [camera-access module README](../../src/modules/camera-access/README.md)
- [MediaDevices API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices)
