# Photo Signal - Issue Tracking Guide

📚 **See also**: 
- [ROADMAP.md](./ROADMAP.md) - Complete project roadmap
- [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) - Central documentation index

## Overview

This document provides a guide for creating and tracking GitHub Issues for the Photo Signal project. The roadmap has been broken down into **actionable, agent-assignable issues** organized by milestones.

---

## How to Create Issues

### Step 1: Use the Issue Templates

We've created issue templates in `.github/ISSUE_TEMPLATE/` for all major tasks in the roadmap. To create an issue:

1. Go to **GitHub Issues** → **New Issue**
2. Choose the appropriate template (e.g., "M1.1: Setup Testing Framework")
3. Review and customize if needed
4. Add appropriate labels
5. Assign to yourself or an AI agent (GitHub Copilot)
6. Click "Create Issue"

### Step 2: Label Your Issues

Use consistent labels for easy tracking:

**Milestone Labels:**
- `milestone-1` - Testing Infrastructure
- `milestone-2` - Photo Recognition  
- `milestone-3` - Audio Enhancements
- `milestone-4` - UX Enhancements
- `milestone-5` - Backend & Data
- `milestone-6` - Advanced Features
- `milestone-7` - Production Readiness

**Type Labels:**
- `testing` - Test-related work
- `feature` - New feature implementation
- `bug` - Bug fix
- `documentation` - Documentation updates
- `infrastructure` - Build/CI/deployment
- `research` - Research and evaluation
- `ui` - User interface work
- `ux` - User experience work

**Priority Labels:**
- `priority-high` - Must complete soon
- `priority-medium` - Important but not urgent
- `priority-low` - Nice to have

**Status Labels (optional):**
- `in-progress` - Currently being worked on
- `blocked` - Waiting on dependencies
- `ready-for-review` - Awaiting code review

---

## Issue Templates Created

### Milestone 1: Testing Infrastructure (9 templates)

1. **M1.1: Setup Testing Framework** ✨ START HERE
   - Template: `milestone-1-setup-testing-framework.md`
   - Priority: HIGH
   - Dependencies: None
   - Estimated: 4-6 hours

2. **M1.2: Test Camera Access Module**
   - Template: `milestone-1-test-camera-access.md`
   - Depends on: M1.1
   - Estimated: 3-4 hours

3. **M1.3: Test Motion Detection Module**
   - Template: `milestone-1-test-motion-detection.md`
   - Depends on: M1.1
   - Estimated: 4-5 hours

4. **M1.4: Test Photo Recognition Module**
   - Template: `milestone-1-test-photo-recognition.md`
   - Depends on: M1.1
   - Estimated: 3-4 hours

5. **M1.5: Test Audio Playback Module**
   - Template: `milestone-1-test-audio-playback.md`
   - Depends on: M1.1
   - Estimated: 4-5 hours

6. **M1.6: Test Camera View Component**
   - Template: `milestone-1-test-camera-view.md`
   - Depends on: M1.1
   - Estimated: 4-5 hours

7. **M1.7: Test Concert Info Component**
   - Template: `milestone-1-test-concert-info.md`
   - Depends on: M1.1
   - Estimated: 3-4 hours

8. **M1.8: Test Data Service**
   - Template: `milestone-1-test-data-service.md`
   - Depends on: M1.1
   - Estimated: 4-5 hours

9. **M1.9: Integration Tests** (create manually)
   - Test App.tsx orchestration
   - Estimated: 6-8 hours

### Milestone 2: Photo Recognition (3+ templates)

1. **M2.1: Research Photo Recognition Approaches** ✨ START HERE
   - Template: `milestone-2-research-photo-recognition.md`
   - Priority: HIGH
   - Dependencies: None
   - Estimated: 8-12 hours

2. **M2.2: Implement Perceptual Hashing**
   - Template: `milestone-2-implement-hashing.md`
   - Depends on: M2.1
   - Estimated: 12-16 hours

3. **M2.3: Add Photo Hash Database** (create manually)
4. **M2.4: Photo Upload UI** (create manually)
5. **M2.5: Optimize Recognition Performance** (create manually)

### Milestone 3: Audio Enhancements (2+ templates)

1. **M3.1: Implement Audio Crossfade**
   - Template: `milestone-3-audio-crossfade.md`
   - Priority: MEDIUM
   - Dependencies: None
   - Estimated: 6-8 hours

2. **M3.2: Audio Preloading** (create manually)
3. **M3.3: Audio Controls UI** (create manually)
4. **M3.4: Playlist Mode** (create manually)

### Milestone 4: UX Enhancements (3+ templates)

1. **M4.1: Create User Settings Panel**
   - Template: `milestone-4-settings-panel.md`
   - Priority: MEDIUM
   - Dependencies: None
   - Estimated: 10-12 hours

2. **M4.2: Implement Favorites System** ✨ GREAT FOR PARALLEL AGENTS
   - Template: `milestone-4-favorites-system.md`
   - Can be done by 3 agents in parallel!
   - Estimated: 8-10 hours (parallel) or 15-21 hours (sequential)

