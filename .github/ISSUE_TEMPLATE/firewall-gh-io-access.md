---
name: 'Firewall blocks access to gh.io'
about: Configure firewall to allow Copilot agent access to GitHub documentation
title: 'Allow Copilot agent access to gh.io domain'
labels: ['infrastructure', 'documentation', 'copilot']
assignees: ''
---

## Issue

The GitHub Copilot coding agent is blocked by firewall rules when attempting to access `gh.io` domain for documentation lookup.

## Observed Behavior

When the Copilot agent attempts to access GitHub best practices documentation (e.g., `https://gh.io/copilot-coding-agent-tips`), the connection is blocked by firewall rules.

**Blocked Domain**: `gh.io`

**Error Type**: DNS block

**Example Command**: `curl -L https://gh.io/copilot-coding-agent-tips`

## Impact

- Agent cannot access official GitHub documentation for best practices
- Agent must work with existing knowledge without verification
- May miss important updates to GitHub recommendations
- Documentation links in issues/PRs are inaccessible to the agent

## Suggested Solutions

Choose one of the following approaches:

### Option 1: Add to Allowlist (Recommended)

Add `gh.io` to the custom allowlist in the repository's Copilot coding agent settings:

1. Go to [Repository Copilot Settings](https://github.com/macamp0328/photo-signal/settings/copilot/coding_agent) (admin access required)
2. Navigate to "Firewall Configuration" or "Allowed Domains"
3. Add `gh.io` to the allowlist
4. Save changes

### Option 2: Configure Actions Setup Steps

Configure Actions setup steps to pre-fetch documentation before the firewall is enabled:

1. Create or update `.github/actions/setup-copilot/action.yml`
2. Add step to download documentation:
   ```yaml
   - name: Cache GitHub documentation
     run: |
       mkdir -p /tmp/gh-docs
       curl -L https://gh.io/copilot-coding-agent-tips > /tmp/gh-docs/best-practices.html
   ```
3. Reference cached documentation in agent configuration

### Option 3: Mirror Documentation Locally

1. Download relevant GitHub documentation
2. Store in repository under `docs/github/` directory
3. Update references to point to local copies
4. Set up periodic sync to keep documentation current

## Tasks

- [ ] Review security implications of allowing `gh.io` access
- [ ] Choose solution approach (Option 1, 2, or 3)
- [ ] Implement chosen solution
- [ ] Test that agent can access GitHub documentation
- [ ] Document the configuration in repository settings
- [ ] Update SETUP.md if configuration changes are needed

## Acceptance Criteria

- [ ] Copilot agent can access `https://gh.io/copilot-coding-agent-tips`
- [ ] No security vulnerabilities introduced
- [ ] Solution is documented
- [ ] Configuration is tested and verified

## Additional Context

This issue was discovered during work on #44 (Set up Copilot instructions) when the agent attempted to fetch best practices documentation from GitHub.

## References

- [GitHub Copilot Actions Setup](https://gh.io/copilot/actions-setup-steps)
- [Repository Copilot Settings](https://github.com/macamp0328/photo-signal/settings/copilot/coding_agent)
- Original PR: #45 (docs: enhance copilot-instructions.md with best practices)
