# GitHub Copilot Instructions for Photo Signal

## CRITICAL: Pre-Commit Rule

**NEVER commit or push code that fails CI.** Before EVERY commit, run:

```bash
npm run pre-commit
```

This runs lint, format, type-check, tests, and build. If ANY step fails, fix it before committing. This is non-negotiable.

**Formatting is the #1 cause of CI failures.** Always run `npm run format` after making changes.

**Safety net**: The `auto-fix-agent-pr` workflow will auto-fix formatting if CI fails, but don't rely on it.

### Interpreting Test Output

- **PASS**: `Test Files X passed` with exit code 0 (ignore `stderr` warnings about React `act()` or mocks)
- **FAIL**: `Test Files X failed` with exit code != 0

## CRITICAL: Branch Workflow Rule

Before implementing any code change, create and switch to a feature branch.

- Tiny docs-only edits may be done on `main`, but branches are still preferred.
- For AI-agent work, branch prefixes `copilot/` and `claude/` are recommended (not required).
- Planner mode is optional, but recommended for larger or multi-file changes.
- Use `CONTRIBUTING.md` as the canonical contributor workflow reference.

After completing implementation, ask the maintainer whether to update the feature branch from `main` before PR handoff.

- If requested, pull/merge `main` into the feature branch and resolve conflicts.
- Re-run `npm run pre-commit` after resolving conflicts.

## CRITICAL: Git Tooling Preference

Prefer `gh` CLI for git collaboration tasks (commits, PR creation, PR updates, PR comments, and review actions) instead of GitKraken tools.

- If `gh` is not authenticated, pause and ask the maintainer to run `gh auth login`, then continue.
- For larger changes, commit in logical checkpoints on the feature branch rather than one large final commit.
- Keep commits focused and descriptive, and ensure `npm run pre-commit` passes before each commit.
- Open or update the PR with `gh` when implementation is complete.

## Project Overview

Photo Signal is a camera-based gallery that plays music when you point a device at a printed photo. It uses perceptual hashing (pHash) to recognize photos — no QR codes or markers. Mobile-first, deployed as a static site on Vercel with audio via Cloudflare R2/Workers.

**Tech Stack**: React 19, TypeScript 5.9 (strict), Vite 7, CSS Modules, Howler.js, Vitest, Playwright

## Commands

```bash
npm run dev              # Vite dev server (port 5173)
npm run pre-commit       # Full quality check (lint, format, type-check, test, build)
npm run lint:fix         # Auto-fix lint issues
npm run format           # Format with Prettier
npm run type-check       # TypeScript validation
npm run test:run         # Unit tests (single run)
npm run build            # Production build
```

## Architecture

```
Camera Access → Motion Detection → Photo Recognition → Audio Playback
                                                     → Concert Info Display
```

### Module Structure

Each module in `src/modules/` is self-contained:

```
src/modules/{name}/
├── README.md           # API contract (read this first)
├── index.ts            # Public exports
├── types.ts            # TypeScript interfaces
├── {Component}.tsx     # React component
└── {Component}.test.tsx # Colocated tests
```

Modules communicate through React props/hooks only — no direct cross-module imports.

### Key Directories

```
src/modules/          # Feature modules (camera, audio, recognition, etc.)
src/services/         # Data service for concert metadata
src/types/index.ts    # Shared TypeScript interfaces
src/test/mocks.ts     # Browser API mocks for tests
public/               # Static assets (data.json, audio, images)
scripts/              # Node.js automation scripts (CommonJS .js files)
```

## Code Style

- **TypeScript**: Strict mode, no `any`, no unused locals/parameters
- **Prettier**: 100 chars, 2-space indent, single quotes, semicolons, trailing commas (ES5), LF
- **CSS**: CSS Modules only — `import styles from './Foo.module.css'`
- **Components**: Functional components with hooks, typed props interfaces
- **State**: React hooks only (useState, useEffect, useRef, useContext) — no external state library

## Testing

- **Framework**: Vitest with `happy-dom` environment
- **Colocated**: Test files live next to source (`foo.ts` → `foo.test.ts`)
- **Integration tests**: `src/__tests__/integration/`
- **Mocks**: Import browser API mocks from `src/test/mocks.ts`
- **Coverage**: 70% minimum threshold

## Before Modifying Any Module

1. Read the module's `README.md` for its contract
2. Read existing tests to understand expected behavior
3. Check `src/types/index.ts` for shared interfaces
4. Keep changes within the module directory
5. Update `DOCUMENTATION_INDEX.md` when adding, removing, or renaming files

## Common Gotchas

- `data.json` is ~9.6 MB — use `src/services/data-service.ts` to understand the data model
- Browser APIs (camera, canvas, audio) are not available in tests — always use mocks
- `scripts/` contains CommonJS `.js` files, not TypeScript
- CSS Modules generate scoped class names — reference via `import styles from './Foo.module.css'`

## Key Documentation

- **[CONTRIBUTING.md](../CONTRIBUTING.md)** — Contribution guidelines and quality gates
- **[ARCHITECTURE.md](../ARCHITECTURE.md)** — System design and module contracts
- **[TESTING.md](../TESTING.md)** — Testing strategy
- **[DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)** — Complete documentation index
- **[docs/PHOTO_RECOGNITION_DEEP_DIVE.md](../docs/PHOTO_RECOGNITION_DEEP_DIVE.md)** — Recognition algorithm details
