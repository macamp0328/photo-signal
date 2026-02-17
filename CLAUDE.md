# CLAUDE.md — Photo Signal

## CRITICAL: Pre-Commit Rule (Read This First)

**NEVER commit or push code that fails CI.** Before EVERY commit, you MUST run:

```bash
npm run pre-commit
```

This runs lint, format, type-check, tests, and build. If ANY step fails, fix it before committing. Do NOT use `--no-verify` to skip hooks. Do NOT push code without running this. This is the single most important rule in this file.

A husky pre-commit hook enforces this automatically, but you must also verify manually — the hook is your safety net, not your workflow.

## Project Overview

Photo Signal is a camera-based gallery that plays music when you point a device at a printed photo. It uses perceptual hashing (dHash, pHash) and ORB feature matching to recognize photos — no QR codes or visible markers. Mobile-first, deployed as a static site on Vercel with audio served via Cloudflare R2/Workers.

## Tech Stack

- **Framework**: React 19 + TypeScript 5.9 (strict mode)
- **Build**: Vite 7
- **Styling**: CSS Modules (scoped per component)
- **Audio**: Howler.js (Opus format)
- **Testing**: Vitest (unit), Playwright (visual regression)
- **Linting**: ESLint 9 (flat config) + Prettier
- **Hosting**: Vercel (site) + Cloudflare Workers/R2 (audio CDN)

## Quick Reference Commands

```bash
# Development
npm run dev              # Vite dev server on port 5173
npm run preview          # Production preview on port 4173

# Quality checks (run ALL before committing)
npm run lint:fix         # Auto-fix lint issues
npm run format           # Format with Prettier
npm run type-check       # TypeScript validation
npm run test:run         # Unit tests (single run)
npm run build            # Production build

# Full pre-commit (runs all of the above + audit + bundle size check)
npm run pre-commit

# Testing
npm run test             # Vitest watch mode
npm run test:coverage    # Coverage report (70% minimum threshold)
npm run test:visual      # Playwright visual regression (builds first)

# Photo recognition data
npm run update-recognition-data   # Regenerate all hashes + ORB features
npm run generate-hashes           # Hash generation only
npm run generate-orb-features     # ORB features only

# Audio workflow
npm run download-song    # Download from YouTube
npm run encode-audio     # Encode to Opus
npm run upload-audio     # Upload to Cloudflare R2
```

## Mandatory Pre-Commit Workflow

**Every commit must pass these checks. No exceptions. Do NOT push without passing.**

Run `npm run pre-commit` which executes all of the following in order:

1. `npm run lint:fix` — Fix linting issues
2. `npm run format` — Format code with Prettier
3. `npm run type-check` — Validate TypeScript
4. `npm run test:run` — Run all unit tests
5. `npm run build` — Production build succeeds

If any step fails, fix the issue and re-run `npm run pre-commit` from scratch. Only commit after ALL steps pass. A husky git hook also runs these checks automatically on `git commit`, but do not rely solely on the hook — run `npm run pre-commit` explicitly before committing.

**Common failure: formatting.** Always run `npm run format` after making changes. Prettier formatting mismatches are the #1 cause of CI failures.

## Project Structure

```
src/
├── modules/                  # Feature modules (single responsibility each)
│   ├── audio-playback/       # Howler.js playback, fading, volume
│   ├── camera-access/        # MediaStream permissions and management
│   ├── camera-view/          # Video display with 3:2/2:3 framing overlays
│   ├── concert-info/         # Concert metadata overlay
│   ├── debug-overlay/        # Real-time recognition diagnostics
│   ├── gallery-layout/       # Zine-like gallery UI
│   ├── motion-detection/     # Camera movement detection via pixel analysis
│   ├── photo-recognition/    # dHash/pHash/ORB recognition algorithms
│   ├── photo-rectangle-detection/  # Dynamic rectangle detection
│   └── secret-settings/      # Triple-tap hidden settings menu
├── services/                 # Data service for concert metadata
├── types/                    # Shared TypeScript interfaces
├── utils/                    # Utility functions
├── __tests__/                # Integration tests
└── test/                     # Test setup and mocks
public/                       # Static assets (data.json, audio, images, PWA)
scripts/                      # Automation (recognition data, audio workflow)
cloudflare/                   # Cloudflare Worker for audio proxy
tests/visual/                 # Playwright visual regression tests
assets/                       # Test data, images, audio samples
docs/                         # Extended documentation (15+ guides)
```

## Architecture

### Data Flow

```
Camera Access → Motion Detection → Photo Recognition → Audio Playback
                                                     → Concert Info Display
```

### Module Design

Each module in `src/modules/` is self-contained with:

- A main component or hook as the entry point (`index.ts`)
- Colocated tests (`*.test.ts`, `*.test.tsx`)
- CSS Module for styling (`*.module.css`)
- Single responsibility — modules communicate through React props/hooks

### State Management

- React hooks (useState, useEffect, useRef, useContext) — no external state library
- Feature flags via triple-tap settings menu
- localStorage for persistence of user settings

### Data Layer

- Production: Static JSON at `/public/data.json` (~9.6 MB, includes hashes + ORB features)
- Development: `/assets/test-data/concerts.dev.json` (Test Data Mode)
- Service abstraction in `src/services/data-service.ts`

### Key Types (`src/types/index.ts`)

- `Concert` — Band, venue, date, audio file, photo hashes, ORB features
- `HashSet` — pHash and dHash variants per photo
- `ORBFeaturePayload` — Keypoints and base64-encoded BRIEF descriptors

## Code Conventions

### TypeScript

- Strict mode enabled — no `any` types without justification
- Shared interfaces in `src/types/index.ts`
- No unused locals or parameters (compiler enforced)

