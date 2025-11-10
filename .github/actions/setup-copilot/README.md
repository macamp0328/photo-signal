# Setup Copilot Documentation Action

## Overview

This composite GitHub Action pre-fetches GitHub Copilot documentation from `gh.io` domain before firewall restrictions are applied in the CI environment. This ensures that the Copilot coding agent has access to official GitHub best practices and setup documentation.

## Purpose

GitHub's firewall rules may block access to the `gh.io` domain during CI runs. By fetching documentation early in the workflow (immediately after checkout), we cache it locally for the agent to reference throughout the job.

## What It Does

1. Creates a documentation cache directory at `/tmp/gh-docs/`
2. Fetches GitHub Copilot coding agent tips from `https://gh.io/copilot-coding-agent-tips`
3. Fetches GitHub Actions setup documentation from `https://gh.io/copilot/actions-setup-steps`
4. Saves the documentation as HTML files for local reference
5. Displays a summary of cached documentation

## Usage

```yaml
steps:
  - name: Checkout code
    uses: actions/checkout@v4

  - name: Setup Copilot documentation cache
    uses: ./.github/actions/setup-copilot

  # ... rest of your workflow steps
```

## Cached Documentation

The action caches the following files in `/tmp/gh-docs/`:

- `copilot-best-practices.html` - GitHub Copilot coding agent tips
- `actions-setup-steps.html` - GitHub Actions setup documentation

## Error Handling

If a documentation URL fails to fetch (timeout, network error, or 404), the action will:

- Log a warning message
- Create a placeholder file indicating the fetch failed
- Continue execution (non-blocking)

This ensures the CI workflow doesn't fail due to documentation unavailability.

## Security Considerations

- Only fetches documentation from official GitHub domains (`gh.io`)
- Uses `--fail` and `--max-time 30` flags to prevent hanging or following bad redirects
- Does not expose any sensitive information
- Runs before firewall restrictions are applied (no bypass required)

## Integration

This action is integrated into the Photo Signal CI workflow (`.github/workflows/ci.yml`) and runs immediately after code checkout to ensure documentation is available throughout the entire job.

## Maintenance

When GitHub adds new documentation URLs that should be cached:

1. Add a new step to `action.yml`
2. Follow the existing pattern with error handling
3. Update this README with the new cached file
4. Update `DOCUMENTATION_INDEX.md` to reflect changes

## Related Issues

- Issue #46: Allow Copilot agent access to gh.io domain

## References

- [GitHub Copilot Coding Agent Tips](https://gh.io/copilot-coding-agent-tips)
- [GitHub Copilot Actions Setup](https://gh.io/copilot/actions-setup-steps)
