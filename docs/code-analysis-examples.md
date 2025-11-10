# Code Analysis Tools - Example Results

> **Purpose**: Show real examples of what each automated tool looks like when it runs, to help developers understand and interpret results.

**Date**: 2025-11-10  
**See also**: [docs/code-analysis-tooling-guide.md](./code-analysis-tooling-guide.md)

---

## Table of Contents

1. [GitHub Actions CI Workflow](#github-actions-ci-workflow)
2. [CodeQL Security Analysis](#codeql-security-analysis)
3. [Codecov Coverage Report](#codecov-coverage-report)
4. [npm audit](#npm-audit)
5. [Dependabot PR](#dependabot-pr)
6. [Bundle Size Check](#bundle-size-check)
7. [Pull Request Checks](#pull-request-checks)

---

## GitHub Actions CI Workflow

### Successful Run

```
CI / lint-format-type-check-build
✓ Checkout code (2s)
✓ Setup Copilot documentation cache (1s)
✓ Setup Node.js (3s)
✓ Install dependencies (25s)
✓ Audit dependencies for vulnerabilities (2s)
  found 0 vulnerabilities
✓ Run ESLint (3s)
  > photo-signal@0.0.0 lint
  > eslint .
✓ Check formatting with Prettier (1s)
  > photo-signal@0.0.0 format:check
  > prettier --check .
  Checking formatting...
  All matched files use Prettier code style!
✓ Type-check with TypeScript (5s)
  > photo-signal@0.0.0 type-check
  > tsc -b --noEmit
✓ Run tests with coverage (15s)
  Test Files  11 passed (11)
  Tests  241 passed (241)
  Duration  14.59s
✓ Upload coverage reports to Codecov (3s)
  Uploading coverage reports to Codecov
  ✓ Coverage report uploaded successfully
✓ Build project (4s)
  vite v7.2.2 building client environment for production...
  ✓ built in 2.11s
✓ Check bundle size (1s)
  📦 Bundle Size Analysis
  JavaScript Bundle: 72 KB (gzipped) - ✅ PASS
  CSS Bundle: 1 KB (gzipped) - ✅ PASS
  ✅ All bundle size checks passed!
✓ Upload build artifacts (2s)
✓ Upload coverage artifacts (1s)

Total duration: 1m 12s
✓ Build successful
```

### Failed Run (Bundle Size)

```
CI / lint-format-type-check-build
...all steps passing...
✗ Check bundle size (1s)
  📦 Bundle Size Analysis
  JavaScript Bundle:
    Gzipped: 85 KB
    Limit:   80 KB
    Status: ❌ FAIL (exceeds limit by 5 KB)

  ❌ Bundle size check failed. Consider:
     - Code splitting
     - Removing unused dependencies
     - Tree-shaking optimization
     - Lazy loading components

Process completed with exit code 1
✗ Build failed
```

---

## CodeQL Security Analysis

### Clean Scan (No Issues)

```
CodeQL / Analyze (javascript)
✓ Checkout repository (2s)
✓ Initialize CodeQL (45s)
  Initializing CodeQL for JavaScript/TypeScript analysis
  Using queries: security-extended, security-and-quality
✓ Autobuild (30s)
  Building with Vite...
  Build completed successfully
✓ Perform CodeQL Analysis (3m 15s)
  Analyzing code with CodeQL...
  Running 250+ security queries...
  ✓ Analysis complete
  Results: 0 alerts

Total duration: 4m 32s
✓ Analysis successful - No security issues found
```

### Scan with Findings

```
CodeQL / Analyze (javascript)
...steps passing...
✓ Perform CodeQL Analysis (3m 15s)
  ⚠ Analysis complete
  Results: 3 alerts (2 warnings, 1 note)

Alerts will appear in the Security tab

Total duration: 4m 32s
⚠ Analysis completed with findings
```

**Security Tab View:**

```
Security > Code scanning alerts

⚠ Client-side cross-site scripting
  Severity: High | Rule: js/xss
  Location: src/components/InfoDisplay.tsx:45

  User-provided value flows to innerHTML without sanitization.

  Path:
    props.concertData.band
    → InfoDisplay.tsx:45
    → element.innerHTML

  Recommendation: Use textContent or sanitize with DOMPurify

  [View alert details] [Dismiss alert]

---

⚠ Incomplete URL substring sanitization
  Severity: Medium | Rule: js/incomplete-url-substring-sanitization
  Location: src/utils/validation.ts:12

  URL validation using substring() can be bypassed.

  [View alert details] [Dismiss alert]

---

ℹ Unused variable
  Severity: Note | Rule: js/unused-local-variable
  Location: src/components/Camera.tsx:89

  Variable 'motionThreshold' is declared but never used.

  [View alert details] [Dismiss alert]
```

---

## Codecov Coverage Report

### PR Comment (Improved Coverage)

```
codecov[bot] commented 5 minutes ago

## Codecov Report
Base: 70.5%   Head: 72.4%   +1.9% 🎉

Coverage increased by 1.9%

| Files | Coverage Δ | Complexity Δ |
|-------|-----------|-------------|
| src/modules/camera-view/CameraView.tsx | 95.2% → 96.1% (+0.9%) | 12 → 12 (ø) |
| src/modules/photo-recognition/PhotoRecognition.tsx | 68.4% → 75.2% (+6.8%) ⬆️ | 18 → 20 (+2) |
| src/services/data-service/DataService.ts | 71.2% (ø) | 8 (ø) |

**Patch Coverage**: 85.0% of changed lines covered (target: 70%) ✅

**Additional details:**
- 15 lines added
- 12 lines covered
- 3 lines missed

[View full report on Codecov.io →](https://codecov.io/gh/...)
```

### PR Comment (Decreased Coverage)

```
codecov[bot] commented 5 minutes ago

## Codecov Report
Base: 72.4%   Head: 68.2%   -4.2% ⚠️

Coverage decreased by 4.2%

| Files | Coverage Δ |
|-------|-----------|
| src/modules/audio-playback/AudioPlayer.tsx | 82.1% → 65.3% (-16.8%) ⬇️ |
| src/App.tsx | 88.0% → 88.0% (ø) |

**Patch Coverage**: 45.0% of changed lines covered (target: 70%) ❌

**Missing coverage:**
- src/modules/audio-playback/AudioPlayer.tsx: Lines 45-67, 89-102

**Recommendation:** Add tests for the new audio crossfade logic

[View full report on Codecov.io →](https://codecov.io/gh/...)
```

---

## npm audit

### Clean Audit (No Vulnerabilities)

```
Audit dependencies for vulnerabilities
> npm audit --audit-level=moderate

found 0 vulnerabilities
```

### Audit with Vulnerabilities

```
Audit dependencies for vulnerabilities
> npm audit --audit-level=moderate

# npm audit report

lodash  <=4.17.20
Severity: moderate
Prototype Pollution - https://github.com/advisories/GHSA-jf85-cpcp-j695
Depends on vulnerable versions of lodash
  react-scripts  >=0.0.0
  Depends on vulnerable versions of lodash

2 moderate severity vulnerabilities

To address all issues, run:
  npm audit fix

Some issues need review, and may require choosing
a different dependency.
```

---

## Dependabot PR

### Example PR

```
Title: chore(deps): Bump @vitejs/plugin-react from 5.0.0 to 5.1.0

Body:
Bumps [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react)
from 5.0.0 to 5.1.0.

Release notes
Sourced from @vitejs/plugin-react's releases.

v5.1.0
- Fixed HMR issue with React 19 (#247)
- Improved build performance by 15% (#252)
- Added support for React Server Components (#260)

Commits
- abc1234 Release 5.1.0
- def5678 fix: HMR with React 19
- ghi9012 perf: optimize build

---

Dependabot compatibility score: ✅ 100%
Dependabot commands and options: [...]

Labels:
🏷️ dependencies
🏷️ automated

Checks:
✅ CI / lint-format-type-check-build (1m 15s)
✅ CodeQL / Analyze (javascript) (4m 30s)

[Merge pull request] [Close pull request]
```

---

## Bundle Size Check

### Passing Check

```
Check bundle size
> ./scripts/check-bundle-size.sh

📦 Bundle Size Analysis
=======================

JavaScript Bundle:
  File: index-pRtEcgiL.js
  Raw:     234 KB (239953 bytes)
  Gzipped: 72 KB (73769 bytes)
  Limit:   80 KB
  Status: ✅ PASS

CSS Bundle:
  File: index-DhSlff1v.css
  Raw:     7 KB (7583 bytes)
  Gzipped: 1 KB (1740 bytes)
  Limit:   3 KB
  Status: ✅ PASS

Total Bundle:
  Gzipped: 73 KB

✅ All bundle size checks passed!
```

### Failing Check

```
Check bundle size
> ./scripts/check-bundle-size.sh

📦 Bundle Size Analysis
=======================

JavaScript Bundle:
  File: index-abc123.js
  Raw:     278 KB (284672 bytes)
  Gzipped: 85 KB (87040 bytes)
  Limit:   80 KB
  Status: ❌ FAIL (exceeds limit by 5 KB)

CSS Bundle:
  File: index-xyz789.css
  Raw:     7 KB (7583 bytes)
  Gzipped: 1 KB (1740 bytes)
  Limit:   3 KB
  Status: ✅ PASS

Total Bundle:
  Gzipped: 86 KB

❌ Bundle size check failed. Consider:
   - Code splitting
   - Removing unused dependencies
   - Tree-shaking optimization
   - Lazy loading components

Process completed with exit code 1
```

---

## Pull Request Checks

### All Checks Passing

```
All checks have passed
✅ CI / lint-format-type-check-build (1m 12s)
✅ CodeQL / Analyze (javascript) (4m 30s)
ℹ️ codecov/project (72.4%, +1.9%)
ℹ️ codecov/patch (85.0%, target 70%)

This branch has no conflicts with the base branch
Merging can be performed automatically.

[Squash and merge ▼] [Merge pull request ▼]
```

### Some Checks Failing

```
Some checks were not successful
✅ CI / lint-format-type-check-build (1m 12s)
✅ CodeQL / Analyze (javascript) (4m 30s)
❌ codecov/project (68.2%, -4.2%) — Coverage decreased
⚠️ codecov/patch (45.0%, target 70%) — Below threshold

Required checks must pass before merging
Fix the failing checks to enable merging.

[View details] [View workflow run]
```

### Blocking Security Alert

```
Review required
✅ CI / lint-format-type-check-build (1m 12s)
❌ CodeQL / Analyze (javascript) (4m 30s)
     2 high severity security issues found
     View details in Security tab

Critical issues must be resolved before merging.

[View security alerts →]
```

---

## Local Development Examples

### Running All Checks Locally

```bash
# Full check before committing
$ npm run lint:fix
✔ No linting errors

$ npm run format
✔ All files formatted

$ npm run type-check
✔ No type errors

$ npm run test:coverage
 ✓ 241 tests passed
 Coverage: 72.4%

$ npm run build
✔ Built in 2.11s

$ ./scripts/check-bundle-size.sh
✅ All bundle size checks passed!
```

### Viewing Coverage Locally

```bash
$ npm run test:coverage

 ✓ src/App.test.tsx (2 tests)
 ✓ src/modules/camera-view/CameraView.test.tsx (12 tests)
 ✓ src/modules/photo-recognition/algorithms/__tests__/dhash.test.ts (17 tests)

 Test Files  11 passed (11)
      Tests  241 passed (241)

------------------|---------|----------|---------|---------|
File              | % Stmts | % Branch | % Funcs | % Lines |
------------------|---------|----------|---------|---------|
All files         |   72.4  |   68.2   |   75.1  |   72.4  |
 camera-view      |   95.2  |   89.5   |  100.0  |   95.2  |
  CameraView.tsx  |   95.2  |   89.5   |  100.0  |   95.2  |
 photo-recognition|   68.4  |   62.1   |   70.0  |   68.4  |
  PhotoRecog.tsx  |   68.4  |   62.1   |   70.0  |   68.4  |
------------------|---------|----------|---------|---------|

Coverage report saved to: coverage/index.html
Open coverage/index.html in a browser to see detailed report
```

---

## Interpreting Results

### When All Checks Pass ✅

Your PR is ready to merge! All quality gates are satisfied:

- Code is properly formatted and linted
- No type errors
- Tests are passing with adequate coverage
- Build succeeds
- Bundle size is within limits
- No security vulnerabilities detected

### When Checks Fail ❌

**Priority order for fixes:**

1. **CodeQL alerts (High/Critical)** - Security issues, fix immediately
2. **Build failures** - Code doesn't compile, fix before anything else
3. **Type errors** - TypeScript issues, fix next
4. **Test failures** - Broken functionality, fix before merging
5. **Coverage drops** - Add tests for new code
6. **Bundle size** - Optimize if significantly over limit
7. **Linting/formatting** - Auto-fix with `npm run lint:fix && npm run format`

### When To Merge Despite Warnings ⚠️

Some warnings are acceptable:

- **Small coverage decrease** (< 2%) if adding mostly UI code
- **Low-severity npm audit issues** if fix is scheduled
- **CodeQL "note" level issues** (informational only)

Always document why you're merging with warnings in the PR description.

---

## Getting Help

If you're unsure about any check result:

1. Read the detailed logs in the workflow run
2. Check [docs/code-analysis-tooling-guide.md](./code-analysis-tooling-guide.md)
3. Search for the error message in GitHub Issues
4. Ask for help in PR comments

**Common questions:**

- "CodeQL is slow" → Normal for first run, uses caching after
- "Codecov failing" → Check `CODECOV_TOKEN` secret is set
- "Bundle size suddenly increased" → Run `npx vite-bundle-visualizer`
- "npm audit shows vulnerabilities" → Check if fix available, may need to wait for upstream
