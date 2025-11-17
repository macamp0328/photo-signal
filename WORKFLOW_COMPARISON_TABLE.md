# GitHub Actions Workflow Comparison

Quick reference table comparing all workflows before and after cleanup.

---

## Workflow Summary Table

| Workflow | Runs On | Tests Code? | Posts Comments? | Value | Keep? | Change? |
|----------|---------|-------------|-----------------|-------|-------|---------|
| **ci.yml** | Every PR | ✅ Yes (lint, test, build) | ❌ No | ⭐⭐⭐⭐⭐ | ✅ Yes | None |
| **pr-checks-monitor.yml** | After every CI run | ❌ No | ✅ Yes (every time) | ⭐☆☆☆☆ | ❌ No | **DELETE** |
| **edge-case-accuracy.yml** | Every PR | ✅ Yes (accuracy tests) | ✅ Yes (every PR) | ⭐⭐⭐☆☆ | ✅ Yes | **Add path filter** |
| **visual-regression.yml** | Every PR | ✅ Yes (Playwright) | ⚠️ Only on failure | ⭐⭐⭐⭐☆ | ✅ Yes | None (maybe path filter) |
| **manage-labels.yml** | Main branch only | ❌ No | ❌ No | ⭐⭐☆☆☆ | ✅ Yes | **Simplify labels** |
| **close-stale-failing-prs.yml** | Daily (scheduled) | ❌ No | ⚠️ Only when closing | ⭐⭐⭐⭐☆ | ✅ Yes | **Use check API** |

---

## PR Comment Frequency

### Current State

| Workflow | Comments per PR | When? | Relevant? | Duplicate Risk? |
|----------|-----------------|-------|-----------|-----------------|
| pr-checks-monitor | 2-3 | Every CI run | ❌ No (GitHub shows this) | ✅ Yes (every commit) |
| edge-case-accuracy | 1+ | Every PR | ⚠️ Only if photo code changed | ✅ Yes (every commit) |
| visual-regression | 0-1 | Only on failure | ✅ Yes | ❌ No |

**Total per typical 3-commit PR**: 7 comments (~586 lines)

### After Cleanup

| Workflow | Comments per PR | When? | Relevant? | Duplicate Risk? |
|----------|-----------------|-------|-----------|-----------------|
| pr-checks-monitor | 0 | DELETED | N/A | N/A |
| edge-case-accuracy | 0-1 | Only if photo code changed | ✅ Yes | ❌ No (path filter) |
| visual-regression | 0-1 | Only on failure | ✅ Yes | ❌ No |

**Total per typical 3-commit PR**: 0-1 comments (~0-30 lines)

**Reduction**: 86-100%

---

## Testing Coverage

### What Tests Run on Every PR (Current)

| Workflow | What It Tests | Runtime | Necessary for all PRs? |
|----------|---------------|---------|------------------------|
| ci.yml | Lint, format, type-check, unit tests, build, bundle size | ~3-5 min | ✅ Yes |
| edge-case-accuracy.yml | Photo recognition accuracy (12 edge cases) | ~2-4 min | ❌ No (only for photo code) |
| visual-regression.yml | UI screenshots (landing, camera, components) | ~2-3 min | ⚠️ Mostly yes |

**Total CI time per PR**: ~7-12 minutes

### What Tests Run on Every PR (After Cleanup)

| Workflow | What It Tests | Runtime | Necessary for all PRs? |
|----------|---------------|---------|------------------------|
| ci.yml | Lint, format, type-check, unit tests, build, bundle size | ~3-5 min | ✅ Yes |
| edge-case-accuracy.yml | Photo recognition accuracy (12 edge cases) | ~2-4 min | ✅ Yes (when relevant) |
| visual-regression.yml | UI screenshots (landing, camera, components) | ~2-3 min | ✅ Yes (when relevant) |

**Total CI time for doc-only PR**: ~3-5 minutes (vs ~7-12 minutes)  
**Total CI time for photo code PR**: ~7-12 minutes (same as before)

**Impact**: 40-60% faster CI for non-photo-code changes, same speed for photo code changes

---

## Quality Enforcement

### Current Enforcement (ci.yml)

| Check | Blocks Merge? | Catches Issues? | Keep? |
|-------|---------------|-----------------|-------|
| ESLint | ✅ Yes | ✅ Code quality, bugs | ✅ Yes |
| Prettier | ✅ Yes | ✅ Formatting consistency | ✅ Yes |
| TypeScript | ✅ Yes | ✅ Type errors | ✅ Yes |
| Unit tests | ✅ Yes | ✅ Functionality regressions | ✅ Yes |
| Build | ✅ Yes | ✅ Syntax errors, missing deps | ✅ Yes |
| Bundle size | ✅ Yes | ✅ Performance regressions | ✅ Yes |

### After Cleanup

**No changes to quality enforcement.**

All checks remain. Zero reduction in code quality gates.

---

## Information Sources

### Where Developers See CI Status

| Source | Current | After Cleanup | Change |
|--------|---------|---------------|--------|
| GitHub PR UI (check status) | ✅ Shows pass/fail | ✅ Shows pass/fail | None |
| GitHub PR UI (Details link) | ✅ Links to logs | ✅ Links to logs | None |
| GitHub PR UI (merge button) | ✅ Blocked if failing | ✅ Blocked if failing | None |
| Email notifications | ✅ On failure | ✅ On failure | None |
| pr-checks-monitor comments | ✅ Posts every time | ❌ Deleted | ✅ Less noise |
| edge-case-accuracy comments | ✅ Posts every PR | ⚠️ Posts only when relevant | ✅ Less noise |

**Unique information lost**: None (all info duplicated in GitHub UI)

