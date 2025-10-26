# Project Setup Documentation

## Overview
This project is now fully configured with a modern development workflow including:
- **Vite** - Fast build tool and dev server
- **React 19** - UI library
- **TypeScript** - Type safety
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **GitHub Actions CI** - Automated testing and building
- **DevContainer** - Consistent development environment
- **Vercel** - Auto-deployment

## Local Development

### Prerequisites
- Node.js 20+
- npm

### Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```
   Visit http://localhost:5173

3. **Run linting:**
   ```bash
   npm run lint
   npm run lint:fix  # Auto-fix issues
   ```

4. **Check formatting:**
   ```bash
   npm run format:check
   npm run format  # Auto-format all files
   ```

5. **Type-check:**
   ```bash
   npm run type-check
   ```

6. **Build for production:**
   ```bash
   npm run build
   ```

7. **Preview production build:**
   ```bash
   npm run preview
   ```

## GitHub Actions CI

The CI workflow runs automatically on:
- Push to `main` branch
- Pull requests targeting `main`

### CI Steps:
1. **Checkout code** - Get repository code
2. **Setup Node.js** - Install Node 20 with npm caching
3. **Install dependencies** - Run `npm ci` for clean install
4. **Run ESLint** - Check code quality and patterns
5. **Check formatting** - Ensure code follows Prettier rules
6. **Type-check** - Validate TypeScript types
7. **Build** - Create production bundle
8. **Upload artifacts** - Save build output for review (7 days)

### Performance Optimizations:
- **npm caching** - Dependencies cached between runs for faster installs
- **Minimal permissions** - Job runs with `contents: read` only
- **Single job** - All checks run sequentially to minimize overhead

## DevContainer

Open this project in VS Code with the Dev Containers extension to get:
- Pre-configured Node 20 environment
- All recommended extensions installed:
  - ESLint
  - Prettier
  - TypeScript
- Auto-format on save
- Auto-fix ESLint issues on save
- Port 5173 forwarded for dev server

### Using DevContainer:
1. Install Docker Desktop
2. Install "Dev Containers" VS Code extension
3. Open project in VS Code
4. Click "Reopen in Container" when prompted
5. Wait for container to build and dependencies to install

## Vercel Deployment

### Auto-Deploy:
- Pushes to `main` branch automatically deploy to production
- Pull requests get preview deployments

### Vercel Configuration (vercel.json):
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Dev Command:** `npm run dev`
- **Framework:** Vite

### First-Time Vercel Setup:
1. Visit [vercel.com](https://vercel.com)
2. Import the GitHub repository
3. Vercel will auto-detect the settings from `vercel.json`
4. Deploy!

## Project Structure

```
photo-signal/
├── .devcontainer/
│   └── devcontainer.json       # DevContainer configuration
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI workflow
├── .vscode/
│   ├── extensions.json        # Recommended VS Code extensions
│   └── settings.json          # VS Code workspace settings
├── public/                    # Static assets
├── src/
│   ├── assets/               # Images, icons, etc.
│   ├── App.tsx               # Main app component
│   ├── App.css               # App styles
│   ├── main.tsx              # Entry point
│   └── index.css             # Global styles
├── .eslintrc.json            # ESLint configuration
├── .prettierrc.json          # Prettier configuration
├── .prettierignore           # Files to ignore in formatting
├── index.html                # HTML template
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── tsconfig.app.json         # App TypeScript config
├── tsconfig.node.json        # Node TypeScript config
├── vercel.json               # Vercel deployment config
└── vite.config.ts            # Vite configuration
```

## Code Quality Standards

### ESLint Rules:
- Recommended JavaScript rules
- TypeScript strict rules
- React Hooks rules
- React Refresh for HMR

### Prettier Configuration:
- 2 space indentation
- Single quotes
- Semicolons required
- Trailing commas (ES5)
- 100 character line width
- LF line endings

### TypeScript:
- Strict mode enabled
- No implicit any
- Strict null checks
- All strict options enabled

## Best Practices

1. **Before Committing:**
   ```bash
   npm run lint:fix
   npm run format
   npm run type-check
   npm run build
   ```

2. **PR Guidelines:**
   - All CI checks must pass
   - Code must be formatted with Prettier
   - No linting errors
   - No type errors
   - Build must succeed

3. **Development Workflow:**
   - Create feature branch
   - Make changes
   - Run linting and formatting
   - Push to GitHub
   - Create pull request
   - Wait for CI to pass
   - Merge to main
   - Auto-deploy to Vercel

## Troubleshooting

### Port Already in Use
If port 5173 is in use, Vite will automatically use the next available port.

### Build Fails
1. Clear cache: `rm -rf node_modules dist`
2. Reinstall: `npm install`
3. Try building again: `npm run build`

### CI Failing
1. Run all checks locally first
2. Ensure all files are formatted: `npm run format`
3. Fix any linting errors: `npm run lint:fix`
4. Check types: `npm run type-check`

### DevContainer Issues
1. Rebuild container: Cmd+Shift+P > "Dev Containers: Rebuild Container"
2. Check Docker is running
3. Ensure you have enough disk space

## Security

- GitHub Actions workflow uses minimal permissions (`contents: read`)
- No secrets exposed in code
- Dependencies are regularly audited
- All dependencies are locked in `package-lock.json`

## Next Steps

1. Set up Vercel deployment by connecting your GitHub repository
2. Add additional tests as needed
3. Configure branch protection rules on GitHub
4. Consider adding:
   - Unit tests (Vitest)
   - E2E tests (Playwright)
   - Code coverage reporting
   - Automated dependency updates (Dependabot)
