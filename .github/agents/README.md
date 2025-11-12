# GitHub Copilot Custom Agents

This directory contains custom GitHub Copilot agents for the Photo Signal project. These agents are specialized AI assistants based on the [GitHub Copilot Customization Library](https://docs.github.com/en/copilot/tutorials/customization-library/custom-agents).

## Available Agents

### 1. Implementation Planner (`implementation-planner.md`)

Creates detailed implementation plans and technical specifications for new features.

**Usage:** `@implementation-planner Can you create an implementation plan for adding photo upload functionality?`

### 2. Bug Fix Teammate (`bug-fix-teammate.md`)

Identifies and fixes critical bugs with targeted code changes.

**Usage:** `@bug-fix-teammate The audio playback is stuttering when switching between tracks. Can you investigate and fix?`

### 3. Cleanup Specialist (`cleanup-specialist.md`)

Improves code quality and maintainability through cleanup and refactoring.

**Usage:** `@cleanup-specialist Can you review and clean up the photo-recognition module?`

## How to Use

Invoke agents using `@agent-name` in GitHub Copilot Chat (in your IDE or on GitHub.com):

```markdown
@implementation-planner <your request>
@bug-fix-teammate <your request>
@cleanup-specialist <your request>
```

## Configuration

Each agent is defined in a markdown file with YAML frontmatter:

```yaml
---
name: agent-name
description: Brief description of the agent
tools: ["read", "search", "edit"]
---

Agent instructions and behavioral guidelines...
```

## Testing Status

All three agents have been configured with their official profiles from the GitHub Copilot Customization Library and are ready for use. Functional testing requires GitHub Copilot access.

### Test Results

| Agent                  | Configuration | Status   | Notes                                     |
| ---------------------- | ------------- | -------- | ----------------------------------------- |
| implementation-planner | ✅ Complete   | ✅ Ready | Official profile from GitHub docs applied |
| bug-fix-teammate       | ✅ Complete   | ✅ Ready | Official profile from GitHub docs applied |
| cleanup-specialist     | ✅ Complete   | ✅ Ready | Official profile from GitHub docs applied |

**Testing Approach:**

To validate agent functionality:

1. Open GitHub Copilot Chat in your IDE or on GitHub.com
2. Invoke an agent using `@agent-name` followed by your request
3. Verify the agent responds appropriately to its specialized role
4. Document any issues or limitations discovered

## Resources

- [GitHub Docs: Custom Agents](https://docs.github.com/en/copilot/tutorials/customization-library/custom-agents)
- [Implementation Planner Reference](https://docs.github.com/en/copilot/tutorials/customization-library/custom-agents/implementation-planner)
- [Bug Fix Teammate Reference](https://docs.github.com/en/copilot/tutorials/customization-library/custom-agents/bug-fix-teammate)
- [Cleanup Specialist Reference](https://docs.github.com/en/copilot/tutorials/customization-library/custom-agents/cleanup-specialist)

---

**Last Updated**: 2025-11-12