3. **M4.3: PWA Implementation** (create manually)
4. **M4.4: Mobile Optimizations** (create manually)
5. **M4.5: Loading States** (create manually)

### Milestones 5-7

Additional templates can be created as needed following the same pattern.

---

## Creating Additional Issues Manually

For issues without templates, use this format:

### Issue Title Format
```
[Milestone #]: Brief Description
```
Example: `[M5.1]: Design Database Schema`

### Issue Body Template

```markdown
## Milestone
Milestone X: Name

## Objective
Clear objective statement

## Tasks
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

## Dependencies
List any dependent issues

## Estimated Effort
X-Y hours

## Files to Modify/Create
- Path/to/file1
- Path/to/file2

## References
- Link to docs
```

---

## Workflow for AI Agent Assignment

### Recommended Workflow:

1. **Create Issue**: Use template or manual creation
2. **Assign to Agent**: Assign to `@github-copilot` or yourself
3. **Agent Works**: Agent implements the changes
4. **Create PR**: Agent creates pull request
5. **Review**: Human reviews the PR
6. **Merge**: Merge to main
7. **Close Issue**: Automatically closes via PR

### Parallel Development Tips:

- **M1.2-M1.8** can all run in parallel after M1.1 completes ✅
- **M4.2** (Favorites) can be built by 3 agents simultaneously ✅
- Milestone 2 and 3 can progress at the same time ✅
- Avoid having multiple agents edit the same file simultaneously ⚠️

---

## Issue Tracking with GitHub Projects

### Setting Up a Project Board

1. Go to your repository → **Projects** → **New Project**
2. Choose "Board" view
3. Create columns:
   - **Backlog** - Not started
   - **Ready** - Ready to assign
   - **In Progress** - Currently being worked on
   - **In Review** - PR open, awaiting review
   - **Done** - Completed and merged

4. Add automation:
   - Auto-move to "In Progress" when issue assigned
   - Auto-move to "In Review" when PR opened
   - Auto-move to "Done" when PR merged

### Tracking Progress

Create a project view with filters:
- **By Milestone**: Group by milestone labels
- **By Priority**: Sort by priority labels
- **By Assignee**: See who's working on what
- **By Status**: Track overall progress

---

## Dependencies and Order

### Must Complete First (Blocking):
1. **M1.1** blocks all other M1.x issues
2. **M2.1** should complete before M2.2

### Recommended Order:
1. **Milestone 1** (Testing) - Provides safety net for all future work
2. **Milestone 2** (Photo Recognition) - Core functionality
3. **Milestone 3** & **Milestone 4** - Can run in parallel
4. **Milestone 5** (Backend) - After M2 ideally
5. **Milestone 6** (Advanced) - After core features
6. **Milestone 7** (Production) - Final polish

### Can Run Completely in Parallel:
- M3 (Audio) and M4 (UX) ✅
- M1.2 through M1.8 (after M1.1) ✅
- M4.2 sub-tasks (Favorites logic, UI, Storage) ✅

---

## Quick Start Guide

### For First-Time Setup:

**Week 1: Testing Foundation**
1. Create issue from template `M1.1: Setup Testing Framework`
2. Assign to AI agent or yourself
3. Complete and merge
4. Create issues for M1.2-M1.8 simultaneously
5. Assign 2-3 agents to work in parallel

**Week 2-3: Core Testing**
1. Complete M1.2-M1.8 in parallel
2. Create M1.9 for integration tests
3. Review test coverage

**Week 4+: Feature Development**
1. Start M2.1 (Photo Recognition Research)
2. Start M3.1 (Audio Crossfade) in parallel
3. Start M4.1 or M4.2 in parallel
4. Continue based on priority

---

## Monitoring Progress

### Key Metrics to Track:

- **Issues Created**: Total backlog size
- **Issues Completed**: Velocity per week
- **Test Coverage**: Percentage per module
- **Milestone Completion**: Percentage complete per milestone

### Weekly Standup Questions:

1. What issues were completed this week?
2. What issues are in progress?
3. What issues are blocked and why?
4. What's the plan for next week?

---

## Tips for Success

### For Issue Creators:
- ✅ Use templates when available
- ✅ Be specific in task descriptions
- ✅ Include acceptance criteria
- ✅ Link related documentation
- ✅ Estimate effort realistically

### For AI Agents:
- ✅ Read the module README first
- ✅ Follow the architecture principles
- ✅ Update documentation when changing contracts
- ✅ Write tests for new functionality
- ✅ Keep changes minimal and focused

### For Code Reviewers:
- ✅ Check tests are included
- ✅ Verify documentation is updated
- ✅ Ensure no breaking changes
- ✅ Review for security issues
- ✅ Test on mobile if UI changes

---

## Next Steps

1. ✅ Review this tracking guide
2. ✅ Review the ROADMAP.md
3. ▶️ Create first batch of issues from Milestone 1 templates
4. ▶️ Set up GitHub Projects board
5. ▶️ Assign issues to AI agents
6. ▶️ Begin development!

---

**Last Updated**: 2025-01-09  
**Total Issues in Roadmap**: ~60+ across 7 milestones  
**Templates Created**: 14 templates ready to use
