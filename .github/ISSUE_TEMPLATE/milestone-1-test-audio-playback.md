---
name: 'M1.5: Test Audio Playback Module'
about: Add unit tests for audio playback module
title: 'Test Audio Playback Module'
labels: ['milestone-1', 'testing', 'module-test']
assignees: ''
---

## Milestone

Milestone 1: Testing Infrastructure & Quality Assurance

## Objective

Create comprehensive unit tests for the audio-playback module to validate audio controls and fade effects.

## Tasks

- [ ] Create `src/modules/audio-playback/useAudioPlayback.test.ts`

- [ ] Mock Howler.js
  - Create mock Howl class
  - Mock play(), pause(), stop(), fade() methods
  - Track method calls for verification

- [ ] Test initial state
  - Verify `isPlaying` is false
  - Verify `volume` is at default (0.8)
  - Verify no sound is loaded

- [ ] Test play functionality
  - Call `play(audioUrl)`
  - Verify Howl is instantiated with correct URL
  - Verify `play()` is called on Howl instance
  - Verify `isPlaying` becomes true

- [ ] Test pause functionality
  - Play audio first
  - Call `pause()`
  - Verify Howl `pause()` is called
  - Verify `isPlaying` becomes false

- [ ] Test stop functionality
  - Play audio first
  - Call `stop()`
  - Verify Howl `stop()` is called
  - Verify `isPlaying` becomes false

- [ ] Test fade out
  - Play audio first
  - Call `fadeOut(duration)`
  - Verify Howl `fade()` is called with correct parameters
  - Verify final volume is 0

- [ ] Test volume controls
  - Call `setVolume(0.5)`
  - Verify volume state updates
  - Verify Howl volume is set

- [ ] Test playing new audio while previous is playing
  - Play first audio
  - Play second audio
  - Verify first audio is stopped
  - Verify second audio starts playing

- [ ] Test error handling
  - Mock Howl to trigger `onloaderror`
  - Verify error is handled gracefully
  - Mock `onplayerror`
  - Verify playback error is handled

## Acceptance Criteria

- [ ] All tests pass (`npm run test`)
- [ ] Code coverage >70% for audio-playback module
- [ ] Tests validate module contract from README.md
- [ ] Howler.js is properly mocked
- [ ] No breaking changes to module implementation

## Dependencies

Requires: M1.1 - Setup Testing Framework

## Estimated Effort

4-5 hours

## Files to Create

- `src/modules/audio-playback/useAudioPlayback.test.ts`

## References

- [audio-playback module README](../../src/modules/audio-playback/README.md)
- [Howler.js Documentation](https://howlerjs.com/)
