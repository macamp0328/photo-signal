# GitHub Copilot Instructions for Photo Signal

> **Purpose**: This file provides guidance for GitHub Copilot and AI agents working on this project. It defines coding standards, architecture patterns, and development workflows to ensure consistency and quality.

## How to Use These Instructions

When working on this project:

1. **Read First**: Review relevant sections before making changes
2. **Follow Patterns**: Use established patterns from existing code
3. **Ask Questions**: If unclear, ask for clarification rather than guessing
4. **Update Documentation**: Keep these instructions current as the project evolves
5. **Quality First**: Always run lint, type-check, and build before committing

## Project Overview

Photo Signal is a camera-based gallery app that plays music when you point at a printed photo. It's designed as a quiet, in-home installation that uses computer vision to recognize photos and trigger corresponding audio playback.

**Tech Stack**: React 19, TypeScript, Vite, Tailwind CSS, Howler.js

## Architecture Principles

This project follows a **modular, AI-agent-friendly architecture** optimized for parallel development:

1. **Module Isolation**: Each module is self-contained with clear contracts
2. **TypeScript Contracts**: Strong typing for reliable integration
3. **Performance First**: Native APIs, minimal dependencies, optimized bundle
4. **Zero Coupling**: Modules don't depend on each other directly
5. **Cost Optimization**: Static hosting, no backend required (MVP)

### Module Structure

Each module follows this pattern:

```
src/modules/{module-name}/
├── README.md           # API contract, usage, examples
├── index.ts            # Public API exports
├── types.ts            # TypeScript interfaces
├── {Module}.tsx        # React component (if UI)
└── {Service}.ts        # Business logic (if needed)
```

## Key Documentation Files

⚠️ **IMPORTANT**: When adding, removing, or moving any documentation, configuration files, modules, or services, you **MUST** update **[DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)** to keep the documentation phonebook current.

- **[DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)** - Central phonebook of ALL project documentation (UPDATE THIS!)
- **ARCHITECTURE.md** - Module structure, data flow, AI collaboration guide
- **AI_AGENT_GUIDE.md** - Examples of parallel AI agent development
- **TESTING.md** - Testing strategy (tests not yet implemented)
- **SETUP.md** - Development workflow, CI/CD, deployment
- **README.md** - User-facing documentation

## Development Workflow

### Before Making Changes

1. Read the module's `README.md` to understand its contract
2. Keep changes isolated within module directories
3. Ensure exported interfaces remain compatible
4. Update module README if contract changes

### Code Quality Commands

```bash
npm run lint          # Check code quality
npm run lint:fix      # Auto-fix linting issues
npm run format        # Format code with Prettier
npm run format:check  # Check formatting
npm run type-check    # Validate TypeScript types
npm run build         # Create production bundle
npm run dev           # Start development server
```

### Before Committing

Always run:

```bash
npm run lint:fix
npm run format
npm run type-check
npm run build
```

## Code Style Guidelines

### TypeScript

- Strict mode enabled
- No implicit `any`
- Strict null checks
- Use interfaces for contracts, types for unions

### React

- Functional components with hooks
- No class components
- Use TypeScript for props

### Styling

- Use Tailwind CSS utility classes
- Keep inline styles to minimum
- Mobile-first responsive design

### Prettier Configuration

- 2 space indentation
- Single quotes
- Semicolons required
- Trailing commas (ES5)
- 100 character line width

## Module Guidelines

### Core Modules (src/modules/)

