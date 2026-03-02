# Testing

This guide covers the active testing workflow for the project.

## Commands

```bash
# Watch mode
npm test

# Single run (CI-style)
npm run test:run

# Coverage
npm run test:coverage

# Full quality gate (required before commit)
npm run pre-commit
```

## Test Structure

- Unit/component tests are colocated with source files (`foo.ts` → `foo.test.ts`, `Bar.tsx` → `Bar.test.tsx`).
- Integration tests are in `src/__tests__/integration/`.
- Visual regression tests are in `tests/visual/`.

## Test Environment

- Framework: Vitest with `happy-dom`
- Global setup: `src/test/setup.ts`
- Browser/API mocks: `src/test/mocks.ts`
- Coverage threshold: 70% minimum (lines/functions/branches/statements)

## Result Interpretation

- Pass: `Test Files X passed` with exit code `0`
- Fail: `Test Files X failed` or any non-zero exit code

Known non-fatal stderr warnings (for example React `act()` warnings) are acceptable when exit code is `0`.
