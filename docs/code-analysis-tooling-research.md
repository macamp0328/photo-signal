# Code Analysis Tooling Research

> **Purpose**: Evaluate and recommend best-in-class tracing, logging, and code analysis tools for Photo Signal with focus on free/open-source solutions for private repositories.

**Date**: 2025-11-10  
**Status**: Research Phase  
**Target**: AI agent development with comprehensive quality, safety, and review policy

---

## Executive Summary

This document evaluates tooling options for:

1. **Code Analysis** - Static analysis, linting, security scanning
2. **Test Coverage** - Coverage reporting and tracking
3. **Logging & Tracing** - Development and CI/CD observability
4. **Security Scanning** - Dependency and code vulnerabilities
5. **Performance Monitoring** - Bundle size and build metrics

### Recommended Tooling Stack

| Category            | Tool                                    | Justification                                                                                                 | Cost                 |
| ------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------- |
| Security Scanning   | **CodeQL** (optional)                   | GitHub native, excellent JavaScript/TypeScript support - **Disabled by default** (requires Advanced Security) | Free (paid plan req) |
| Coverage Reporting  | **Codecov**                             | Industry standard, free tier for open source, excellent GitHub integration                                    | Free tier available  |
| Dependency Scanning | **npm audit + Dependabot**              | Built-in, GitHub native, automatic PR creation                                                                | Free                 |
| Bundle Analysis     | **Custom script**                       | Lightweight bash script, fail CI on size regression                                                           | Free                 |
| Linting             | **ESLint** (existing)                   | Already configured, industry standard                                                                         | Free                 |
| Type Checking       | **TypeScript** (existing)               | Already configured                                                                                            | Free                 |
| Testing             | **Vitest** (existing)                   | Already configured with coverage                                                                              | Free                 |
| Logging             | **Structured console + GitHub Actions** | Built-in, lightweight                                                                                         | Free                 |

---

## Current Tooling Inventory

### ✅ Already Implemented

1. **ESLint** (v9.36.0)
   - Flat config format
   - TypeScript support via typescript-eslint
   - React Hooks rules
   - Prettier integration
   - **Status**: Production-ready, runs in CI

2. **Prettier** (v3.6.2)
   - Code formatting
   - 100-char line width
   - **Status**: Production-ready, runs in CI

3. **TypeScript** (v5.9.3)
   - Strict mode enabled
   - Type checking in CI
   - **Status**: Production-ready

4. **Vitest** (v4.0.8)
   - Test runner with React Testing Library
   - Coverage reporting (v8 provider)
   - HTML, JSON, LCOV, text reporters
   - 70% coverage targets
   - **Status**: Production-ready, 241 tests passing

5. **GitHub Actions CI**
   - Linting, formatting, type-check, tests, build
   - Artifact upload
   - **Status**: Production-ready

### ❌ Not Implemented (Gap Analysis)

1. **Security Scanning**
   - CodeQL workflow planned/documented but not yet created (requires GitHub Advanced Security for private repos)
   - No secret scanning beyond GitHub's default
   - Gap: Advanced security scanning requires paid GitHub plan or making repo public
   - Note: CodeQL setup guide provided for future enablement

2. **Coverage Tracking**
   - Coverage reports generated locally
   - Codecov integration added (requires CODECOV_TOKEN secret)
   - ✅ **RESOLVED**: Coverage tracking ready when token is configured

3. **Dependency Vulnerability Scanning**
   - ✅ **RESOLVED**: npm audit now runs in CI
   - ✅ **RESOLVED**: Dependabot configured for automated updates

4. **Bundle Size Monitoring**
   - ✅ Bundle size monitoring implemented via custom script (`scripts/check-bundle-size.sh`)
   - ✅ Regression detection and CI checks active

5. **Performance Tracing**
   - No runtime performance monitoring
   - Gap: Consider for production (optional for MVP)

---

## Option 1: Security & Code Analysis

### CodeQL (Recommended ✅)

**Provider**: GitHub  
**Cost**: Free for public and private repositories  
**Language Support**: JavaScript, TypeScript, Python, Java, C++, C#, Go, Ruby

**Pros**:

- Native GitHub integration
- Excellent JavaScript/TypeScript analysis
- Security vulnerability detection
- Code quality checks
- Automatic PR annotations
- SARIF output format
- Custom query support
- No account signup needed
- Works seamlessly with private repos

