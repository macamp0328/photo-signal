# Contributing to Photo Signal

## Quick Links

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — System design and module structure
- **[TESTING.md](./TESTING.md)** — Testing strategy and guidelines
- **[DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)** — Complete documentation index

---

## Getting Started

1. Fork the repository and create a feature branch
2. Set up your dev environment (see [SETUP.md](./SETUP.md))
3. Make changes following existing code patterns
4. Run `npm run pre-commit` — all checks must pass
5. Submit a pull request

---

## Pre-Commit Checks (Mandatory)

Before committing ANY code, run:

```bash
npm run pre-commit
```

This executes lint, format, type-check, tests, and build in order. **All checks must pass.** A husky git hook also enforces this, but run it explicitly first.

**Interpreting test output:**

- **PASS**: `Test Files X passed` with exit code 0 (ignore `stderr` warnings about React `act()` or mocks)
- **FAIL**: `Test Files X failed` with exit code != 0

---

## Code Style

- **TypeScript**: Strict mode, no `any`, typed props and return values
- **Prettier**: 100 chars, 2-space indent, single quotes, semicolons, trailing commas (ES5)
- **CSS**: CSS Modules only — scoped per component
- **Components**: Functional with hooks, typed props interfaces
- **Files**: `kebab-case` for files, `PascalCase` for components

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(audio): add crossfade between tracks
fix(camera): handle permission denial gracefully
docs(readme): update setup instructions
test(motion): add motion detection tests
chore(deps): update vite to 7.2.0
```

---

## Module Guidelines

### Before Modifying a Module

1. Read the module's `README.md` for its API contract
2. Read existing tests to understand expected behavior
3. Check `src/types/index.ts` for shared interfaces
4. Keep changes within the module directory

### When Adding a New Module

1. Create `src/modules/new-module/` with `README.md`, `index.ts`, `types.ts`
2. Write the contract (README) before the implementation
3. Colocate tests next to source files
4. Update `DOCUMENTATION_INDEX.md`

---

## Testing

- **Framework**: Vitest with `happy-dom` environment
- **Colocated tests**: `foo.ts` → `foo.test.ts`
- **Integration tests**: `src/__tests__/integration/`
- **Browser API mocks**: `src/test/mocks.ts` (camera, canvas, audio, fetch)
- **Coverage**: 70% minimum threshold per module

---

## AI Agent Requirements

AI agents (Copilot, Claude Code, etc.) must:

1. Run `npm run pre-commit` before every commit — no exceptions
2. Fix CI failures immediately without waiting for maintainer notification
3. Read module READMEs before making changes
4. Update `DOCUMENTATION_INDEX.md` when adding or removing files
5. Keep changes minimal and focused
6. Ask the maintainer whether to sync the feature branch with latest `main` before PR handoff
7. If requested, pull/merge `main` and resolve conflicts, then re-run `npm run pre-commit`
8. Prefer `gh` CLI for commit/PR workflows instead of GitKraken tooling
9. If `gh` is not authenticated, ask the maintainer to run `gh auth login` before continuing PR tasks
10. For larger changes, commit in regular logical checkpoints and open/update the PR with `gh` when complete

The `auto-fix-agent-pr` workflow auto-fixes lint/format issues on `copilot/` and `claude/` branches when CI fails — but agents should not rely on it.

Agent-specific instructions:

- **Claude Code**: See [CLAUDE.md](./CLAUDE.md)
- **GitHub Copilot**: See [.github/copilot-instructions.md](./.github/copilot-instructions.md)

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
