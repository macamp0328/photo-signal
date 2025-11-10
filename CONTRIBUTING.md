# Contributing to Photo Signal

Thank you for your interest in contributing to Photo Signal! This document outlines the contribution process and quality standards for all contributors, including AI agents.

---

## 📚 Quick Links

- **[README.md](./README.md)** - Project overview and features
- **[SETUP.md](./SETUP.md)** - Development environment setup
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and module structure
- **[TESTING.md](./TESTING.md)** - Testing strategy and guidelines
- **[DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)** - Complete documentation index

---

## 🤝 How to Contribute

### For Human Contributors

1. **Fork the repository** and create a feature branch
2. **Set up your development environment** (see [SETUP.md](./SETUP.md))
3. **Make your changes** following our code style guidelines
4. **Write tests** for new functionality (see [TESTING.md](./TESTING.md))
5. **Run quality checks** before committing (see below)
6. **Submit a pull request** using the PR template
7. **Respond to review feedback** promptly

### For AI Agents

AI agents must follow additional requirements to ensure high-quality, production-ready PRs:

1. **Understand the architecture** by reading [ARCHITECTURE.md](./ARCHITECTURE.md) and [AI_AGENT_GUIDE.md](./AI_AGENT_GUIDE.md)
2. **Read module contracts** before making changes (each module's README.md)
3. **Make minimal, surgical changes** - only modify what's necessary
4. **Run all quality checks** and fix failures before submitting PR
5. **Monitor your PRs** for CI failures and fix them proactively
6. **Update documentation** when changing contracts or adding features
7. **Use the PR template** and complete all checklist items

---

## ✅ Quality Gates (Required for All PRs)

### Pre-Commit Checks

Before committing ANY code, you MUST run and pass all of these checks:

```bash
# Auto-fix linting issues
npm run lint:fix

# Auto-format all files
npm run format

# Validate TypeScript types
npm run type-check

# Create production bundle
npm run build

# Run test suite
npm run test:run
```

**All checks must pass with zero errors before committing.**

### Pre-PR Submission Checks

Before opening a pull request, verify:

- [ ] All local quality checks pass (lint, format, type-check, build, tests)
- [ ] Code follows project style guidelines (Prettier, ESLint)
- [ ] TypeScript strict mode compliance (no `any`, proper types)
- [ ] Module contracts remain compatible (for module changes)
- [ ] Documentation updated (README, module docs, DOCUMENTATION_INDEX.md)
- [ ] No unnecessary files committed (use .gitignore for build artifacts, node_modules)
- [ ] Commit messages follow Conventional Commits format

---

## 🤖 AI Agent PR Policy

### Mandatory Requirements

**ALL pull requests created by AI agents MUST:**

1. **Pass all GitHub Actions checks** before requesting review
   - ✅ ESLint (no linting errors)
   - ✅ Prettier (code properly formatted)
   - ✅ TypeScript (no type errors)
   - ✅ Build (successful production build)
   - ✅ Tests (all tests passing)
   - ✅ Bundle size (within limits)
   - ✅ npm audit (no critical vulnerabilities)

2. **Proactively monitor PRs** for CI failures
   - Check PR status after submission
   - If ANY check fails, investigate and fix immediately
   - Do NOT wait for maintainer notification
   - Re-run checks after fixes to verify resolution

3. **Fix failures autonomously**
   - Diagnose the root cause of failures
   - Apply appropriate fixes
   - Verify fixes resolve the issue
   - Push updates to the PR branch

4. **Maintain documentation**
   - Update DOCUMENTATION_INDEX.md when adding/removing files
   - Update module READMEs when changing contracts
   - Update .github/copilot-instructions.md if relevant

### Consequences of Non-Compliance

PRs with failing checks will be:

- **Flagged with automated comments** requesting fixes
- **Labeled** as "needs-fixes" or "ci-failing"
- **Not reviewed** until all checks pass
- **Closed automatically** if not fixed within 7 days

### Best Practices for AI Agents

- **Test locally first**: Always run all checks before pushing
- **Small, focused changes**: Keep PRs minimal and targeted
- **Clear descriptions**: Explain what changed and why
- **Respond quickly**: Fix issues within hours, not days
- **Learn from failures**: Update your process to avoid repeat issues

---

## 📝 Pull Request Process

### 1. Create Your PR

Use the PR template (automatically loaded) and fill out all sections:

- **What**: Brief description of changes
- **Why**: Reason for the change
- **How**: Implementation approach
- **Testing**: Verification steps
- **Documentation**: Updated files
- **Checklist**: Complete all items

### 2. Automated Checks

Upon PR creation, GitHub Actions will automatically run:

1. **Lint** - ESLint code quality checks
2. **Format** - Prettier formatting verification
3. **Type Check** - TypeScript type validation
4. **Tests** - Vitest test suite with coverage
5. **Build** - Production bundle creation
6. **Bundle Size** - Verify bundle stays within limits
7. **Security Audit** - Check for vulnerable dependencies

**All checks must pass** ✅

### 3. CI Failure Response

If ANY check fails:

**For AI Agents:**

1. Receive automated comment on PR (within 5 minutes)
2. Investigate failure using GitHub Actions logs
3. Fix the root cause locally
4. Run checks locally to verify fix
5. Push fix to PR branch
6. Verify checks now pass in GitHub

**For Humans:**

1. Review the failed check details
2. Fix issues locally
3. Run checks locally: `npm run lint:fix && npm run format && npm run type-check && npm run build && npm run test:run`
4. Push fixes and verify checks pass

### 4. Code Review

Once all checks pass:

- Maintainers will be notified
- Review feedback will be provided
- Address feedback and push updates
- Repeat until approved

### 5. Merge

After approval and all checks passing:

- PR will be merged to main
- Vercel will auto-deploy to production
- Branch will be deleted

---

## 🎨 Code Style Guidelines

### General Principles

- **Clarity over cleverness**: Write self-documenting code
- **Consistency**: Follow existing patterns
- **Minimal changes**: Only modify what's necessary
- **Type safety**: Use TypeScript types everywhere
- **Modularity**: Keep components and modules isolated

### TypeScript

```typescript
// ✅ DO: Use explicit types
interface UserData {
  id: number;
  name: string;
  email: string;
}

function getUser(id: number): Promise<UserData> {
  // ...
}

// ❌ DON'T: Use implicit any
function getUser(id) {
  // ...
}
```

### React Components

```typescript
// ✅ DO: Functional components with typed props
interface ButtonProps {
  onClick: () => void;
  label: string;
}

export function Button({ onClick, label }: ButtonProps) {
  return <button onClick={onClick}>{label}</button>;
}

// ❌ DON'T: Class components or missing types
export function Button({ onClick, label }) {
  return <button onClick={onClick}>{label}</button>;
}
```

### File Structure

```
src/modules/example-module/
├── README.md              # API contract and usage
├── index.ts               # Public exports only
├── types.ts               # TypeScript interfaces
├── ExampleModule.tsx      # Component implementation
├── ExampleModule.test.tsx # Unit tests
└── useExampleModule.ts    # Custom hooks (if needed)
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style/formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**

```
feat(audio): add crossfade between tracks
fix(camera): handle permission denial gracefully
docs(contributing): add AI agent PR policy
test(motion): add motion detection tests
chore(deps): update vite to 7.2.0
```

---

## 🧪 Testing Requirements

### Test Coverage Goals

- **Minimum**: 70% code coverage per module
- **Target**: 80%+ code coverage overall
- **Critical paths**: 100% coverage (camera access, audio playback)

### Writing Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('ComponentName', () => {
  it('should render with default props', () => {
    render(<ComponentName />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const handleClick = vi.fn();
    render(<ComponentName onClick={handleClick} />);

    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Running Tests

```bash
# Run all tests once
npm run test:run

# Run tests in watch mode (during development)
npm test

# Run with coverage report
npm run test:coverage

# Run with UI
npm run test:ui
```

---

## 🔒 Security Guidelines

### Dependency Security

- **Check vulnerabilities**: Run `npm audit` before adding dependencies
- **Update regularly**: Keep dependencies current with Dependabot
- **Minimal dependencies**: Only add what's truly needed
- **Verify licenses**: Ensure compatibility with MIT license

### Code Security

- **No secrets**: Never commit API keys, tokens, or passwords
- **Validate inputs**: Sanitize all user inputs
- **HTTPS only**: All external resources must use HTTPS
- **Browser APIs**: Handle permissions securely (camera, audio)

### GitHub Actions Security

- **Minimal permissions**: Use least privilege principle
- **Verified actions**: Only use trusted GitHub Actions
- **Secrets management**: Store sensitive data in GitHub Secrets
- **Code scanning**: Enable CodeQL for vulnerability detection

---

## 📖 Documentation Standards

### When to Update Documentation

Update documentation when you:

- **Add/remove/move files**: Update DOCUMENTATION_INDEX.md
- **Change module contracts**: Update module's README.md
- **Add features**: Update relevant docs (README, ARCHITECTURE, etc.)
- **Modify workflows**: Update SETUP.md and copilot-instructions.md
- **Change dependencies**: Update package.json and SETUP.md

### Documentation Style

- **Clear headings**: Use semantic hierarchy (H1, H2, H3)
- **Code examples**: Include usage examples for APIs
- **Concise**: Keep explanations brief and focused
- **Links**: Use relative links to other docs
- **Emojis**: Use sparingly for visual hierarchy (✅, ❌, 📚, etc.)

---

## 🚀 Deployment

### Automatic Deployment

- **Production**: Merges to `main` auto-deploy to Vercel
- **Preview**: All PRs get preview deployment links
- **Staging**: Not currently configured

### Manual Deployment

```bash
# Build production bundle
npm run build

# Preview production build locally
npm run preview

# Deploy to Vercel (requires Vercel CLI)
vercel --prod
```

---

## 🆘 Getting Help

### Resources

1. **Documentation**: Check [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) first
2. **Architecture**: Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
3. **Setup Issues**: See [SETUP.md](./SETUP.md) troubleshooting section
4. **Module Contracts**: Read module READMEs for API details

### Asking Questions

When asking for help:

1. **Search existing issues** first
2. **Provide context**: What are you trying to do?
3. **Share error messages**: Full stack traces help
4. **Show what you tried**: What debugging steps did you take?
5. **Minimal reproduction**: Simplify to smallest failing case

### Reporting Bugs

Use GitHub Issues with:

- **Clear title**: Describe the bug concisely
- **Steps to reproduce**: Numbered, specific steps
- **Expected behavior**: What should happen?
- **Actual behavior**: What actually happens?
- **Environment**: OS, browser, Node version
- **Screenshots**: If applicable

---

## 📋 Checklist for AI Agents

Before submitting a PR, verify:

### Code Quality

- [ ] ESLint passes: `npm run lint`
- [ ] Prettier formatted: `npm run format`
- [ ] TypeScript validates: `npm run type-check`
- [ ] Build succeeds: `npm run build`
- [ ] Tests pass: `npm run test:run`

### Documentation

- [ ] DOCUMENTATION_INDEX.md updated (if files added/removed)
- [ ] Module README updated (if contract changed)
- [ ] Commit messages follow Conventional Commits
- [ ] PR description complete and accurate

### Testing

- [ ] New features have tests
- [ ] Modified code covered by tests
- [ ] Tests run locally and pass
- [ ] Coverage meets minimum thresholds

### Security

- [ ] No secrets committed
- [ ] Dependencies audited: `npm audit`
- [ ] No new critical vulnerabilities
- [ ] Input validation added (if applicable)

### CI/CD

- [ ] All GitHub Actions checks pass
- [ ] No failing workflows
- [ ] Bundle size within limits
- [ ] Preview deployment successful

---

## 🎯 Summary

**Key Points to Remember:**

1. **Quality first**: All checks must pass before review
2. **Test thoroughly**: Write tests, run tests, verify tests
3. **Document changes**: Keep docs current and accurate
4. **Monitor your PRs**: Fix CI failures immediately
5. **Communicate clearly**: Use PR template, explain changes
6. **Be responsive**: Address feedback quickly
7. **Follow conventions**: Code style, commits, file structure
8. **Respect the architecture**: Keep modules isolated and contracts compatible

---

## 📄 License

By contributing to Photo Signal, you agree that your contributions will be licensed under the MIT License.

---

## 🙏 Thank You

Your contributions make Photo Signal better! We appreciate your effort to maintain high quality standards and follow our development workflow.

If you have questions or suggestions for improving this guide, please open an issue or submit a PR.

---

**Last Updated**: 2025-11-10
