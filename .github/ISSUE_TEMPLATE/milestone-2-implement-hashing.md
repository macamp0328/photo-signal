---
name: 'M2.2: Implement Perceptual Hashing'
about: Implement perceptual hashing for photo recognition
title: 'Implement Perceptual Hashing for Photo Recognition'
labels: ['milestone-2', 'feature', 'photo-recognition']
assignees: ''
---

## Milestone
Milestone 2: Real Photo Recognition

## Objective
Replace placeholder photo recognition with perceptual hashing algorithm to enable real photo matching.

## Tasks

- [ ] Choose and install hashing library
  - Based on M2.1 research recommendation
  - `npm install blockhash-js` or equivalent
  - Verify bundle size impact

- [ ] Create hashing utility module
  - Create `src/modules/photo-recognition/hashingService.ts`
  - Implement `generateHash(imageData: ImageData): Promise<string>`
  - Implement `compareHashes(hash1: string, hash2: string): number` (returns similarity score)
  - Add error handling

- [ ] Update photo recognition hook
  - Modify `src/modules/photo-recognition/usePhotoRecognition.ts`
  - Replace 3-second delay placeholder with real hashing
  - Capture frame from video stream
  - Generate hash from frame
  - Compare with stored hashes in concert data
  - Return best match above threshold

- [ ] Add configuration options
  - Add `similarityThreshold` option (default: 0.85)
  - Add `hashSize` option for hash algorithm
  - Add `checkInterval` for how often to check (default: 1000ms)

- [ ] Optimize performance
  - Debounce hash generation
  - Reduce frame capture resolution for hashing
  - Cache recent hashes to avoid re-computation

- [ ] Update module README
  - Document new hashing algorithm used
  - Update API documentation with new options
  - Add usage examples
  - Document threshold tuning

- [ ] Add hash debugging tools (development only)
  - Console log hash values in dev mode
  - Add visualization of hash comparison scores
  - Add hash export functionality for testing

## Acceptance Criteria

- [ ] Perceptual hashing library integrated
- [ ] Real photo recognition works in place of placeholder
- [ ] Hash comparison accurately matches similar photos
- [ ] Performance is acceptable on mobile (< 500ms per check)
- [ ] Module README updated with new implementation
- [ ] Existing tests still pass (update if needed)
- [ ] No breaking changes to public API

## Dependencies
Requires: M2.1 - Research Photo Recognition Approaches (for recommendation)

## Estimated Effort
12-16 hours

## Files to Modify/Create
- `src/modules/photo-recognition/hashingService.ts` (new)
- `src/modules/photo-recognition/usePhotoRecognition.ts`
- `src/modules/photo-recognition/README.md`
- `src/modules/photo-recognition/types.ts`
- `package.json`

## Testing
- [ ] Test hash generation with sample images
- [ ] Test hash comparison accuracy
- [ ] Test performance on mobile device
- [ ] Test with different lighting conditions

## References
- [Perceptual Hashing](https://www.hackerfactor.com/blog/index.php?/archives/432-Looks-Like-It.html)
- Research document from M2.1
