# Auto-fix Workflow for Copilot PRs

## Problem

Copilot PRs frequently fail CI checks due to formatting issues. The repository owner has to manually:

1. Pull the PR branch
2. Run `npm run pre-commit`
3. Push the fixes
4. Wait for CI to pass

This is time-consuming and frustrating.

## Solution

Created a new GitHub Actions workflow: `auto-fix-copilot-pr.yml`

### How It Works

1. **Triggers** when the CI workflow completes with a failure
2. **Checks** if the PR is from a Copilot branch (starts with `copilot/`)
3. **Runs** `npm run lint:fix` and `npm run format` automatically
4. **Commits** any fixes back to the PR branch
5. **Comments** on the PR to notify that fixes were applied

### Benefits

✅ **Reduces manual work** - No need to pull branch and run pre-commit manually
✅ **Faster turnaround** - Fixes are applied immediately when CI fails
✅ **Automatic** - Works for all Copilot PRs without configuration
✅ **Safe** - Only runs on Copilot branches (starts with `copilot/`)
✅ **Informative** - Comments on PR to explain what was done

### Workflow Details

**File**: `.github/workflows/auto-fix-copilot-pr.yml`

**Triggers on**:

- CI workflow completion
- Only when CI fails
- Only for PRs from `copilot/*` branches

**What it does**:

1. Checks out the PR branch
2. Runs `npm run lint:fix` (auto-fix linting issues)
3. Runs `npm run format` (apply Prettier formatting)
4. Commits changes if any were made
5. Posts a comment on the PR

**Permissions needed**:

- `contents: write` - To commit fixes
- `pull-requests: write` - To comment on PR

### Example Comment

When the workflow applies fixes:

```
## 🤖 Auto-fix Applied

Formatting and linting issues have been automatically fixed.

**Changes applied:**
- `npm run lint:fix` - Auto-fixed linting issues
- `npm run format` - Applied Prettier formatting

CI checks should pass now. No manual intervention needed! ✨
```

When no formatting changes are needed:

```
## ℹ️ No Formatting Changes Needed

Ran `npm run lint:fix` and `npm run format`, but no changes were needed.

The CI failure is likely due to another issue (type errors, test failures, build errors).

Please check the CI logs for details.
```

## Updated Copilot Instructions

Also updated `.github/copilot-instructions.md` to:

- Emphasize that formatting failures are the #1 cause of CI failures
- Mention the auto-fix workflow as a safety net
- Remind AI agents to always format before committing

## Impact

**Before**:

- Copilot PR fails CI due to formatting
- User pulls branch manually
- User runs `npm run pre-commit`
- User pushes fixes
- Wait for CI to pass again
- **Time**: ~5-10 minutes of manual work

**After**:

- Copilot PR fails CI due to formatting
- Auto-fix workflow runs automatically
- Fixes are committed to PR
- CI runs again automatically
- **Time**: ~2 minutes, zero manual work

**Expected reduction**: ~80% less manual intervention for formatting issues

## Notes

- The workflow only runs on `copilot/*` branches for safety
- It uses `github-actions[bot]` as the commit author
- It continues even if lint:fix or format fail (some errors may not be auto-fixable)
- It only commits if there are actual changes to commit
- It provides clear feedback via PR comments

## Testing

The workflow will be tested on the next Copilot PR that has formatting issues. Expected behavior:

1. CI fails due to formatting
2. Auto-fix workflow triggers
3. Fixes are committed automatically
4. Comment is posted on PR
5. CI runs again and should pass

## Future Improvements (Optional)

Could potentially:

- Run on all PRs, not just Copilot branches (if desired)
- Auto-fix type errors (if there's a `type-check:fix` command)
- Run bundle size optimization
- Apply other auto-fixable issues

For now, focusing on the #1 issue: formatting.