1. **camera-access/** - Camera permission and stream management
2. **camera-view/** - Video display UI component
3. **motion-detection/** - Movement detection algorithm
4. **photo-recognition/** - Photo matching service (currently placeholder)
5. **audio-playback/** - Audio control and fading
6. **concert-info/** - Info display overlay

### Services (src/services/)

1. **data-service/** - Concert data management (currently static JSON)

### When Adding a New Module

1. Create directory: `src/modules/new-module/`
2. Write contract first: `README.md` with API spec
3. Define types: `types.ts`
4. Implement logic: `Service.ts` or `Component.tsx`
5. Export public API: `index.ts`
6. Update ARCHITECTURE.md
7. **Update DOCUMENTATION_INDEX.md** with link to new module's README

### When Modifying a Module

1. Read the module's `README.md` contract
2. Make changes within module directory only
3. Ensure exported interface stays compatible
4. Other modules should remain untouched
5. Update module's README if contract changes
6. **Update DOCUMENTATION_INDEX.md if you added/removed/renamed files**

## Testing

⚠️ **Note**: Tests are not yet implemented (see TESTING.md)

When tests are added:

- Use Vitest (Vite-native testing)
- Test module contracts, not implementations
- Mock native APIs (MediaDevices, Canvas, Audio)
- Target >70% coverage per module

## Performance Targets

- **Bundle Size**: < 100KB initial (gzipped)
- **Runtime**: 60 FPS camera feed, instant audio response
- **Cost**: $0/month hosting (static site)

## Common Patterns

### Hooks

```typescript
export function useModuleName(options) {
  // State and logic here

  return {
    // Public API that matches README contract
  };
}
```

### Components

```typescript
interface ComponentProps {
  // Typed props
}

export function Component({ prop1, prop2 }: ComponentProps) {
  // Component logic
  return <div>...</div>;
}
```

### Services

```typescript
export class ServiceName {
  private readonly config: Config;

  public async methodName(): Promise<Result> {
    // Service logic
  }
}
```

## File Locations

- **Components**: `src/components/` (legacy) or `src/modules/*/` (preferred)
- **Types**: `src/types/` (shared types) or `src/modules/*/types.ts` (module-specific)
- **Assets**: `public/` (audio files, images, data.json)
- **Config**: Root directory (vite.config.ts, tsconfig.json, etc.)

## Data Flow

```
User Opens App
    ↓
Camera Access (request permissions)
    ↓
Stream → Motion Detection + Photo Recognition
    ↓
Photo Recognition → Concert Match
    ↓
Audio Playback + Info Display
    ↓
Motion Detection → Fade Audio
    ↓
Loop
```

## Migration Paths

### Future: Static JSON → PostgreSQL

- Add API route in `api/concerts.ts`
- Update Data Service to call API instead of fetch JSON
- Zero changes to other modules (contract stays same!)

### Future: Placeholder Recognition → ML-based

- Replace logic in `photo-recognition` module
- Keep same interface exported
- Other modules remain untouched

## AI Agent Collaboration

Multiple AI agents can work in parallel by:

1. Each agent "owns" a module directory
2. Reading README.md contract before coding
3. TypeScript enforces integration correctness
4. Minimal file overlap = minimal conflicts

See **AI_AGENT_GUIDE.md** for detailed examples of parallel development scenarios.

## Common Tasks

### Adding a Concert

Edit `public/data.json`:

```json
{
  "concerts": [
    {
      "id": 1,
      "band": "Band Name",
      "venue": "Venue Name",
      "date": "2023-08-15",
      "audioFile": "/audio/sample.mp3"
    }
  ]
}
```

### Adding Audio Files

Place MP3 files in `public/audio/` directory

### Updating Dependencies

```bash
npm install package-name
# Always check for vulnerabilities
npm audit
```

## CI/CD

- **GitHub Actions**: Runs on push to main and PRs
- **Checks**: ESLint, Prettier, Type-check, Build
- **Vercel**: Auto-deploy from main branch only

## Security

- No secrets in code
- Camera/audio permissions handled securely
- Dependencies audited regularly
- Minimal GitHub Actions permissions
- Use HTTPS for all external resources
- Sanitize user inputs (if any are added in future)
- Follow OWASP best practices for web applications

## Error Handling

### Error Handling Patterns

- **Camera Access**: Handle permission denials gracefully with user-friendly messages
- **Audio Playback**: Catch and log audio loading/playback errors
- **Network Requests**: Implement retry logic for transient failures
- **Type Safety**: Use TypeScript's strict mode to catch errors at compile time

### Error Reporting

```typescript
try {
  // Operation that might fail
} catch (error) {
  console.error('Descriptive error message:', error);
  // Show user-friendly error message
  // Don't expose sensitive error details to users
}
```

### Validation

- Validate all external data (API responses, user inputs)
- Use TypeScript types for compile-time validation
- Add runtime validation for critical data paths
- Fail fast with clear error messages

## Accessibility

### WCAG 2.1 Level AA Compliance

- **Keyboard Navigation**: All interactive elements must be keyboard accessible
- **Screen Readers**: Use semantic HTML and ARIA labels where needed
- **Color Contrast**: Ensure 4.5:1 contrast ratio for normal text, 3:1 for large text
- **Focus Indicators**: Visible focus states for all interactive elements
- **Alt Text**: Provide meaningful alt text for images (when added)

### Accessibility Patterns

```typescript
// Example: Accessible button
<button
  onClick={handleClick}
  aria-label="Start camera"
  className="focus:ring-2 focus:ring-blue-500"
>
  Start Camera
</button>
```

### Testing

- Test with keyboard only (no mouse)
- Test with screen reader (VoiceOver, NVDA, JAWS)
- Use browser DevTools accessibility audit
- Follow semantic HTML patterns

## Documentation Standards

### Code Documentation

- **Functions**: Document complex logic with clear comments
- **Interfaces**: Add JSDoc comments for public APIs
- **Modules**: Keep README.md up-to-date with contract changes
- **Examples**: Include usage examples in module READMEs

### Comment Style

```typescript
/**
 * Detects motion in the camera feed by comparing frames.
 *
 * @param currentFrame - The current video frame as ImageData
 * @param threshold - Motion sensitivity (0-100, default: 10)
 * @returns true if motion detected, false otherwise
 */
