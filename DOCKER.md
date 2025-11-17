# Docker Development Guide

This guide explains how to use Docker and Docker Compose to develop, build, and test Photo Signal in a fully containerized environment.

## Prerequisites

- **Docker Desktop** (for Mac/Windows) or **Docker Engine** (for Linux)
- **Docker Compose** (included with Docker Desktop)

### Installing Docker on Mac

1. Download [Docker Desktop for Mac](https://www.docker.com/products/docker-desktop)
2. Install and start Docker Desktop
3. Verify installation:
   ```bash
   docker --version
   docker-compose --version
   ```

## Quick Start

### Option 1: Using Helper Scripts (Recommended)

The project includes helper scripts in the `scripts/` directory that work both locally and with Docker.

#### Development

```bash
# Start development server (local)
./scripts/dev.sh

# Start development server (Docker)
USE_DOCKER=true ./scripts/dev.sh
```

#### Build

```bash
# Build for production (local)
./scripts/build.sh

# Build for production (Docker)
USE_DOCKER=true ./scripts/build.sh
```

#### Test

```bash
# Run tests (local)
./scripts/test.sh

# Run tests (Docker)
USE_DOCKER=true ./scripts/test.sh
```

#### Lint

```bash
# Lint code (local)
./scripts/lint.sh

# Lint and fix (local)
./scripts/lint.sh --fix

# Lint in Docker
USE_DOCKER=true ./scripts/lint.sh
```

#### Format

```bash
# Format code (local)
./scripts/format.sh

# Check formatting (local)
./scripts/format.sh --check

# Format in Docker
USE_DOCKER=true ./scripts/format.sh
```

### Option 2: Using Docker Compose Directly

#### Development Mode

```bash
# Start development server
docker-compose up dev

# Start in detached mode
docker-compose up -d dev

# View logs
docker-compose logs -f dev
```

The dev server will be available at http://localhost:5173

#### Production Mode

```bash
# Build and start production server
docker-compose up prod

# Build only
docker-compose build prod

# Start in detached mode
docker-compose up -d prod
```

The production server will be available at http://localhost:8080

#### Run Commands in Container

```bash
# Run tests
docker-compose run --rm dev npm test -- --run

# Run linting
docker-compose run --rm dev npm run lint

# Run type checking
docker-compose run --rm dev npm run type-check

# Install a new package
docker-compose run --rm dev npm install package-name
```

#### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Development Container (VS Code)

### Setup

1. Install the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension in VS Code
2. Open the project in VS Code
3. When prompted, click "Reopen in Container"
   - Or use Command Palette: `Dev Containers: Reopen in Container`

### What You Get

- Pre-configured Node.js 20 environment
- **GitHub CLI (`gh`)** - for interacting with GitHub issues, PRs, and repositories
- All VS Code extensions installed:
  - ESLint
  - Prettier
  - TypeScript
- Auto-format on save
- Auto-fix ESLint issues on save
- Port 5173 forwarded for dev server
- Dependencies automatically installed

### Available Tools

The dev container includes these CLI tools:

- **GitHub CLI (`gh`)**: Interact with GitHub from the command line
  ```bash
  gh issue list
  gh issue view 73
  gh pr create
  gh pr view
  ```
- **npm/node**: Package management and JavaScript runtime
- **git**: Version control
- **curl/wget**: HTTP requests
- **apt**: Package management (Debian-based)

### Working in Dev Container

All npm commands work as normal:

```bash
npm run dev
npm test
npm run build
npm run lint
```

The dev server will be accessible at http://localhost:5173 on your host machine.

## Docker Images

### Development Image (`Dockerfile`)

- Based on `node:20-bookworm`
- Includes GitHub CLI for GitHub integration
- Ships Python 3.11 with `yt-dlp` and `mutagen` preinstalled for the audio workflow
- Includes all dev dependencies
- Optimized for hot reload
- Uses volume mounts for source code

### Production Image (`Dockerfile.prod`)

- Multi-stage build
- Builder stage uses `node:20-bookworm` to stay aligned with dev container toolchains
- Production stage uses `nginx:alpine`
- Optimized for size and performance
- Serves static files with gzip compression

## Architecture

```
┌─────────────────────────────────────┐
│  Development Container (dev)        │
│  - Node.js 20                       │
│  - Vite dev server                  │
│  - Hot reload enabled               │
│  - Source code mounted              │
│  Port: 5173                         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  Production Container (prod)        │
│  - NGINX Alpine                     │
│  - Compiled static files            │
│  - Gzip compression                 │
│  - Optimized for performance        │
│  Port: 80 (mapped to 8080)          │
└─────────────────────────────────────┘
```

## Volumes

The development service uses a named volume for `node_modules`:

- **Purpose**: Avoids conflicts between host and container
- **Benefit**: Faster npm installs, no platform-specific binary issues
- **Trade-off**: `node_modules` on host won't be populated

To inspect the volume:

```bash
docker volume inspect photo-signal_node_modules
```

## Networking

Both services expose ports to the host:

- **Development**: `5173:5173`
- **Production**: `8080:80`

## Troubleshooting

### Port Already in Use

If port 5173 or 8080 is already in use:

```bash
# Stop the conflicting service
docker-compose down

# Or modify ports in docker-compose.yml
```

### Container Won't Start

```bash
# View logs
docker-compose logs dev

# Rebuild the image
docker-compose build --no-cache dev

# Remove all containers and start fresh
docker-compose down -v
docker-compose up dev
```

### Changes Not Reflected

The development container uses volume mounts for hot reload. If changes aren't reflected:

1. Check that the dev server is running: `docker-compose logs dev`
2. Ensure the volume mount is correct: `docker-compose config`
3. Restart the container: `docker-compose restart dev`

### Permission Issues (Linux)

On Linux, files created in the container may have different ownership:

```bash
# Fix ownership of files
sudo chown -R $USER:$USER .
```

### Can't Install Packages on Mac

If you encounter issues installing packages on Mac (especially with native modules):

```bash
# Use Docker to install
docker-compose run --rm dev npm install package-name

# Or rebuild the container
docker-compose build --no-cache dev
```

## Best Practices

1. **Use Scripts**: Prefer `./scripts/*.sh` for common tasks
2. **Clean Builds**: Regularly run `docker-compose down -v` to clean volumes
3. **Dev Container**: Use VS Code Dev Container for consistent environment
4. **Environment Variables**: Set `USE_DOCKER=true` for Docker mode in scripts

## CI/CD Integration

The project includes GitHub Actions CI that doesn't use Docker. For local testing that matches CI:

```bash
# Run the same checks as CI
npm ci
npm run lint
npm run format:check
npm run type-check
npm run build
npm test -- --run
```

## Performance Tips

### Mac Performance

Docker on Mac can be slow with large file trees. To improve performance:

1. **Use Dev Container**: VS Code Dev Containers are optimized
2. **Limit Volume Mounts**: We mount only `/app`, not subdirectories
3. **Named Volumes**: `node_modules` uses a named volume for speed

### Build Caching

Docker caches layers. To maximize caching:

1. **Dependencies First**: `package*.json` is copied before source code
2. **Immutable Layers**: Base images and dependencies rarely change
3. **Rebuild Sparingly**: Only rebuild when Dockerfile changes

```bash
# Fast rebuild (uses cache)
docker-compose build dev

# Full rebuild (no cache)
docker-compose build --no-cache dev
```

## Advanced Usage

### Custom Ports

Edit `docker-compose.yml` to change ports:

```yaml
services:
  dev:
    ports:
      - '3000:5173' # Access dev server on port 3000
```

### Environment Variables

Add environment variables to `docker-compose.yml`:

```yaml
services:
  dev:
    environment:
      - VITE_API_URL=http://localhost:3000
      - NODE_ENV=development
```

### Multiple Environments

Create additional compose files:

```bash
# docker-compose.test.yml
docker-compose -f docker-compose.yml -f docker-compose.test.yml up
```

## Summary

| Task            | Local Command     | Docker Command                                |
| --------------- | ----------------- | --------------------------------------------- |
| Dev Server      | `npm run dev`     | `docker-compose up dev`                       |
| Build           | `npm run build`   | `docker-compose build prod`                   |
| Test            | `npm test`        | `docker-compose run --rm dev npm test`        |
| Lint            | `npm run lint`    | `docker-compose run --rm dev npm run lint`    |
| Format          | `npm run format`  | `docker-compose run --rm dev npm run format`  |
| Install Package | `npm install pkg` | `docker-compose run --rm dev npm install pkg` |

---

**Next Steps**: See [SETUP.md](./SETUP.md) for general development setup and [README.md](./README.md) for project overview.
