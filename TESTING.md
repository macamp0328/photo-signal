# Testing Guide

Use this document for two things only:

1. How to run tests
2. What AI agents need to know when adding or editing tests

For broader project context, see [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md).

---

## Run Tests

```bash
# Watch mode
npm test

# Single run (CI-style)
npm run test:run

# Coverage report
npm run test:coverage
```

If you are preparing a commit/PR, run the full gate:

```bash
npm run pre-commit
```

`pre-commit` runs lint, format, type-check, tests, and build.

---

## Test Locations

- Unit/component tests are colocated with source files (`foo.ts` → `foo.test.ts`, `Bar.tsx` → `Bar.test.tsx`).
- Integration tests are under `src/__tests__/integration/`.
- Visual regression tests are under `tests/visual/`.

---

## AI Agent Rules for Writing Tests

### 1) Validate behavior, not implementation details

- Prefer user-visible outcomes and module contracts.
- Avoid brittle assertions on private internals.

### 2) Keep scope tight

- Test only what changed.
- Do not refactor unrelated test suites in the same pass.

### 3) Use existing mocks and patterns

- Browser API mocks: `src/test/mocks.ts`
- Global test setup: `src/test/setup.ts`
- Follow nearby module test style before introducing new patterns.

### 4) Keep tests deterministic

- Control timers (`vi.useFakeTimers`) when needed.
- Mock network and external APIs.
- Avoid dependence on execution order across tests.

### 5) Update tests with contract changes

- If you remove or rename a public field/prop/API, update all affected tests in the same PR.

---

## Quick Agent Checklist

Before finishing test-related work:

1. Add/update focused tests for the changed behavior.
2. Run `npm run test:run`.
3. Run `npm run pre-commit` before commit/push.
4. Ensure failing tests are relevant to your change before fixing them.

---

## Interpreting Results

- **Pass:** `Test Files X passed` and exit code `0`
- **Fail:** `Test Files X failed` or non-zero exit code

Some stderr warnings (for example React `act()` warnings in known scenarios) can be non-blocking if tests pass and exit code is `0`.