export function detectMotion(currentFrame: ImageData, threshold: number = 10): boolean {
  // Implementation
}
```

### When to Comment

- **Do**: Explain why, not what (code should be self-documenting)
- **Do**: Document complex algorithms or business logic
- **Do**: Add TODO/FIXME with ticket numbers for future work
- **Don't**: Comment obvious code
- **Don't**: Leave commented-out code (use git history instead)

## Getting Help

1. Check relevant README.md in module directory
2. Review ARCHITECTURE.md for system design
3. See AI_AGENT_GUIDE.md for collaboration patterns
4. Read SETUP.md for development environment details
5. Check DOCUMENTATION_INDEX.md for all documentation links

## Quick Reference

| Command              | Purpose                  |
| -------------------- | ------------------------ |
| `npm run dev`        | Start dev server         |
| `npm run build`      | Production build         |
| `npm run lint`       | Check code quality       |
| `npm run lint:fix`   | Fix linting issues       |
| `npm run format`     | Format code              |
| `npm run type-check` | Validate TypeScript      |
| `npm run preview`    | Preview production build |

## Troubleshooting

### Common Issues

**Camera not working**

- Check browser permissions in DevTools Console
- Ensure HTTPS or localhost (required for camera access)
- Try different browsers (Chrome, Firefox, Safari)

**Build failures**

- Clear `node_modules` and reinstall: `rm -rf node_modules package-lock.json && npm install`
- Check Node.js version (requires Node 18+)
- Run `npm run type-check` to identify TypeScript errors

**Linting errors**

- Run `npm run lint:fix` to auto-fix issues
- Run `npm run format` to fix formatting
- Check ESLint config if new rules needed

**Audio not playing**

- Check browser console for loading errors
- Verify audio file exists in `public/audio/`
- Check audio file format (MP3 supported)
- Ensure user has interacted with page (browser autoplay policy)

## Best Practices

### What TO Do

- ✅ Write self-documenting code with clear variable names
- ✅ Use TypeScript types for all function parameters and returns
- ✅ Keep functions small and focused (single responsibility)
- ✅ Write tests for new features (when test infrastructure exists)
- ✅ Run all quality checks before committing
- ✅ Update documentation when changing contracts
- ✅ Use semantic HTML elements
- ✅ Handle errors gracefully with user feedback
- ✅ Follow existing patterns in the codebase
- ✅ Ask for clarification if requirements are unclear

### What NOT To Do

- ❌ Don't use `any` type (use `unknown` if type is truly unknown)
- ❌ Don't ignore TypeScript errors (fix them, don't suppress)
- ❌ Don't skip linting/formatting before committing
- ❌ Don't add dependencies without checking bundle size impact
- ❌ Don't modify module contracts without updating README
- ❌ Don't couple modules together (maintain independence)
- ❌ Don't commit commented-out code (delete it, it's in git history)
- ❌ Don't hard-code values that should be configurable
- ❌ Don't ignore accessibility (keyboard nav, screen readers)
- ❌ Don't commit `.env` files or secrets

## Git Workflow

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring (no feature change)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (deps, config, etc.)

**Examples:**

```
feat(audio): add crossfade transitions
fix(camera): handle permission denial gracefully
docs(readme): update setup instructions
test(motion): add motion detection tests
chore(deps): update vite to 7.2.2
```

### Pull Request Guidelines

**PR Title**: Use same format as commit messages

```
feat(module-name): Brief description of changes
```

**PR Description Template**:

```markdown
## What

Brief description of what changed.

## Why

Why this change is needed.

## How

How the change was implemented.

## Testing

- [ ] Linted: `npm run lint`
- [ ] Type-checked: `npm run type-check`
- [ ] Built successfully: `npm run build`
- [ ] Tested manually: [describe testing]
- [ ] Tests pass: `npm test` (when available)

## Screenshots

[Add screenshots for UI changes]

## Documentation

- [ ] Updated module README if contract changed
- [ ] Updated DOCUMENTATION_INDEX.md if files added/removed
- [ ] Updated ARCHITECTURE.md if structure changed
```

### Branch Naming

- `feat/short-description` - New features
- `fix/short-description` - Bug fixes
- `docs/short-description` - Documentation
- `test/short-description` - Tests
- `chore/short-description` - Maintenance

## Dependency Management

### Adding Dependencies

1. **Check necessity**: Can you achieve this with existing dependencies or native APIs?
2. **Check bundle size**: Use [Bundlephobia](https://bundlephobia.com/) to check impact
3. **Check maintenance**: Is the package actively maintained? Recent commits?
4. **Check security**: Run `npm audit` after installing
5. **Check license**: Ensure compatible with project license

### Allowed Dependency Types

- **Production deps** (`dependencies`): Only what's needed in the browser
- **Dev deps** (`devDependencies`): Build tools, linters, testing frameworks
- **Peer deps**: Avoid if possible (complexity)

### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update specific package
npm update package-name

# Update all packages (be careful)
npm update

# Always audit after updates
npm audit
npm audit fix  # Auto-fix vulnerabilities if possible
```

### Preferred Libraries

- **State Management**: React hooks (useState, useContext) - no Redux needed for MVP
- **HTTP Client**: Native `fetch` API
- **Animations**: CSS transitions/animations or Tailwind
- **Testing**: Vitest + React Testing Library (when implemented)
- **Audio**: Howler.js (already included)
- **Styling**: Tailwind CSS (already configured)

---

**Remember**: When in doubt, check the module's README.md for its contract and usage examples!