**Cons**:

- Can be slow on large codebases (not an issue for this project)
- Learning curve for custom queries (not needed for MVP)

**Implementation**: GitHub workflow

**Verdict**: ✅ **RECOMMENDED** - Best option for private repo security scanning

---

### Alternative: Snyk

**Cost**: Free tier for open source only, paid for private repos  
**Verdict**: ❌ **NOT SUITABLE** - Requires paid plan for private repositories

---

### Alternative: SonarQube/SonarCloud

**Cost**: Free for open source, paid for private repos  
**Verdict**: ❌ **NOT SUITABLE** - Requires paid plan for private repositories

---

### Alternative: DeepSource

**Cost**: Free for open source, paid for private repos  
**Verdict**: ❌ **NOT SUITABLE** - Requires paid plan for private repositories

---

## Option 2: Test Coverage Reporting

### Codecov (Recommended ✅)

**Provider**: Codecov  
**Cost**: Free tier available (up to 5 private repos)  
**Language Support**: Universal (via LCOV, JSON, etc.)

**Pros**:

- Industry standard
- GitHub PR integration
- Coverage trends over time
- Coverage diff in PRs
- LCOV format support (Vitest compatible)
- Simple setup
- Free tier suitable for personal projects

**Cons**:

- Limited to 5 private repos on free tier
- Requires account signup

**Implementation**:

1. Upload coverage after tests in CI
2. Add Codecov GitHub App

**Verdict**: ✅ **RECOMMENDED** - Best coverage tracking for private repos

---

### Alternative: Coveralls

**Cost**: Free for open source, paid for private repos  
**Verdict**: ❌ **NOT SUITABLE** - No free tier for private repositories

---

### Alternative: Built-in GitHub Actions Coverage

**Cost**: Free  
**Pros**: No external service needed  
**Cons**: Limited features, no trends, basic PR comments

**Verdict**: ⚠️ **FALLBACK** - Use if Codecov quota exceeded

---

## Option 3: Dependency Scanning

### npm audit + Dependabot (Recommended ✅)

**Provider**: npm + GitHub  
**Cost**: Free

**Pros**:

- Built-in to npm
- GitHub Dependabot included for all repos
- Automatic PR creation for updates
- Security advisory database
- Zero setup for basic scanning

**Cons**:

- Basic compared to specialized tools
- Can have false positives

**Implementation**:

1. Add `npm audit` to CI
2. Enable Dependabot in repo settings
3. Configure `.github/dependabot.yml`

**Verdict**: ✅ **RECOMMENDED** - Best free option

---

### Alternative: Snyk

**Cost**: Paid for private repos  
**Verdict**: ❌ **NOT SUITABLE**

---

## Option 4: Bundle Size Analysis

### size-limit (Recommended ✅)

**Provider**: Open source (AI/size-limit)  
**Cost**: Free  
**Language**: JavaScript/TypeScript

**Pros**:

- Lightweight
- Fail CI on size regression
- Simple configuration
- Works with Vite
- No external service

**Cons**:

- Manual configuration needed
- No historical tracking (just pass/fail)

**Implementation**: Add size-limit config and CI step

**Verdict**: ✅ **RECOMMENDED** - Simple and effective

---

### Alternative: bundlesize

**Status**: Archived project  
**Verdict**: ❌ **NOT RECOMMENDED** - Project no longer maintained

---

### Alternative: BundleWatch

**Provider**: Open source  
**Cost**: Free

**Pros**: Similar to size-limit  
**Cons**: Less active maintenance

**Verdict**: ⚠️ **ALTERNATIVE** - Good fallback option

---

## Option 5: Logging & Tracing

### Structured Console Logging (Recommended ✅)

**Provider**: Built-in  
**Cost**: Free

**Approach**:

- Use structured JSON logs in tests
- GitHub Actions automatically captures logs
- Use log groups for organization
- Add timing information

**Pros**:

- No dependencies
- Simple to implement
- Portable
- GitHub Actions native support

**Cons**:

- Basic compared to APM tools
- No distributed tracing
- No long-term retention

**Verdict**: ✅ **RECOMMENDED** - Sufficient for CI/CD needs

---

