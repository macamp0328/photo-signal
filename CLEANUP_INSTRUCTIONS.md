# Documentation Cleanup - Action Required

## Summary

This PR prepares a comprehensive documentation cleanup to remove AI-generated bloat. The cleanup script is ready but needs to be executed.

## What Was Done

✅ Created `FUTURE_FEATURES.md` to consolidate unimplemented features  
✅ Created `scripts/cleanup-docs.js` to automate deletion of 21 redundant files  
✅ Updated `DOCUMENTATION_INDEX.md` to reflect post-cleanup state  
✅ Added `npm run cleanup-docs` command  
✅ Documented the cleanup script in `scripts/README.md`

## What Needs To Be Done

**Action Required:** Run the cleanup script to delete the redundant files.

```bash
npm run cleanup-docs
```

This will delete 21 documentation files that no longer provide value:
- 7 root-level files (workflow analysis docs, implementation summaries)
- 14 docs/ directory files (completed work, redundant research)

After running the script, commit the deletions:

```bash
git add .
git commit -m "chore: remove 21 redundant documentation files"
git push
```

## Files That Will Be Deleted

### Root Level (7 files)
- `CLEANUP_EXECUTIVE_SUMMARY.md`
- `README_ANALYSIS_COMPLETE.md`
- `WORKFLOW_COMPARISON_TABLE.md`
- `WORKFLOW_SPAM_EXAMPLES.md`
- `AUTO_FIX_WORKFLOW.md`
- `MOBILE_UX_IMPROVEMENTS.md`
- `FAVICON_SETUP.md`

### Docs Directory (14 files)
- `docs/test-mode-fix-summary.md`
- `docs/grayscale-feature-implementation.md`
- `docs/mobile-first-refactor-summary.md`
- `docs/phase-1-implementation-verification.md`
- `docs/IMPLEMENTATION_STATUS_SUMMARY.md`
- `docs/phase-2-angle-compensation-analysis.md`
- `docs/phase-2-benchmarking-guide.md`
- `docs/phase-2-migration-guide.md`
- `docs/opus-streaming-implementation-plan.md`
- `docs/audio-streaming-setup.md`
- `docs/code-analysis-examples.md`
- `docs/code-analysis-tooling-research.md`
- `docs/image-recognition-exploratory-analysis.md`

## Files That Will Be Kept

All essential documentation remains:
- Core docs: README.md, CONTRIBUTING.md, ARCHITECTURE.md, SETUP.md, TESTING.md, DOCKER.md
- New: FUTURE_FEATURES.md (consolidated unimplemented features)
- Guides: All accessibility docs, TEST_DATA_MODE_GUIDE.md, setup guides
- Module documentation: All module READMEs and implementation files
- Research: photo-recognition-research.md (still valuable reference)

## Why This Cleanup?

Per the issue request:
> "review every documentation file in the repo. Decides if it needs to exist, and delete when in doubt. It seems like AI agents like to create tons of documents that don't help anything."

This cleanup removes:
- **Historical records** (PR #162 workflow analysis - work is done, keep in git history)
- **Implementation summaries** (features are implemented, covered in module docs)
- **Redundant research** (consolidated into FUTURE_FEATURES.md)
- **One-time setup guides** (setup is complete)

Result: **16% reduction** in documentation files (128 → 107), keeping only what brings ongoing value.

## Verification

After running the cleanup script:

1. Verify deletions:
   ```bash
   git status
   ```

2. Check for broken links:
   ```bash
   grep -r "CLEANUP_EXECUTIVE_SUMMARY\|README_ANALYSIS_COMPLETE\|WORKFLOW_" *.md docs/*.md
   ```

3. Run pre-commit checks:
   ```bash
   npm run lint:fix
   npm run format
   npm run type-check
   npm run test:run
   npm run build
   ```

All links in DOCUMENTATION_INDEX.md have already been updated, so there should be no broken references.

---

**Ready to proceed?** Run `npm run cleanup-docs` and commit the result.
