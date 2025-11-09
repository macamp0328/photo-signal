# Issue Template - Template

> **Purpose**: Use this template as a guide to create additional issue templates for milestones 5-7 and any new issues needed.

---

## File Naming Convention

Place in `.github/ISSUE_TEMPLATE/` with naming pattern:
```
milestone-{number}-{brief-description}.md
```

Examples:
- `milestone-5-database-schema.md`
- `milestone-6-external-speaker-integration.md`
- `milestone-7-performance-optimization.md`

---

## Template Structure

```markdown
---
name: 'M#.#: Title of Issue'
about: Brief description of what this issue accomplishes
title: 'Short Title'
labels: ['milestone-#', 'type-label', 'priority-label']
assignees: ''
---

## Milestone
Milestone #: Milestone Name

## Objective
Clear, concise statement of what you're trying to achieve. Should be 1-2 sentences.

## Tasks

- [ ] Task 1 - Be specific and actionable
- [ ] Task 2 - Include technical details
- [ ] Task 3 - Break down into small steps
- [ ] Task 4 - Add sub-tasks if needed
  - [ ] Sub-task 4.1
  - [ ] Sub-task 4.2
- [ ] Task 5 - Include testing/documentation tasks

## Acceptance Criteria

- [ ] Feature works as expected
- [ ] All tests pass (add new tests if needed)
- [ ] Documentation updated (README, module docs)
- [ ] Code coverage meets target (>70%)
- [ ] No breaking changes to existing API
- [ ] Linting and formatting pass
- [ ] Build succeeds

## Dependencies
List any issues that must be completed before this one can start.
- Requires: M#.#: Issue Title (if applicable)
- None (if no dependencies)

## Estimated Effort
X-Y hours

Be realistic. Consider:
- Research time
- Implementation time
- Testing time
- Documentation time
- Review iterations

## Files to Modify/Create
- `path/to/file1` (modify)
- `path/to/file2` (new)
- `path/to/file3` (modify)

## Testing Checklist (if applicable)
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Tested on desktop browser
- [ ] Tested on mobile browser
- [ ] Tested edge cases

## Design Considerations (if applicable)
- Note any design decisions
- Document tradeoffs
- Mention alternatives considered

## References
- Link to relevant documentation
- Link to module README
- Link to external resources
- Link to research documents
```

---

## Label Guidelines

### Milestone Labels (required)
- `milestone-1` through `milestone-7`

### Type Labels (choose one or more)
- `testing` - Test-related work
- `feature` - New feature implementation
- `bug` - Bug fix
- `documentation` - Documentation updates
- `infrastructure` - Build/CI/deployment
- `research` - Research and evaluation
- `ui` - User interface work
- `ux` - User experience work
- `backend` - Backend/API work
- `database` - Database-related work
- `security` - Security improvements
- `performance` - Performance optimization
- `accessibility` - Accessibility improvements

### Priority Labels (optional but recommended)
- `priority-high` - Must complete soon
- `priority-medium` - Important but not urgent
- `priority-low` - Nice to have

---

## Examples of Good Issues

See existing templates for reference:
- `milestone-1-setup-testing-framework.md` - Good infrastructure issue
- `milestone-2-research-photo-recognition.md` - Good research issue
- `milestone-3-audio-crossfade.md` - Good feature issue
- `milestone-4-favorites-system.md` - Good example of parallel development

---

## Tips for Writing Good Issues

### ✅ DO:
- Be specific about what needs to be done
- Include clear acceptance criteria
- Estimate effort realistically
- Link to relevant documentation
- Break large tasks into smaller sub-tasks
- Document dependencies
- Include testing requirements
- Consider edge cases

### ❌ DON'T:
- Make issues too broad ("Improve the app")
- Forget acceptance criteria
- Omit file paths
- Ignore dependencies
- Skip estimation
- Forget about testing
- Assume knowledge (link to docs!)

---

## Creating Issues for Milestones 5-7

### Milestone 5: Backend & Data
Issues to create:
- M5.1: Design Database Schema
- M5.2: Setup PostgreSQL Database
- M5.3: Create API Layer
- M5.4: Migrate Data Service
- M5.5: User Authentication (optional)
- M5.6: Photo Upload API

### Milestone 6: Advanced Features
Issues to create:
- M6.1: External Speaker Integration
- M6.2: Multi-language Support
- M6.3: Social Sharing
- M6.4: Analytics Integration
- M6.5: Search & Discovery
- M6.6: Concert Recommendations

### Milestone 7: Production Readiness
Issues to create:
- M7.1: Performance Optimization
- M7.2: Security Audit
- M7.3: Accessibility Audit
- M7.4: User Documentation
- M7.5: Developer Documentation
- M7.6: Error Monitoring
- M7.7: Launch Checklist

---

## After Creating a Template

1. ✅ Create the template file in `.github/ISSUE_TEMPLATE/`
2. ✅ Update `ISSUE_TRACKING.md` with template information
3. ✅ Update `DOCUMENTATION_INDEX.md` to list the new template
4. ✅ Commit all three files together
5. ✅ Test creating an issue from the template via GitHub UI

---

## Quick Reference

```bash
# Create new template
cd /home/runner/work/photo-signal/photo-signal
touch .github/ISSUE_TEMPLATE/milestone-5-your-issue.md

# Edit template (use structure above)
# Then update tracking docs
# Commit and push
```

---

**Last Updated**: 2025-11-09  
**See Also**: ISSUE_TRACKING.md, ROADMAP.md
