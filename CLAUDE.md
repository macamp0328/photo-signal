# CLAUDE.md — Photo Signal

> **Sync note**: This is the canonical AI agent instruction source. `.github/copilot-instructions.md`
> is derived from this document and kept consistent for overlapping sections — it is not identical
> (Copilot's file omits some sections and adds Copilot-specific structure). Update both files when
> making structural changes.

## CRITICAL: Pre-Commit Rule (Read This First)

**NEVER commit or push code that fails CI.** Before EVERY commit, you MUST run:

```bash
npm run pre-commit
```

This runs lint, format, type-check, tests, build, and a final bundle size check. If ANY step fails, fix it before committing.
Do NOT use `--no-verify` to skip hooks. This is the single most important rule in this file.

A husky pre-commit hook enforces this automatically, but run it manually too — the hook is your safety
net, not your workflow. **Common failure: formatting.** Always run `npm run format` after making
changes. Prettier mismatches are the #1 cause of CI failures.

Pre-commit steps (run in order):

1. `npm run lint:fix` — Fix linting issues
2. `npm run format` — Format code with Prettier
3. `npm run type-check` — Validate TypeScript
4. `npm run test:run` — Run all unit tests
5. `npm run build` — Production build succeeds
6. `./scripts/check-bundle-size.sh` — Bundle size within limits

## Project Identity

- **Personal art project.** A physical gallery wall of ~100 SXSW photographs paired with audio. The
  experience is designed to feel quiet: frame a printed photo, get a match, see concert context, hear
  the song.
- **Built entirely by AI agents.** Claude Code and GitHub Copilot do almost all the coding. The
  maintainer rarely writes code by hand. This is an explicit experiment in AI-driven production
  development.
- **No commercial pressure.** No team, no velocity goals, no performance reviews. Craft and creative
  quality matter more than shipping speed.
- **Intentionally over-engineered.** The recognition + metadata + playback layer is designed to be
  reusable across content types and mediums — not just these ~100 photos. This is deliberate design
  scope, not accidental complexity.

**Implication for agents**: do not reflexively simplify the architecture in the name of "YAGNI." The
extensibility is the design intent. Work within the existing patterns; only add new abstractions when
existing ones are genuinely insufficient.

## Project Overview

Photo Signal is a camera-based gallery that plays music when you point a device at a printed photo. It
uses pHash (perceptual hashing) to recognize photos — no QR codes or visible markers. Mobile-first,
deployed as a static site on Vercel with audio served via Cloudflare R2/Workers.

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
npm run hashes:refresh   # Regenerate pHash hashes for all photos (safe batching)
npm run hashes:paths     # Hash generation for specific files/folders

# Audio workflow
npm run download-song    # Download from YouTube
npm run encode-audio     # Encode to Opus
npm run upload-audio     # Upload to Cloudflare R2
```

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
│   ├── photo-recognition/    # pHash photo recognition
│   ├── photo-rectangle-detection/  # Dynamic rectangle detection
│   └── secret-settings/      # Hidden settings menu
├── services/                 # Data service for concert metadata
├── types/                    # Shared TypeScript interfaces
├── utils/                    # Utility functions
├── __tests__/                # Integration tests
└── test/                     # Test setup and mocks
public/                       # Static assets (data.app.v2.json, data.recognition.v2.json, audio, images, PWA)
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
- Feature flags via hidden settings menu
- localStorage for persistence of user settings

### Data Layer

- Production: Static JSON at `/public/data.app.v2.json` + `/public/data.recognition.v2.json`
- Development/testing: Use the same v2 runtime artifacts
- Service abstraction in `src/services/data-service.ts`

### Key Types (`src/types/index.ts`)

- `Concert` — Band, venue, date, audio file, and pHash variants per photo
- `HashSet` — pHash variants (dark/normal/bright exposures) per photo

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
- Tests pass when output shows `Test Files X passed` with exit code 0 — stderr warnings (React `act()`,
  mock warnings) are non-critical

### Photo Recognition

- Single-algorithm runtime: pHash (64-bit) matching
- Multi-exposure variants (dark/normal/bright) for lighting robustness
- See `docs/PHOTO_RECOGNITION_DEEP_DIVE.md` for current behavior and algorithm details

### Design Philosophy

- **Add complexity only when it serves the project's explicit extensibility goals.** Don't add it for
  hypothetical future features.
- **Work within the existing architecture.** Resist introducing new abstractions (state libraries, new
  service layers, new utility patterns) unless the existing patterns are genuinely insufficient.
- **The 70% coverage threshold is a floor, not a goal.** Add tests that verify real behavior, not just
  to hit numbers. Don't add tests for code that can't fail.
- **Don't over-engineer single-use logic.** Three similar lines are better than a premature
  abstraction.

## Visual and Aesthetic Identity

The UI has a deliberate visual character — **era-matched gig poster / zine aesthetic**. It should feel
like a physical artifact from the punk/indie concert era, not a generic mobile app.

- **CRT phosphor glow, scan lines, and the "dead signal" → "matched" state transition are
  intentional.** Do not remove or simplify these as "unnecessary" complexity.
- **The per-concert color palette is derived from band name + day-of-week (FNV-1a hash).** It is
  consistent and reproducible — not random. Logic lives in `src/utils/concert-palette.ts`.
- **Typography, spacing, and overlay composition are load-bearing aesthetic choices**, not placeholder
  styles.
- When making UI changes, preserve the existing visual character. If a change would significantly alter
  the look or feel, stop and describe the approach before implementing — don't redesign silently.

## Environmental Effects Design Philosophy

Photo Signal actively uses **environmental variables and controlled randomness** to make the experience
feel alive, non-repeating, and deeply connected to its physical/temporal context. When implementing
new UI features, agents should consider whether any of these signals could enrich the behavior:

**Environmental variables available with no additional permissions:**

- **Time of day** — current hour in user's local timezone
- **Date** — particularly relevant: all concerts are SXSW mid-March; exact date anniversaries are meaningful
- **Concert timestamp** — each Concert has a full ISO 8601 timestamp including time-of-day (when the
  photo was taken). Compare against current time for "temporal echo" effects.
- **Concert year** — SXSW data spans multiple years; older concerts can look slightly more worn ("age patina")
- **EXIF metadata** — `iso`, `aperture`, `shutterSpeed`, `camera` are stored per-concert; use them to
  vary the visual character of each match (grain, blur depth, transition speed)
- **Session state** — first match of session, time since last match, match count; track in refs
- **Audio state** — `progress` (0–1) and `isPlaying` from `useAudioPlayback`; song arc can affect visuals
- **Audio frequency data** — Howler exposes its Web Audio context via `Howler.ctx`; tap an
  `AnalyserNode` for bass-reactive glow (only when matched, zero recognition impact)
- **Motion detection** — existing `useMotionDetection` hook; camera shake can drive signal shake effects

**Environmental variables that may require a permission prompt:**

- **Device orientation** — `DeviceOrientationEvent`; no permission on Android/desktop Chrome, but iOS 13+
  requires an explicit `DeviceOrientationEvent.requestPermission()` call

**Randomness guardrails (mandatory):**

- All randomness must have explicit **min/max clamps**
- Prefer **per-session seeding** (one random value on app open, constant for the session) over
  per-frame chaos
- Stochastic events (e.g., rare CRT glitches) use Poisson-style timers (~once per several minutes),
  never continuous noise
- Random values must never make the UI feel broken or unstable — always "organic," never "buggy"

**Transition rules:**

- Environmental state changes use **CSS transitions** for smoothing — update custom properties in JS,
  let CSS handle the blend
- Dramatic state changes (match, unmatch, app open, phone unlock) are the preferred moments for
  environmental effects to activate/shift
- Never fight the `dead signal → matched` narrative; the matched state's palette always wins specificity

**Every environmental effect needs a feature flag** in `src/modules/secret-settings/config.ts`.
Use the appropriate category: `ui`, `audio`, `experimental`. Default to `true` for subtle effects,
`false` for experimental/sensor-based ones. See the planned flag IDs in
`docs/ENVIRONMENTAL_EFFECTS_IDEAS.md`.

**Performance constraint:** The recognition pipeline runs in a Web Worker with an adaptive check
interval (~80ms while tracking a candidate, ~120ms idle). Do NOT add computation to the main thread
recognition path. Environmental effects should be event-driven (on match/unmatch) or very
low-frequency (interval > 30s) or read-only from existing rAF loops already running.

## CI/CD

- **CI Pipeline** (`.github/workflows/ci.yml`): lint, format check, type-check, test with coverage,
  build, bundle size check — runs on all PRs and pushes to main
- **Visual Regression** (`.github/workflows/visual-regression.yml`): Playwright tests on Mobile Chrome
  with 0.2% pixel tolerance
- **Auto-Fix** (`.github/workflows/auto-fix-agent-pr.yml`): Auto-formats AI agent PRs (copilot/,
  claude/) on CI failure
- **Vercel**: Auto-deploys main branch to production
- **Cloudflare**: Worker deployment for audio proxy

## Environment Variables

See `.env.example` for Cloudflare R2 audio upload configuration:

- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — Cloudflare credentials
- `R2_BUCKET_NAME`, `R2_BASE_URL` — R2 bucket configuration
- No `.env` file needed for local development

## Key Documentation

- `ARCHITECTURE.md` — System design and module contracts
- `TESTING.md` — Testing strategy
- `docs/PHOTO_RECOGNITION_DEEP_DIVE.md` — Recognition algorithm details
- `docs/AUDIO_R2_WORKER.md` — Audio CDN setup
- `DOCUMENTATION_INDEX.md` — Full index of all docs

## Multi-Agent Development

Multiple Claude Code agents can work on this repo simultaneously without colliding. Each agent
should run in its own git worktree and gets an isolated dev server port so `preview_*` tools
never conflict.

### Creating a new worktree

```bash
./scripts/create-worktree.sh claude/my-feature
# or
./scripts/create-worktree.sh copilot/my-feature
```

The script:

1. Derives a slug from the branch name (strips prefix, slugifies)
2. Creates a git worktree under `.claude/worktrees/<slug>/` on a new branch
3. Writes `.claude/launch.json` with a unique port (next above the highest in use)
4. Copies `.claude/settings.json` (SessionStart hook) into the worktree

### Port scheme

Worktrees use ports in the **5200+ range** (dev) and **4200+ range** (preview), assigned
sequentially by alphabetical worktree name. The root repo uses 5173/5180 (dev) and 4173
(preview) — no overlap.

| Config name    | Port range | Notes                     |
| -------------- | ---------- | ------------------------- |
| `dev-worktree` | 5200–5299  | Use this one in worktrees |
| `photo-signal` | 4200–4299  | Production preview build  |
| Root `dev`     | 5173, 5180 | Root repo only            |

### Using the preview tools in a worktree

Always use the **`dev-worktree`** launch configuration inside a worktree session — it starts
Vite on the worktree's unique port. Do not use the `dev` or `photo-signal` configs from within
a worktree as those share ports with the root session.

---

## Agent Decision Guidelines

### When to Plan Before Implementing

**Use plan mode (or stop and describe your approach before coding) when:**

- The change touches more than 2 modules
- The change modifies shared types in `src/types/index.ts`
- The change alters the recognition pipeline or matching logic
- The change modifies `data-service.ts` or the JSON schema of v2 artifacts
- The UI change is visual and could affect the aesthetic identity

**Skip plan mode for:**

- Single-module bug fixes or feature additions
- Test additions or updates
- Documentation changes
- Formatting/lint fixes
- Changes confined to one file with no interface impact

### Before Implementing Any Change (MANDATORY)

1. Create and switch to a feature branch before implementation.
2. Tiny docs-only edits may be done on `main`, but branches are preferred.
3. Use branch prefixes `copilot/` or `claude/` for AI-agent work.

### Before Committing or Pushing (MANDATORY)

1. Run `npm run pre-commit` and confirm ALL checks pass (exit code 0).
2. If any check fails, fix the issue and re-run from scratch.
3. Never use `--no-verify` to bypass the pre-commit hook.
4. Never push to a PR without passing all checks locally first — CI failures on PRs are not acceptable.

### After Completing Implementation (MANDATORY)

1. Ask the maintainer whether the branch should be updated with the latest `main` before handoff.
2. If requested, pull/merge `main` into the feature branch and resolve conflicts.
3. Re-run `npm run pre-commit` after conflict resolution.

### Git Tooling and PR Workflow (MANDATORY)

1. Prefer `gh` CLI for PR collaboration (creation, updates, comments, review actions).
2. If `gh` is not authenticated, ask the maintainer to run `gh auth login`.
3. For larger changes, make regular logical commits rather than one large final commit.
4. Keep commits focused with clear messages, and run `npm run pre-commit` before each.
5. Open or update the PR with `gh` when implementation is complete.

### `gh` CLI Safety Notes (MANDATORY)

1. For multiline PR bodies/comments, use `--body-file` instead of inline `--body`.
2. Create body files with a quoted heredoc (`<<'EOF'`) so backticks and shell tokens are not expanded.
3. Avoid command substitution for Markdown payloads (`$(cat file.md)`) when `--body-file` is available.
4. After PR create/edit, verify with `gh pr view <number> --json title,body`.
5. After comment create/edit, verify with `gh pr view <number> --comments`.
6. To edit an existing comment: `gh api repos/<owner>/<repo>/issues/comments/<id> --method PATCH --field body=@file`.

## Module Guidelines

### Before Modifying Any Module

1. Read the module's `README.md` for its contract (API, props, responsibilities).
2. Read the module's existing tests to understand expected behavior.
3. Check `src/types/index.ts` for shared interfaces the module uses.
4. Make changes within the module directory only — do not touch other modules unless required.

### When Adding New Files

- Update `DOCUMENTATION_INDEX.md` when adding, removing, or renaming docs/files.
- Follow existing naming conventions: `kebab-case` for files, `PascalCase` for components.
- Colocate tests next to source files (`foo.ts` → `foo.test.ts`).

### When Writing Tests

- Use Vitest with the `happy-dom` environment (configured in `vitest.config.ts`).
- Import browser API mocks from `src/test/mocks.ts` when needed.
- Mock external dependencies, not internal module logic.
- Target 70%+ coverage for any new or modified module.

### Interpreting Test Results

- **PASS**: Output shows `Test Files X passed` with exit code 0
- **FAIL**: Output shows `Test Files X failed` with exit code != 0
- **Ignore**: `stderr` warnings about React `act()`, mock setup, or `console.warn` — non-critical

## Common Gotchas

- `data.app.v2.json` is large — don't read it in full; use `src/services/data-service.ts` to
  understand the data model instead.
- Browser APIs (camera, canvas, audio) are not available in tests — always use mocks from
  `src/test/mocks.ts`.
- The `scripts/` directory contains Node.js ESM `.js` files (the repo uses `"type": "module"`), not
  TypeScript — different lint rules apply and `require()` is not available.
- CSS Modules generate scoped class names at build time — reference styles via
  `import styles from './Foo.module.css'`.
- The `assets/` directory contains test data (images, audio samples). Vite serves `public/`
  statically; `assets/` is not automatically copied by the build — reference test assets by their
  source path in tests.
