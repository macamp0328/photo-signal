# GitHub Copilot Custom Agents

This directory contains custom GitHub Copilot agents for the Photo Signal project. These agents are specialized AI assistants that can help with specific development tasks.

## Available Agents

### 1. Implementation Planner

**File**: `implementation-planner.md`

**Purpose**: Creates detailed implementation plans and technical specifications for new features.

**Use Cases**:

- Breaking down complex features into actionable tasks
- Creating technical specifications and architecture documentation
- Generating implementation plans with clear steps and dependencies
- Documenting API designs, data models, and system interactions

**How to Use**:

```
@implementation-planner Can you create an implementation plan for adding photo upload functionality?
```

**Expected Outputs**:

- Structured implementation plans in markdown format
- Task breakdowns with dependencies
- Technical approach documentation
- Architecture and design specifications

---

### 2. Bug Fix Teammate

**File**: `bug-fix-teammate.md`

**Purpose**: Identifies and fixes critical bugs with targeted code changes.

**Use Cases**:

- Diagnosing and fixing production bugs
- Reproducing issues and finding root causes
- Implementing minimal, targeted fixes
- Adding regression tests to prevent future issues

**How to Use**:

```
@bug-fix-teammate The audio playback is stuttering when switching between tracks. Can you investigate and fix?
```

**Expected Outputs**:

- Root cause analysis of bugs
- Minimal code changes to fix the issue
- Updated or new tests to prevent regression
- Clear explanation of the fix and approach

---

### 3. Cleanup Specialist

**File**: `cleanup-specialist.md`

**Purpose**: Improves code quality and maintainability through cleanup and refactoring.

**Use Cases**:

- Removing code duplication
- Refactoring complex or messy code
- Updating documentation to match code
- Enforcing coding standards and best practices
- Removing dead code and unused imports

**How to Use**:

```
@cleanup-specialist Can you review and clean up the photo-recognition module?
```

**Expected Outputs**:

- Refactored code with improved readability
- Removed duplication and dead code
- Updated documentation
- No behavior changes (verified by tests)
- Consistent code style and formatting

---

## How Custom Agents Work

Custom agents are GitHub Copilot agents with specialized knowledge and behavior defined in markdown files with YAML frontmatter. Each agent has:

- **Name**: Unique identifier for the agent
- **Description**: Brief explanation of the agent's purpose
- **Tools**: List of capabilities the agent can use (read, edit, search, test, lint)
- **Instructions**: Detailed behavioral guidelines and workflow

## Using Custom Agents

### In GitHub Copilot Chat

1. Open GitHub Copilot Chat in your IDE (VS Code, Visual Studio, etc.)
2. Mention the agent using `@agent-name` syntax
3. Provide context and ask your question
4. The agent will respond with specialized assistance

### In Pull Requests

1. Open a pull request on GitHub
2. Use `@agent-name` in comments to invoke the agent
3. The agent will analyze the code and provide feedback

### Best Practices

- **Be specific**: Provide clear context and requirements
- **One task at a time**: Focus agents on specific problems
- **Review output**: Always review agent suggestions before applying
- **Iterate**: Refine your prompts if the first response isn't quite right
- **Combine agents**: Use different agents for different aspects of a task

## Configuration

### Agent Files Format

Each agent is defined in a markdown file with YAML frontmatter:

```yaml
---
name: agent-name
description: Brief description of the agent
tools: ['read', 'search', 'edit', 'test', 'lint']
---
Agent instructions and behavioral guidelines...
```

### Tools Available

- **read**: Read files and directories
- **search**: Search codebase for patterns
- **edit**: Make code changes
- **test**: Run tests
- **lint**: Run linters and formatters

### Location

Custom agents must be placed in `.github/agents/` directory in the repository root.

## Testing and Validation

### Initial Testing Checklist

- [x] Agents created with valid YAML frontmatter
- [x] Agents documented in DOCUMENTATION_INDEX.md
- [x] Agents referenced in CONTRIBUTING.md
- [ ] Test implementation-planner with feature request
- [ ] Test bug-fix-teammate with sample bug
- [ ] Test cleanup-specialist with code review
- [ ] Document any limitations or required tweaks

### Manual Testing Approach

1. **Select a test scenario** (feature, bug, or cleanup task)
2. **Invoke the agent** using `@agent-name` in Copilot Chat
3. **Provide context** with clear description and requirements
4. **Evaluate response quality**:
   - Does it follow the agent's defined role?
   - Is the output useful and actionable?
   - Does it align with project standards?
5. **Document findings** in this README

## Test Results

### Implementation Planner

**Status**: ⏳ Pending testing

**Test Scenario**: TBD

**Findings**: TBD

**Limitations**: TBD

**Tweaks Required**: TBD

---

### Bug Fix Teammate

**Status**: ⏳ Pending testing

**Test Scenario**: TBD

**Findings**: TBD

**Limitations**: TBD

**Tweaks Required**: TBD

---

### Cleanup Specialist

**Status**: ⏳ Pending testing

**Test Scenario**: TBD

**Findings**: TBD

**Limitations**: TBD

**Tweaks Required**: TBD

---

## Customization

These agents are based on default configurations from the [GitHub Copilot Customization Library](https://docs.github.com/en/copilot/tutorials/customization-library/custom-agents). They can be customized further to match project-specific needs:

1. **Edit the markdown file** in `.github/agents/`
2. **Modify the instructions** to reflect project conventions
3. **Adjust tools** based on required capabilities
4. **Test the changes** to ensure they work as expected
5. **Document customizations** in this README

## Resources

- [GitHub Docs: Custom Agents](https://docs.github.com/en/copilot/tutorials/customization-library/custom-agents)
- [GitHub Docs: Creating Custom Agents](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/create-custom-agents)
- [Customization Library](https://docs.github.com/en/copilot/tutorials/customization-library)
- [Implementation Planner Reference](https://docs.github.com/en/copilot/tutorials/customization-library/custom-agents/implementation-planner)
- [Bug Fix Teammate Reference](https://docs.github.com/en/copilot/tutorials/customization-library/custom-agents/bug-fix-teammate)

## Contributing

If you make improvements to these agents or add new ones:

1. Update the agent markdown file
2. Add/update documentation in this README
3. Update DOCUMENTATION_INDEX.md with new agent references
4. Test the agent to ensure it works correctly
5. Document any findings or limitations

---

**Last Updated**: 2025-11-12
