---
name: 'M3.1: Implement Audio Crossfade'
about: Add smooth crossfade transitions between audio tracks
title: 'Implement Audio Crossfade'
labels: ['milestone-3', 'feature', 'audio']
assignees: ''
---

## Milestone
Milestone 3: Enhanced Audio Experience

## Objective
Add smooth crossfade transitions when switching between audio tracks for a seamless listening experience.

## Tasks

- [ ] Add crossfade method to audio playback hook
  - Update `src/modules/audio-playback/useAudioPlayback.ts`
  - Create `crossfade(newUrl: string, duration?: number)` method
  - Default duration: 2000ms (2 seconds)

- [ ] Implement crossfade logic
  - Fade out current playing track
  - Simultaneously fade in new track starting at 0 volume
  - Manage two Howl instances during transition
  - Clean up old instance after fade completes

- [ ] Add configuration options
  - Add `crossfadeDuration` option to hook
  - Add `crossfadeEnabled` flag
  - Allow per-call duration override

- [ ] Update public API
  - Update `src/modules/audio-playback/types.ts`
  - Add crossfade to return interface
  - Document parameters and behavior

- [ ] Handle edge cases
  - Crossfade while another crossfade is in progress
  - Crossfade with same URL (no-op or restart)
  - Crossfade when no audio is playing
  - Cleanup on component unmount during crossfade

- [ ] Update module README
  - Document crossfade functionality
  - Add usage examples
  - Document configuration options

- [ ] Add tests
  - Test crossfade creates two Howl instances
  - Test fade timing with fake timers
  - Test cleanup of old instance
  - Test edge cases

## Acceptance Criteria

- [ ] Crossfade works smoothly between tracks
- [ ] No audio gaps or overlaps
- [ ] Configurable crossfade duration
- [ ] Module README updated
- [ ] Tests added and passing
- [ ] Existing tests still pass
- [ ] No breaking changes to existing API

## Dependencies
None - Can be done independently

## Estimated Effort
6-8 hours

## Files to Modify/Create
- `src/modules/audio-playback/useAudioPlayback.ts`
- `src/modules/audio-playback/types.ts`
- `src/modules/audio-playback/README.md`
- `src/modules/audio-playback/useAudioPlayback.test.ts`

## Testing Checklist
- [ ] Test on desktop browser
- [ ] Test on mobile browser
- [ ] Test rapid track changes
- [ ] Verify no memory leaks from old Howl instances

## References
- [Howler.js fade documentation](https://github.com/goldfire/howler.js#fadefrom-to-duration-id)
