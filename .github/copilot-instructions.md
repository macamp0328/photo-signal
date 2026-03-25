# GitHub Copilot Instructions — Photo Signal

> This document is derived from `CLAUDE.md` (repo root) and kept consistent for overlapping
> sections. It is not identical — some CLAUDE.md sections are omitted here and Copilot-specific
> structure is added. `CLAUDE.md` is the canonical source. Update both files when making structural
> changes.

## CRITICAL: Pre-Commit Rule (Read This First)

**NEVER commit or push code that fails CI.** Before EVERY commit, you MUST run:

```bash
npm run pre-commit
```

This runs lint, format, type-check, tests, build, and a bundle-size check. If ANY step fails, fix it before committing.
Do NOT use `--no-verify` to skip hooks.

**Common failure: formatting.** Always run `npm run format` after making changes. Prettier mismatches
are the #1 cause of CI failures.

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
  maintainer rarely writes code by hand.
- **No commercial pressure.** No team, no velocity goals. Craft and creative quality matter more than
  shipping speed.
- **Intentionally over-engineered.** The recognition + metadata + playback layer is designed to be
  reusable across content types. This is deliberate design scope, not accidental complexity.

**Implication**: do not reflexively simplify the architecture in the name of "YAGNI." The
extensibility is the design intent. Work within the existing patterns.

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

## Architecture

### Data Flow

```
Camera Access → Motion Detection → Photo Recognition → Audio Playback
                                                     → Concert Info Display
```

### Module Summary

All feature code lives in `src/modules/` — each module is self-contained with its own component/hook,
tests, and CSS Module:

| Module                      | Responsibility                               |
| --------------------------- | -------------------------------------------- |
| `audio-playback`            | Howler.js playback, fading, volume           |
| `camera-access`             | MediaStream permissions                      |
| `camera-view`               | Video display with 3:2/2:3 framing overlays  |
| `concert-info`              | Concert metadata overlay                     |
| `debug-overlay`             | Real-time recognition diagnostics            |
| `gallery-layout`            | Zine-like gallery UI                         |
| `motion-detection`          | Camera movement detection via pixel analysis |
| `photo-recognition`         | pHash photo recognition                      |
| `photo-rectangle-detection` | Dynamic rectangle detection                  |
| `secret-settings`           | Hidden settings menu                         |

### Data Layer

- Runtime data: `public/data.app.v2.json` (app metadata) + `public/data.recognition.v2.json` (hashes)
- Service abstraction: `src/services/data-service.ts` — use this, don't read the large JSON directly
- Shared types: `src/types/index.ts` (`Concert`, `HashSet`)

## Visual and Aesthetic Identity

The UI has a deliberate visual character — **era-matched gig poster / zine aesthetic**. It should feel
like a physical artifact from the punk/indie concert era, not a generic mobile app.

- **CRT phosphor glow, scan lines, and the "dead signal" → "matched" state transition are
  intentional.** Do not remove or simplify these as "unnecessary" complexity.
- **The per-concert color palette is derived from band name + day-of-week (FNV-1a hash).** Consistent
  and reproducible — not random. Logic lives in `src/utils/concert-palette.ts`.
- **Typography, spacing, and overlay composition are load-bearing aesthetic choices**, not placeholder
  styles.
- When making UI changes, preserve the existing visual character. If a change would significantly alter
  the look or feel, stop and describe the approach before implementing — don't redesign silently.
- For the full design token reference (CSS custom properties, typography, animation vocabulary), see
  `docs/DESIGN_SYSTEM.md`. For canonical state vocabulary, see `docs/STATES_AND_DESIGN_LANGUAGE.md`.

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
- Scoped class names per component — reference via `import styles from './Foo.module.css'`

### Testing

- Test files colocated with source: `*.test.ts` / `*.test.tsx`
- 70% minimum coverage threshold (lines, functions, branches, statements)
- Browser API mocks in `src/test/mocks.ts` (camera, canvas, audio, fetch, localStorage)
- Tests pass when output shows `Test Files X passed` with exit code 0 — stderr warnings are non-critical

### Design Philosophy

- **Add complexity only when it serves the project's explicit extensibility goals.** Don't add it for
  hypothetical future features.
- **Work within the existing architecture.** Resist introducing new abstractions (state libraries, new
  service layers) unless existing patterns are genuinely insufficient.
- **The 70% coverage threshold is a floor, not a goal.** Add tests that verify real behavior, not just
  to hit numbers.
- **Don't over-engineer single-use logic.** Three similar lines are better than a premature
  abstraction.

## Agent Decision Guidelines

### When to Plan Before Implementing

**Stop and describe your approach before coding when:**

- The change touches more than 2 modules
- The change modifies shared types in `src/types/index.ts`
- The change alters the recognition pipeline or matching logic
- The change modifies `data-service.ts` or the JSON schema of v2 artifacts
- The UI change is visual and could affect the aesthetic identity

**Just implement (no plan needed) for:**

- Single-module bug fixes or feature additions
- Test additions or updates
- Documentation changes
- Formatting/lint fixes

### Before Committing or Pushing (MANDATORY)

1. Create a feature branch — use prefix `copilot/` for Copilot-initiated work.
2. Run `npm run pre-commit` — confirm ALL checks pass (exit code 0).
3. Never use `--no-verify` to bypass the pre-commit hook.
4. Never push without passing all checks locally first.

### After Completing Implementation (MANDATORY)

1. Ask the maintainer whether to sync with latest `main` before handoff.
2. If requested, merge `main` and resolve conflicts, then re-run `npm run pre-commit`.
3. Open or update the PR with `gh` CLI when done.

### `gh` CLI Notes

- Use `--body-file` for multiline PR bodies/comments (not inline `--body`).
- Create body files with `<<'EOF'` heredoc so backticks aren't expanded.
- Verify after PR create/edit: `gh pr view <number> --json title,body`.

## Module Guidelines

### Before Modifying Any Module

1. Read the module's `README.md` for its contract (API, props, responsibilities).
2. Read the module's existing tests to understand expected behavior.
3. Check `src/types/index.ts` for shared interfaces.
4. Make changes within the module directory only — don't touch other modules unless required.

### When Adding New Files

- Update `DOCUMENTATION_INDEX.md` when adding, removing, or renaming docs/files.
- Naming: `kebab-case` for files, `PascalCase` for components.
- Colocate tests: `foo.ts` → `foo.test.ts`.

### When Writing Tests

- Use Vitest with `happy-dom` environment (see `vitest.config.ts`).
- Import browser API mocks from `src/test/mocks.ts`.
- Mock external dependencies, not internal module logic.

## Common Gotchas

- `data.app.v2.json` is large — don't read it directly; use `src/services/data-service.ts`.
- Browser APIs (camera, canvas, audio) are not available in tests — use mocks from `src/test/mocks.ts`.
- `scripts/` are ESM `.js` files (repo uses `"type": "module"`), not TypeScript — different lint rules
  apply and `require()` is not available.
- CSS Modules generate scoped class names at build time — use `import styles from './Foo.module.css'`.
- The `assets/` directory contains test data. Vite serves `public/` statically; `assets/` is not
  automatically copied by the build — reference test assets by their source path in tests.