---

## Cost Analysis

### GitHub Actions Minutes Usage

**Assumptions**:
- 50 PRs per month
- Average 3 commits per PR
- 150 total CI runs per month

**Current Monthly Usage**:
```
ci.yml:                150 runs × 4 min  = 600 minutes
edge-case-accuracy:    150 runs × 3 min  = 450 minutes
visual-regression:     150 runs × 2.5 min = 375 minutes
pr-checks-monitor:     150 runs × 0.5 min = 75 minutes
                                   Total = 1,500 minutes
```

**After Cleanup**:
```
ci.yml:                150 runs × 4 min   = 600 minutes
edge-case-accuracy:    30 runs × 3 min    = 90 minutes (only photo code PRs)
visual-regression:     150 runs × 2.5 min = 375 minutes
                                    Total = 1,065 minutes
```

**Savings**: 435 minutes/month (~29%)

**Cost impact**: Depends on your GitHub plan, but generally:
- Free tier: 2,000 minutes/month
- Team: 3,000 minutes/month
- Current usage: 1,500 min (75% of free tier)
- After cleanup: 1,065 min (53% of free tier)

**Benefit**: More headroom before hitting limits, faster feedback

---

## Developer Experience

### Current PR Workflow

1. Push commit
2. Wait for CI (~8 min)
3. See results in:
   - ✅ GitHub check status
   - 💬 pr-checks-monitor comment (redundant)
   - 💬 edge-case-accuracy comment (often irrelevant)
   - 💬 visual-regression comment (if failed)
4. Scroll through automated comments to find human feedback
5. If failed, click Details to see logs
6. Fix issue
7. Repeat (get more duplicate comments)

**Pain points**:
- PR thread cluttered with redundant info
- Human feedback buried
- Duplicate comments on every commit
- Irrelevant test results

### After Cleanup

1. Push commit
2. Wait for CI (~4-8 min, depending on what changed)
3. See results in:
   - ✅ GitHub check status
   - 💬 edge-case-accuracy comment (only if photo code changed)
   - 💬 visual-regression comment (if failed)
4. See human feedback immediately (no clutter)
5. If failed, click Details to see logs
6. Fix issue
7. Repeat (no duplicate comments)

**Improvements**:
- Clean PR threads
- Faster CI for many PRs
- Human feedback easy to find
- Only relevant test results

---

## Risk Assessment

### Risks of Cleanup

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Developer misses CI failure | Very Low | Low | GitHub UI shows failures prominently; merge blocked |
| Edge case regression unnoticed | Very Low | Medium | Path filter includes all photo code; manual trigger available |
| Stale PR cleanup breaks | Low | Low | Update to use check API (more reliable than labels) |
| Visual regression false negatives | Very Low | Low | No changes to visual-regression.yml |
| Restored workflows needed | Very Low | Very Low | All in git history; easy to restore |

**Overall risk level**: **Very Low**

All risks have mitigations. Changes are reversible. No quality enforcement removed.

---

## Comparison Scenarios

### Scenario 1: Documentation-Only PR

**Current**:
- CI runs: ci.yml (4 min), edge-case-accuracy (3 min), visual-regression (2 min)
- Comments: pr-checks-monitor (2-3×), edge-case-accuracy (1-3×)
- Total time: 9 minutes
- Total comments: 3-6

**After**:
- CI runs: ci.yml (4 min)
- Comments: None
- Total time: 4 minutes
- Total comments: 0

**Improvement**: 55% faster, 100% less noise

---

### Scenario 2: CSS Fix PR

**Current**:
- CI runs: ci.yml (4 min), edge-case-accuracy (3 min), visual-regression (2 min)
- Comments: pr-checks-monitor (2-3×), edge-case-accuracy (1-3×), visual-regression (0-1)
- Total time: 9 minutes
- Total comments: 3-7

**After**:
- CI runs: ci.yml (4 min), visual-regression (2 min)
- Comments: visual-regression (0-1)
- Total time: 6 minutes
- Total comments: 0-1

**Improvement**: 33% faster, 86-100% less noise

---

### Scenario 3: Photo Recognition Code PR

**Current**:
- CI runs: ci.yml (4 min), edge-case-accuracy (3 min), visual-regression (2 min)
- Comments: pr-checks-monitor (2-3×), edge-case-accuracy (1-3×), visual-regression (0-1)
- Total time: 9 minutes
- Total comments: 3-7

**After**:
- CI runs: ci.yml (4 min), edge-case-accuracy (3 min), visual-regression (2 min)
- Comments: edge-case-accuracy (1), visual-regression (0-1)
- Total time: 9 minutes
- Total comments: 1-2

**Improvement**: Same speed (tests needed), 71-86% less noise

---

## Bottom Line

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Workflows that test code | 3 | 3 | ✅ Same |
| Workflows that spam PRs | 2 | 0 | ✅ -100% |
| Comments per PR (avg) | 5-7 | 0-2 | ✅ -71% to -100% |
| CI time (doc PR) | 9 min | 4 min | ✅ -55% |
| CI time (photo PR) | 9 min | 9 min | ✅ Same |
| Quality enforcement | 100% | 100% | ✅ Same |
| GitHub Actions minutes | 1,500/mo | 1,065/mo | ✅ -29% |
| Developer experience | 😫 | 😊 | ✅ Much better |

**Conclusion**: More efficient, less noise, same quality. Clear win.

---

## See Also

- **CLEANUP_EXECUTIVE_SUMMARY.md** - Decision guide (start here)
- **WORKFLOW_SPAM_EXAMPLES.md** - Real-world example
- **GITHUB_ACTIONS_ANALYSIS.md** - Complete technical analysis
