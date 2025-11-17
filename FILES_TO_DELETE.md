# Files to Delete

The following workflow files should be deleted as part of this cleanup:

1. `.github/workflows/pr-checks-monitor.yml` - Redundant spam workflow
2. `.github/workflows/close-stale-failing-prs.yml` - Not needed for single contributor

Note: These files still exist in the working directory but should be removed before merging this PR.

To delete them:
```bash
rm .github/workflows/pr-checks-monitor.yml
rm .github/workflows/close-stale-failing-prs.yml
```

Or use git:
```bash
git rm .github/workflows/pr-checks-monitor.yml
git rm .github/workflows/close-stale-failing-prs.yml
```
