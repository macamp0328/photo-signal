<!--
🤖 FOR AI AGENTS: Before committing ANY changes, you MUST run:
  npm run lint:fix && npm run format && npm run type-check && npm run test:run && npm run build

This is AUTOMATIC - run these checks without being asked. If any fail, fix them before committing.
The user expects this as standard workflow, not an optional step.
-->

## What

<!-- Brief description of what changed -->

## Why

<!-- Why this change is needed (reference issue number if applicable) -->

Closes #

## How

<!-- How the change was implemented -->

## Testing

**Code Quality Checks** (REQUIRED - all must pass ✅):

- [ ] **Linting**: `npm run lint` - No errors
- [ ] **Formatting**: `npm run format:check` - All files formatted
- [ ] **Type Checking**: `npm run type-check` - No type errors
- [ ] **Build**: `npm run build` - Successful production build
- [ ] **Tests**: `npm run test:run` - All tests passing
- [ ] **Bundle Size**: Checked and within limits

**Manual Testing**:

- [ ] Tested functionality manually
- [ ] Verified in browser (if UI changes)
- [ ] Checked mobile responsiveness (if UI changes)
- [ ] No console errors

**Testing Details**:

<!-- Describe how you tested this change -->

## Screenshots

<!-- Add screenshots for UI changes, before/after comparisons -->

## Documentation

- [ ] Updated module README if contract changed
- [ ] Updated DOCUMENTATION_INDEX.md if files added/removed/moved
- [ ] Updated ARCHITECTURE.md if structure changed
- [ ] Updated SETUP.md if workflow changed
- [ ] Updated .github/copilot-instructions.md if relevant

**Documentation Changes**:

<!-- List documentation files updated -->

## Security

- [ ] No secrets committed
- [ ] Dependencies audited: `npm audit`
- [ ] No new critical vulnerabilities
- [ ] Input validation added (if applicable)

## For AI Agents Only

**AI Agent Responsibilities** (Complete before requesting review):

- [ ] I have read and understood [CONTRIBUTING.md](../CONTRIBUTING.md)
- [ ] All GitHub Actions checks are passing ✅
- [ ] I will monitor this PR for CI failures and fix them immediately
- [ ] I have verified changes are minimal and surgical
- [ ] Module contracts remain compatible
- [ ] I ran all quality checks locally before pushing

**If ANY GitHub Actions check fails**:

1. I will investigate the failure using GitHub Actions logs
2. I will fix the root cause locally
3. I will verify the fix with local checks
4. I will push the fix and verify checks now pass
5. I will NOT wait for maintainer notification

## Reviewer Notes

<!-- Any additional context for reviewers -->

---

## Pre-Merge Checklist (Maintainers)

- [ ] All GitHub Actions checks passing
- [ ] Code review approved
- [ ] Documentation updated appropriately
- [ ] No merge conflicts
- [ ] Security considerations addressed
- [ ] Bundle size acceptable

---

**Note**: PRs with failing GitHub Actions checks will not be reviewed. AI agents must fix all failures proactively before requesting review. See [CONTRIBUTING.md](../CONTRIBUTING.md) for complete guidelines.
