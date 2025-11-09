# GitHub Copilot Instructions for Photo Signal

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
- **Vercel**: Auto-deploy from main branch
- **Preview Deployments**: Created for all PRs

## Security

- No secrets in code
- Camera/audio permissions handled securely
- Dependencies audited regularly
- Minimal GitHub Actions permissions

## Getting Help

1. Check relevant README.md in module directory
2. Review ARCHITECTURE.md for system design
3. See AI_AGENT_GUIDE.md for collaboration patterns
4. Read SETUP.md for development environment details

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

---

**Remember**: When in doubt, check the module's README.md for its contract and usage examples!