### Formatting (Prettier)

- 100 char line width, 2-space indent, single quotes, semicolons, trailing commas (ES5)
- LF line endings

### CSS

- CSS Modules only — no global styles outside `index.css`
- Scoped class names per component

### Testing

- Test files colocated with source: `*.test.ts` / `*.test.tsx`
- Integration tests in `src/__tests__/integration/`
- 70% minimum coverage threshold (lines, functions, branches, statements)
- Browser API mocks in `src/test/mocks.ts` (camera, canvas, audio, fetch, localStorage)
- Tests pass when output shows `Test Files X passed` with exit code 0 — stderr warnings (React `act()`, mock warnings) are non-critical

### Photo Recognition

- Single-algorithm runtime: pHash (64-bit) matching
- Multi-exposure variants (dark/normal/bright) for lighting robustness
- Legacy dHash/ORB/parallel docs retained in `docs/archive/` for historical reference
- See `docs/PHOTO_RECOGNITION_DEEP_DIVE.md` for current behavior

## CI/CD

- **CI Pipeline** (`.github/workflows/ci.yml`): lint, format check, type-check, test with coverage, build, bundle size check — runs on all PRs and pushes to main
- **Visual Regression** (`.github/workflows/visual-regression.yml`): Playwright tests on Mobile Chrome with 0.2% pixel tolerance
- **Auto-Fix** (`.github/workflows/auto-fix-agent-pr.yml`): Auto-formats AI agent PRs (copilot/, claude/) on CI failure
- **Vercel**: Auto-deploys main branch to production
- **Cloudflare**: Worker deployment for audio proxy

## Environment Variables

See `.env.example` for Cloudflare R2 audio upload configuration:

- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — Cloudflare credentials
- `R2_BUCKET_NAME`, `R2_BASE_URL` — R2 bucket configuration
- No `.env` file needed for local development (Test Data Mode works without it)

## Key Documentation

- `ARCHITECTURE.md` — System design and module contracts
- `CONTRIBUTING.md` — Contribution guidelines (human and AI)
- `TESTING.md` — Testing strategy
- `docs/PHOTO_RECOGNITION_DEEP_DIVE.md` — Recognition algorithm details
- `docs/AUDIO_R2_WORKER.md` — Audio CDN setup
- `docs/TEST_DATA_MODE_GUIDE.md` — Development testing guide

## Agent Workflow Guidelines

### Before Implementing Any Change (MANDATORY)

1. For any code change, create and switch to a feature branch before implementation.
2. Tiny docs-only edits may be done on `main`, but branches are still preferred.
3. For AI-agent work, branch prefixes `copilot/` and `claude/` are recommended (not required).
4. Planner mode is optional, but recommended for larger or multi-file changes.
5. Use `CONTRIBUTING.md` as the canonical contributor workflow reference.

### Before Committing or Pushing (MANDATORY)

1. Run `npm run pre-commit` and confirm ALL checks pass (exit code 0)
2. If any check fails, fix the issue and re-run from scratch
3. Only after all checks pass, create your commit
4. Never use `--no-verify` to bypass the pre-commit hook
5. Never push to a PR without passing all checks locally first — CI failures on PRs are not acceptable

### After Completing Implementation (MANDATORY)

1. Ask the maintainer whether the branch should be updated with the latest `main` before handoff.
2. If requested, pull/merge `main` into the feature branch and resolve conflicts before opening or updating the PR.
3. Re-run `npm run pre-commit` after conflict resolution to confirm the branch is still green.

### Git Tooling and PR Workflow (MANDATORY)

1. Prefer `gh` CLI for PR collaboration tasks (PR creation/updates, PR comments, and review actions) instead of GitKraken tools.
2. If `gh` is not authenticated, ask the maintainer to run `gh auth login` and continue once access is ready.
3. For larger changes, use `git` to create regular logical commits on the feature branch rather than one large final commit.
4. Keep `git` commits focused with clear messages, and run `npm run pre-commit` before each commit.
5. Open or update the PR with `gh` when implementation is complete.

### Before Modifying Any Module

1. Read the module's `README.md` for its contract (API, props, responsibilities)
2. Read the module's existing tests to understand expected behavior
3. Check `src/types/index.ts` for shared interfaces the module uses
4. Make changes within the module directory only — do not touch other modules unless the change requires it

### When Adding New Files

- Update `DOCUMENTATION_INDEX.md` when adding, removing, or renaming files
- Follow existing naming conventions: `kebab-case` for files, `PascalCase` for components
- Colocate tests next to source files (`foo.ts` → `foo.test.ts`)

### When Writing Tests

- Use Vitest with the `happy-dom` environment (configured in `vitest.config.ts`)
- Import browser API mocks from `src/test/mocks.ts` when needed
- Mock external dependencies, not internal module logic
- Target 70%+ coverage for any new or modified module

### Interpreting Test Results

- **PASS**: Output shows `Test Files X passed` with exit code 0
- **FAIL**: Output shows `Test Files X failed` with exit code != 0
- **Ignore**: `stderr` warnings about React `act()`, mock setup, or `console.warn` — these are non-critical

### Common Gotchas

- `data.json` is 9.6 MB — don't read it in full; use `src/services/data-service.ts` to understand the data model instead
- Browser APIs (camera, canvas, audio) are not available in tests — always use mocks from `src/test/mocks.ts`
- The `scripts/` directory contains Node.js scripts (CommonJS-style `.js` files), not TypeScript — different lint rules apply
- CSS Modules generate scoped class names at build time — reference styles via `import styles from './Foo.module.css'`
- The Vite build copies test assets from `assets/` to `public/assets/` via a custom plugin in `vite.config.ts`
