---
name: 'M1.8: Test Data Service'
about: Add unit tests for data service
title: 'Test Data Service'
labels: ['milestone-1', 'testing', 'service-test']
assignees: ''
---

## Milestone

Milestone 1: Testing Infrastructure & Quality Assurance

## Objective

Create comprehensive unit tests for the data service to validate concert data loading, caching, and search functionality.

## Tasks

- [ ] Create `src/services/data-service/DataService.test.ts`

- [ ] Mock fetch API
  - Mock global `fetch` function
  - Return mock concert data
  - Test successful responses

- [ ] Test getConcerts()
  - Call `getConcerts()`
  - Verify fetch is called with correct URL
  - Verify concert data is returned
  - Verify data structure is correct

- [ ] Test cache behavior
  - Call `getConcerts()` twice
  - Verify fetch is only called once
  - Verify second call returns cached data
  - Test cache invalidation (if implemented)

- [ ] Test error handling
  - Mock fetch to reject/throw error
  - Call `getConcerts()`
  - Verify error is handled gracefully
  - Verify appropriate error message/fallback

- [ ] Test getConcertById()
  - Call with valid concert ID
  - Verify correct concert is returned
  - Call with invalid ID
  - Verify null or error is returned

- [ ] Test searchByImage() (if implemented)
  - Provide mock image hash
  - Verify search returns matching concert
  - Test no match scenario

- [ ] Test getRandomConcert()
  - Call multiple times
  - Verify a random concert is returned each time
  - Verify returned concert is from the dataset

- [ ] Test with empty data
  - Mock fetch to return empty array
  - Verify methods handle empty data gracefully

## Acceptance Criteria

- [ ] All tests pass (`npm run test`)
- [ ] Code coverage >70% for data-service
- [ ] Tests validate service contract from README.md
- [ ] Fetch API is properly mocked
- [ ] Cache behavior is correctly tested
- [ ] No breaking changes to service implementation

## Dependencies

Requires: M1.1 - Setup Testing Framework

## Estimated Effort

4-5 hours

## Files to Create

- `src/services/data-service/DataService.test.ts`

## References

- [data-service README](../../src/services/data-service/README.md)
- [Mocking Fetch](https://vitest.dev/guide/mocking.html)
