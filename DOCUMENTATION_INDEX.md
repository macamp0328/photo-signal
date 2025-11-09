# Documentation Index

> **Purpose**: Central phonebook of all project documentation to help AI agents and developers quickly find information.

---

## 📚 Core Documentation

### Project Overview & Setup

- **[README.md](./README.md)** - Main project documentation, features, setup instructions, and usage
- **[SETUP.md](./SETUP.md)** - Detailed development environment setup, CI/CD, DevContainer, and Vercel deployment
- **[DOCKER.md](./DOCKER.md)** - Docker and Docker Compose setup, containerized development guide

### Architecture & Design

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture, module structure, data flow, and design principles
- **[AI_AGENT_GUIDE.md](./AI_AGENT_GUIDE.md)** - Examples of parallel AI agent development and collaboration patterns
- **[MIGRATION.md](./MIGRATION.md)** - Migration notes from old monolithic to new modular architecture
- **[TESTING.md](./TESTING.md)** - Testing strategy, framework recommendations, and coverage goals

---

## 🧩 Module Documentation

Each module has its own README defining its API contract, usage, and examples.

### Core Modules (`src/modules/`)

- **[camera-access/README.md](./src/modules/camera-access/README.md)** - Camera permission and MediaStream management
- **[camera-view/README.md](./src/modules/camera-view/README.md)** - Video display UI component with 3:2 overlay
- **[motion-detection/README.md](./src/modules/motion-detection/README.md)** - Camera movement detection algorithm
- **[photo-recognition/README.md](./src/modules/photo-recognition/README.md)** - Photo matching service (placeholder)
- **[audio-playback/README.md](./src/modules/audio-playback/README.md)** - Audio control, playback, and fading
- **[concert-info/README.md](./src/modules/concert-info/README.md)** - Concert information display overlay

### Services (`src/services/`)

- **[data-service/README.md](./src/services/data-service/README.md)** - Concert data loading and caching

---

## ⚙️ Configuration Files

### Build & Development

- **[package.json](./package.json)** - Dependencies, scripts, and project metadata
- **[vite.config.ts](./vite.config.ts)** - Vite build configuration
- **[vitest.config.ts](./vitest.config.ts)** - Vitest test configuration
- **[tsconfig.json](./tsconfig.json)** - TypeScript root configuration
- **[tsconfig.app.json](./tsconfig.app.json)** - TypeScript app-specific configuration
- **[tsconfig.node.json](./tsconfig.node.json)** - TypeScript Node.js configuration
- **[vercel.json](./vercel.json)** - Vercel deployment settings

### Code Quality

- **[eslint.config.js](./eslint.config.js)** - ESLint linting rules (flat config format)
- **[.prettierrc.json](./.prettierrc.json)** - Prettier code formatting rules
- **[.prettierignore](./.prettierignore)** - Files excluded from Prettier formatting

### Styling

- **[tailwind.config.js](./tailwind.config.js)** - Tailwind CSS configuration
- **[postcss.config.js](./postcss.config.js)** - PostCSS configuration

---

## 🤖 GitHub & CI/CD

### Workflows

- **[.github/workflows/ci.yml](./.github/workflows/ci.yml)** - GitHub Actions CI pipeline (lint, type-check, build)

### Templates & Instructions

- **[.github/copilot-instructions.md](./.github/copilot-instructions.md)** - GitHub Copilot agent instructions
- **[.github/ISSUE_TEMPLATE/module-level-tests.md](./.github/ISSUE_TEMPLATE/module-level-tests.md)** - Template for adding module tests

---

## 🛠️ Development Environment

### VS Code

- **[.vscode/settings.json](./.vscode/settings.json)** - VS Code workspace settings
- **[.vscode/extensions.json](./.vscode/extensions.json)** - Recommended VS Code extensions

### DevContainer

- **[.devcontainer/devcontainer.json](./.devcontainer/devcontainer.json)** - DevContainer configuration for consistent development environment

### Docker

- **[Dockerfile](./Dockerfile)** - Development Docker image configuration
- **[Dockerfile.prod](./Dockerfile.prod)** - Production Docker image with NGINX
- **[docker-compose.yml](./docker-compose.yml)** - Docker Compose orchestration for dev and prod
- **[nginx.conf](./nginx.conf)** - NGINX configuration for production container

### Helper Scripts

- **[scripts/dev.sh](./scripts/dev.sh)** - Start development server (local or Docker)
- **[scripts/build.sh](./scripts/build.sh)** - Build for production (local or Docker)
- **[scripts/test.sh](./scripts/test.sh)** - Run tests (local or Docker)
- **[scripts/lint.sh](./scripts/lint.sh)** - Run linting (local or Docker)
- **[scripts/format.sh](./scripts/format.sh)** - Format code (local or Docker)
- **[scripts/create-sample-audio.sh](./scripts/create-sample-audio.sh)** - Generate sample audio file

---

## 📦 Data & Assets

- **[public/data.json](./public/data.json)** - Concert metadata (band, venue, date, audio file)
- **[public/audio/README.md](./public/audio/README.md)** - Audio files directory and instructions

---

## 🔍 Quick Reference

### For Adding New Features

1. Check **ARCHITECTURE.md** for system design and module structure
2. Read relevant module README for API contract
3. Review **AI_AGENT_GUIDE.md** for parallel development patterns
4. Follow code quality standards in **SETUP.md**

### For Configuration Changes

1. **Dependencies**: Update `package.json`
2. **Build settings**: Update `vite.config.ts` or `tsconfig.json`
3. **Code style**: Update `eslint.config.js` or `.prettierrc.json`
4. **CI/CD**: Update `.github/workflows/ci.yml`

### For AI Agents

- **New module**: Read ARCHITECTURE.md, create module with README.md first
- **Modify module**: Read module's README.md for contract, keep changes isolated
- **Parallel work**: See AI_AGENT_GUIDE.md for conflict-free collaboration
- **Testing**: See TESTING.md for strategy (tests not yet implemented)

---

## 📝 Maintenance

### When Adding New Documentation

1. Create the new documentation file
2. **Update this DOCUMENTATION_INDEX.md** with a link and description
3. Add appropriate category if needed
4. Commit both files together

### When Removing Documentation

1. Delete the documentation file
2. **Remove the link from this DOCUMENTATION_INDEX.md**
3. Check for any references in other docs
4. Commit changes together

### When Reorganizing

1. Move files to new locations
2. **Update all links in this DOCUMENTATION_INDEX.md**
3. Update any cross-references in other documentation
4. Test all links still work

---

## 🎯 Documentation Coverage

This index covers:

- ✅ Root documentation (7 files)
- ✅ Module READMEs (7 files)
- ✅ Configuration files (15 files)
- ✅ GitHub Actions & templates (3 files)
- ✅ Development environment configs (3 files)
- ✅ Docker configuration (4 files)
- ✅ Helper scripts (6 files)
- ✅ Data and asset documentation (2 files)

**Total**: 47 documented files

Last updated: 2025-11-09
