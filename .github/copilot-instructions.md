# GitHub Copilot Instructions — Photo Signal

## Non-negotiable quality gate

Run before every commit:

```bash
npm run pre-commit
```

This must pass end-to-end (lint, format, type-check, tests, build, bundle checks).

## Branch and PR workflow

- Use a feature branch for code changes.
- Keep commits small and focused.
- Prefer `gh` CLI for PR operations.
- For multiline PR/comment text, use `--body-file`.

## Tooling preference

- Use `npm ci` in CI and reproducible environments.
- Do not bypass hooks or checks with `--no-verify`.
- Re-run `npm run pre-commit` after conflict resolution.

## Project snapshot

- Stack: React 19, TypeScript 5.9 strict, Vite 7, Vitest, Playwright, CSS Modules.
- Runtime data: `public/data.app.v2.json`, `public/data.recognition.v2.json`.
- Audio pipeline: scripts under `scripts/audio-workflow/`.

## Code boundaries

- Keep module changes localized when possible.
- Prefer shared types in `src/types/index.ts`.
- Use existing test/mocks patterns in `src/test/`.

## Documentation policy

- Keep docs concise and current-state.
- Remove stale/speculative content when unclear.
- Update `DOCUMENTATION_INDEX.md` when docs are added/removed/renamed.

## Reference docs

- `CLAUDE.md`
- `ARCHITECTURE.md`
- `TESTING.md`
- `DOCUMENTATION_INDEX.md`
