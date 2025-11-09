---
name: 'M1.6: Test Camera View Component'
about: Add unit tests for camera view component
title: 'Test Camera View Component'
labels: ['milestone-1', 'testing', 'module-test', 'ui']
assignees: ''
---

## Milestone

Milestone 1: Testing Infrastructure & Quality Assurance

## Objective

Create comprehensive unit tests for the camera-view component to validate UI rendering for different permission states.

## Tasks

- [ ] Create `src/modules/camera-view/CameraView.test.tsx`

- [ ] Test error state display
  - Render with `error` prop
  - Verify error message is displayed
  - Verify video element is not rendered
  - Verify retry button is shown (if applicable)

- [ ] Test loading state display
  - Render with `isLoading: true`
  - Verify loading message/spinner is displayed
  - Verify video element is not shown yet

- [ ] Test permission request state
  - Render with `hasPermission: null`
  - Verify permission prompt message is shown

- [ ] Test active camera state
  - Provide mock stream
  - Verify video element is rendered
  - Verify video srcObject is set to stream
  - Verify overlay guide (3:2 aspect ratio) is displayed
  - Verify corner markers are rendered

- [ ] Test video element srcObject assignment
  - Use React Testing Library to get video element
  - Verify srcObject is assigned correctly
  - Test autoPlay and playsInline attributes

- [ ] Test overlay UI elements
  - Verify guide rectangle is rendered
  - Verify corner indicators are present
  - Verify instruction text is shown

- [ ] Test responsive behavior
  - Test component renders at different viewport sizes
  - Verify overlay maintains aspect ratio

## Acceptance Criteria

- [ ] All tests pass (`npm run test`)
- [ ] Code coverage >70% for camera-view module
- [ ] Tests validate module contract from README.md
- [ ] UI tests use React Testing Library best practices
- [ ] No breaking changes to component implementation

## Dependencies

Requires: M1.1 - Setup Testing Framework

## Estimated Effort

4-5 hours

## Files to Create

- `src/modules/camera-view/CameraView.test.tsx`

## References

- [camera-view module README](../../src/modules/camera-view/README.md)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
