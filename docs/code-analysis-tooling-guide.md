# Code Analysis Tooling Guide

> **Purpose**: Comprehensive guide to understanding, using, and interpreting the automated code analysis tools integrated into Photo Signal.

**Last Updated**: 2025-11-10  
**See also**: [docs/code-analysis-tooling-research.md](./code-analysis-tooling-research.md) for research and tool selection rationale.

---

## Overview

Photo Signal uses a comprehensive suite of free, open-source code analysis tools to ensure code quality, security, and maintainability. All tools run automatically in CI/CD and provide feedback on pull requests.

### Tooling Stack

| Tool                  | Purpose                           | Runs On          | Documentation                               |
| --------------------- | --------------------------------- | ---------------- | ------------------------------------------- |
| **CodeQL**            | Security vulnerability scanning   | PR, Push, Weekly | [CodeQL Docs](#codeql-security-scanning)    |
| **Codecov**           | Test coverage tracking            | PR, Push         | [Codecov Docs](#codecov-coverage-reporting) |
| **npm audit**         | Dependency vulnerability scanning | PR, Push         | [npm audit Docs](#npm-audit)                |
| **Dependabot**        | Automated dependency updates      | Weekly           | [Dependabot Docs](#dependabot)              |
| **Bundle Size Check** | Build size regression detection   | PR, Push         | [Bundle Size Docs](#bundle-size-checking)   |
| **ESLint**            | Code linting                      | PR, Push         | [ESLint Docs](#eslint)                      |
| **Prettier**          | Code formatting                   | PR, Push         | [Prettier Docs](#prettier)                  |
| **TypeScript**        | Type checking                     | PR, Push         | [TypeScript Docs](#typescript)              |
| **Vitest**            | Testing framework                 | PR, Push         | [Vitest Docs](#vitest)                      |

---

## CodeQL Security Scanning

### What is CodeQL?

CodeQL is GitHub's semantic code analysis engine that treats code as data, allowing queries to find security vulnerabilities and code quality issues.

### When It Runs

- On every push to `main` branch
- On every pull request
- Every Monday at 6 AM UTC (scheduled scan)

### What It Checks

- **Security vulnerabilities**: SQL injection, XSS, command injection, etc.
- **Code quality issues**: Unused variables, dead code, complexity
- **Best practices**: Following secure coding patterns

### Workflow File

`.github/workflows/codeql.yml`

### Interpreting Results

Results appear in:

1. **Security tab** of the repository
2. **PR checks** (will block merge if critical issues found)
3. **Workflow run logs**

#### Example Alert:

```
Alert: Client-side cross-site scripting
Location: src/components/InfoDisplay.tsx:45
Severity: High
Description: User-controlled data flows into DOM without sanitization

Recommendation: Use textContent instead of innerHTML, or sanitize input
```

#### How to Fix:

1. Click on the alert to see the data flow
2. Review the recommendation
3. Fix the issue in your code
4. Push the fix
5. CodeQL will re-scan automatically

### Configuration

- **Queries**: `security-extended` and `security-and-quality`
- **Language**: JavaScript/TypeScript
- **Auto-build**: Enabled (automatically detects build process)

### Customization

To add custom queries, create `.github/codeql/queries/` and reference in the workflow.

---

## Codecov Coverage Reporting

### What is Codecov?

Codecov tracks test coverage over time and shows coverage changes in pull requests.

### When It Runs

- On every push to `main` branch
- On every pull request

### What It Checks

- **Line coverage**: Percentage of lines executed by tests
- **Branch coverage**: Percentage of conditional branches tested
- **Function coverage**: Percentage of functions called by tests
- **Coverage delta**: How PR changes affect overall coverage

### Workflow Integration

In `.github/workflows/ci.yml`:

```yaml
- name: Run tests with coverage
  run: npm run test:coverage

- name: Upload coverage reports to Codecov
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
```

### Interpreting Results

#### PR Comment Example:

```
codecov/project: 72.4% (+0.3%) ✅
codecov/patch: 85.0% (target: 70%) ✅

Files changed: 2
  src/modules/camera-view/CameraView.tsx: 95.2% → 96.1% (+0.9%)
  src/services/data-service/DataService.ts: 68.4% → 71.2% (+2.8%)
```

#### Coverage Thresholds:

- **Target**: 70% minimum coverage
- **Configured in**: `vitest.config.ts`

```typescript
coverage: {
  lines: 70,
  functions: 70,
  branches: 70,
  statements: 70,
}
```

### Viewing Detailed Reports

1. Click "Details" on Codecov PR check
2. View line-by-line coverage
3. See which files need more tests

### Setup Requirements

**One-time setup**:

1. Sign up at [codecov.io](https://codecov.io)
2. Connect GitHub repository
3. Add `CODECOV_TOKEN` to repository secrets
   - Go to: Settings → Secrets and variables → Actions
   - Name: `CODECOV_TOKEN`
   - Value: From Codecov dashboard

---

## npm audit

### What is npm audit?

Scans dependencies for known security vulnerabilities using GitHub's advisory database.

### When It Runs

- On every push to `main` branch
- On every pull request
- During `npm install` (locally)

### What It Checks

- **Direct dependencies**: Packages in `dependencies`
- **Dev dependencies**: Packages in `devDependencies`
- **Transitive dependencies**: Dependencies of dependencies

### Workflow Integration

In `.github/workflows/ci.yml`:

```yaml
- name: Audit dependencies for vulnerabilities
  run: npm audit --audit-level=moderate
  continue-on-error: true
```

### Interpreting Results

#### Example Output:

```
found 2 moderate severity vulnerabilities
  Moderate: Prototype Pollution in lodash
  Package: lodash
  Dependency of: react-scripts
  Path: react-scripts > webpack > lodash
  More info: https://github.com/advisories/GHSA-...
```

#### Severity Levels:

- **Critical**: Immediate action required
- **High**: Fix as soon as possible
- **Moderate**: Fix in next release
- **Low**: Fix when convenient

### How to Fix:

```bash
# Update vulnerable packages
npm audit fix

# Force update (may break things)
npm audit fix --force

# Manual fix: update package.json and reinstall
npm install package@latest
```

### Why `continue-on-error: true`?

- Prevents CI from failing on low-severity issues
- Still logs issues for review
- Can be made strict later: remove `continue-on-error`

---

## Dependabot

### What is Dependabot?

GitHub's automated dependency update service that creates PRs for outdated packages.

### When It Runs

- Every Monday at 6 AM UTC
- Scans both npm and GitHub Actions

### What It Does

1. Checks for newer versions of dependencies
2. Groups related updates (dev deps, production deps)
3. Creates pull requests with updates
4. Runs all CI checks on the PR

### Configuration

`.github/dependabot.yml`:

```yaml
updates:
  - package-ecosystem: 'npm'
    directory: '/'
    schedule:
      interval: 'weekly'
    open-pull-requests-limit: 5
    groups:
      dev-dependencies:
        patterns: ['@types/*', 'eslint*', 'prettier']
```

### PR Example:

```
Title: chore(deps): Bump @vitejs/plugin-react from 5.0.0 to 5.1.0

This PR updates @vitejs/plugin-react to the latest version.

Release notes:
- Fixed HMR issue with React 19
- Improved build performance

Compatibility: ✅ All checks passed
```

### How to Handle Dependabot PRs:

1. **Review the changes**: Check release notes
2. **Run tests locally** (optional): `git checkout <branch> && npm test`
3. **Merge if CI passes**: Green checkmarks = safe to merge
4. **Close if breaking**: Comment why and close PR

### Labels

Dependabot PRs are automatically labeled:

- `dependencies`: All dependency updates
- `github-actions`: Action updates
- `automated`: Auto-generated PR

---

## Bundle Size Checking

### What is It?

A custom script that monitors build output size and fails CI if bundles exceed limits.

### When It Runs

- On every push to `main` branch
- On every pull request
- After successful build

### What It Checks

- **JavaScript bundle size** (gzipped): ≤ 80 KB
- **CSS bundle size** (gzipped): ≤ 3 KB
- **Total bundle**: ≤ 83 KB

### Script Location

`scripts/check-bundle-size.sh`

### Interpreting Results

#### Passing Check:

```
📦 Bundle Size Analysis
=======================

JavaScript Bundle:
  File: index-abc123.js
  Raw:     234 KB
  Gzipped: 72 KB
  Limit:   80 KB
  Status: ✅ PASS

CSS Bundle:
  File: index-xyz789.css
  Raw:     7 KB
  Gzipped: 1 KB
  Limit:   3 KB
  Status: ✅ PASS

Total Bundle: 73 KB
✅ All bundle size checks passed!
```

#### Failing Check:

```
JavaScript Bundle:
  Gzipped: 85 KB
  Limit:   80 KB
  Status: ❌ FAIL (exceeds limit by 5 KB)

❌ Bundle size check failed. Consider:
   - Code splitting
   - Removing unused dependencies
   - Tree-shaking optimization
   - Lazy loading components
```

### How to Fix Bundle Size Issues:

1. **Identify large dependencies**:

   ```bash
   npm run build
   # Look at build output to see file sizes
   ```

2. **Use bundle analysis**:

   ```bash
   npx vite-bundle-visualizer
   ```

3. **Optimize**:
   - Remove unused imports
   - Lazy load heavy components
   - Use dynamic imports: `const Module = lazy(() => import('./Module'))`
   - Replace heavy dependencies with lighter alternatives

4. **Update limits** (if justified):
   Edit `scripts/check-bundle-size.sh`:
   ```bash
   MAX_JS_SIZE_KB=85  # Increased from 80
   ```

---

## ESLint

### What is ESLint?

JavaScript/TypeScript linter that enforces code quality and style rules.

### When It Runs

- On every push to `main` branch
- On every pull request
- Pre-commit (if git hooks configured)
- On-save in VS Code (if configured)

### Configuration

`eslint.config.js` (flat config format)

### Rules Enforced

- **TypeScript strict rules**: Type safety
- **React Hooks rules**: Prevent hook errors
- **React Refresh rules**: Ensure HMR works
- **Prettier integration**: No style conflicts

### Running Locally

```bash
# Check for errors
npm run lint

# Auto-fix issues
npm run lint:fix
```

### Example Output:

```
src/components/Camera.tsx
  45:7  error  'useState' is not defined  no-undef
  52:3  warning  Unexpected console statement  no-console

✖ 2 problems (1 error, 1 warning)
```

### How to Fix:

1. **Auto-fix**: Run `npm run lint:fix`
2. **Manual fix**: Edit the file and fix the issue
3. **Disable rule** (if necessary):
   ```typescript
   // eslint-disable-next-line no-console
   console.log('Debug info');
   ```

---

## Prettier

### What is Prettier?

Opinionated code formatter that ensures consistent code style.

### When It Runs

- On every push to `main` branch
- On every pull request
- On-save in VS Code (if configured)

### Configuration

`.prettierrc.json`:

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 100
}
```

### Running Locally

```bash
# Check formatting
npm run format:check

# Auto-format all files
npm run format
```

### Example Output:

```
Checking formatting...
src/App.tsx
src/components/Camera.tsx
Code style issues found. Run 'npm run format' to fix.
```

---

## TypeScript

### What is TypeScript?

Statically typed superset of JavaScript that catches type errors at compile time.

### When It Runs

- On every push to `main` branch
- On every pull request
- During build (`npm run build`)
- In VS Code (real-time)

### Configuration

- `tsconfig.json`: Root config
- `tsconfig.app.json`: App-specific config
- `tsconfig.node.json`: Node-specific config

### Strict Mode Enabled

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true
}
```

### Running Locally

```bash
npm run type-check
```

### Example Output:

```
src/components/Camera.tsx:45:7 - error TS2554:
  Expected 2 arguments, but got 1.

45   const [stream, setStream] = useState();
                                 ~~~~~~~~~

Found 1 error.
```

---

## Vitest

### What is Vitest?

Fast unit testing framework for Vite projects, compatible with Jest API.

### When It Runs

- On every push to `main` branch
- On every pull request

### Configuration

`vitest.config.ts`

### Running Locally

```bash
# Run all tests
npm test

# Run once (CI mode)
npm run test:run

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui
```

### Example Output:

```
 ✓ src/App.test.tsx (2 tests)
 ✓ src/modules/camera-view/CameraView.test.tsx (12 tests)
 ✓ src/modules/photo-recognition/algorithms/__tests__/dhash.test.ts (17 tests)

 Test Files  11 passed (11)
      Tests  241 passed (241)
   Duration  2.32s
```

### Coverage Report:

```
File                                | % Stmts | % Branch | % Funcs | % Lines
------------------------------------|---------|----------|---------|--------
All files                           |   72.4  |   68.2   |   75.1  |   72.4
 camera-view/CameraView.tsx         |   95.2  |   89.5   |  100.0  |   95.2
 photo-recognition/PhotoRecognition |   68.4  |   62.1   |   70.0  |   68.4
```

---

## Pull Request Checks Summary

When you open a PR, you'll see these checks:

### Required Checks (Must Pass):

- ✅ **ESLint** - Code quality
- ✅ **Prettier** - Code formatting
- ✅ **TypeScript** - Type checking
- ✅ **Vitest** - All tests passing
- ✅ **Build** - Production build succeeds
- ✅ **Bundle Size** - Size within limits

### Optional Checks (Informational):

- ℹ️ **npm audit** - Dependency vulnerabilities
- ℹ️ **Codecov** - Coverage report

### Security Checks (Async):

- 🔒 **CodeQL** - Security scanning (may take 5-10 minutes)

### Example PR Check Status:

```
✅ CI / lint-format-type-check-build
✅ CodeQL / Analyze (javascript)
✅ codecov/project
✅ codecov/patch

All checks have passed
```

---

## Troubleshooting

### CodeQL is slow

- Normal for first run (builds index)
- Subsequent runs are faster
- Runs asynchronously, doesn't block PR

### Codecov token expired

1. Go to [codecov.io](https://codecov.io)
2. Generate new token
3. Update `CODECOV_TOKEN` in repository secrets

### npm audit finds vulnerabilities

1. Check severity
2. Run `npm audit fix`
3. If breaking changes, wait for Dependabot PR
4. If critical, create manual PR to fix

### Bundle size check fails

1. Analyze bundle: `npx vite-bundle-visualizer`
2. Remove unused code
3. Use code splitting
4. Update limits if growth is justified

### Dependabot PR conflicts

1. Pull latest main: `git pull origin main`
2. Rebase Dependabot branch (GitHub will auto-update)
3. Or close and wait for new PR next week

---

## Best Practices

### Before Committing

```bash
npm run lint:fix
npm run format
npm run type-check
npm run test:run
npm run build
```

### When Creating PRs

1. Ensure all checks pass locally first
2. Write descriptive PR title and description
3. Wait for all CI checks before requesting review
4. Address any failed checks immediately

### When Reviewing PRs

1. Check that all CI checks passed
2. Review Codecov coverage report
3. Check bundle size hasn't increased significantly
4. Review any CodeQL alerts

---

## Further Reading

- [CodeQL Documentation](https://codeql.github.com/docs/)
- [Codecov Documentation](https://docs.codecov.com/)
- [npm audit Documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [ESLint Documentation](https://eslint.org/docs/latest/)
- [Prettier Documentation](https://prettier.io/docs/en/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)