### Alternative: OpenTelemetry

**Cost**: Free (open source)  
**Complexity**: High - requires backend/collector

**Verdict**: ❌ **OVERKILL** - Too complex for static site CI/CD, better suited for backend services

---

### Alternative: LogTail / BetterStack

**Cost**: Paid for meaningful usage  
**Verdict**: ❌ **NOT SUITABLE** - Not needed for frontend app

---

## Option 6: Performance Monitoring (Optional)

### Lighthouse CI (Considered)

**Provider**: Google / Open source  
**Cost**: Free

**Pros**:

- Performance scoring
- Accessibility checks
- SEO analysis
- Best practices

**Cons**:

- Requires running production build
- Can be slow
- More useful for production sites

**Verdict**: ⚠️ **OPTIONAL** - Consider for future milestone, not MVP

---

## Comparison Matrix

| Tool                | Category     | Free for Private? | Setup Complexity | AI Agent Value | Priority    |
| ------------------- | ------------ | ----------------- | ---------------- | -------------- | ----------- |
| **CodeQL**          | Security     | ⚠️ Yes (with restrictions) | Low              | High           | 🔴 Critical |
| **Codecov**         | Coverage     | ✅ Yes (limited)  | Low              | High           | 🟡 High     |
| **npm audit**       | Dependencies | ✅ Yes            | Very Low         | Medium         | 🟡 High     |
| **Dependabot**      | Dependencies | ✅ Yes            | Very Low         | High           | 🟡 High     |
| **size-limit**      | Bundle       | ✅ Yes            | Low              | Medium         | 🟢 Medium   |
| **Structured Logs** | Logging      | ✅ Yes            | Very Low         | Low            | 🟢 Medium   |
| **Lighthouse CI**   | Performance  | ✅ Yes            | Medium           | Low            | ⚪ Optional |

---

## Implementation Roadmap

### Phase 1: Critical Security (Week 1)

1. ✅ CodeQL workflow for security scanning
2. ✅ npm audit in CI
3. ✅ Dependabot configuration

### Phase 2: Quality Tracking (Week 1)

4. ✅ Codecov integration
5. ✅ Coverage thresholds in CI
6. ✅ PR coverage comments

### Phase 3: Performance (Week 2)

7. ✅ size-limit configuration
8. ✅ Bundle size regression checks
9. ✅ Structured logging in tests

### Phase 4: Documentation (Week 2)

10. ✅ Update DOCUMENTATION_INDEX.md
11. ✅ Create tool usage guide
12. ✅ Add PR check documentation
13. ✅ Add example results

---

## AI Agent Development Considerations

### Why These Tools Matter for AI Agents:

1. **CodeQL**: Catches security issues before they reach production, reducing manual review burden
2. **Test Coverage**: Ensures AI-generated code is well-tested
3. **Dependency Scanning**: Prevents vulnerable dependencies from being added
4. **Bundle Size**: Prevents performance regressions from feature additions
5. **Structured Logs**: Helps debug CI failures from AI-generated changes

### Integration with GitHub Actions:

All tools run automatically on:

- Every commit to main
- Every PR
- Manual workflow dispatch (for debugging)

Results appear as:

- PR checks (pass/fail)
- PR comments (coverage, size)
- Security alerts (CodeQL findings)
- Workflow logs (detailed output)

---

## Conclusion

The recommended stack prioritizes:

1. **Zero cost** for private repository
2. **Native GitHub integration** (CodeQL, Dependabot)
3. **Minimal external dependencies** (Codecov only)
4. **Simple setup** (hours, not days)
5. **AI agent friendly** (automated checks, clear failures)

### Total Cost: $0/month

All recommended tools are completely free for private repositories, with Codecov's free tier supporting up to 5 private repos.

### Next Steps:

1. Implement CodeQL workflow
2. Configure Dependabot
3. Set up Codecov
4. Add size-limit checks
5. Enhance logging in CI
6. Update documentation

---

## References

- [CodeQL Documentation](https://codeql.github.com/docs/)
- [Codecov Documentation](https://docs.codecov.com/)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [npm audit Documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [size-limit Documentation](https://github.com/ai/size-limit)
- [GitHub Actions Best Practices](https://docs.github.com/en/actions/learn-github-actions/best-practices-for-github-actions)
