# Setup

📚 See [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md) for the full documentation map.

This guide is intentionally minimal and focused on active workflows.

## Prerequisites

- Node.js 20+
- npm 10+

Optional:

- Docker + Docker Compose (see [DOCKER.md](./DOCKER.md))
- VS Code Dev Containers extension

## Local Development

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Start the app:

   ```bash
   npm run dev
   ```

3. Open:

   ```text
   http://localhost:5173
   ```

## GitHub Codespaces (Recommended Fast Onboarding)

1. Open:

```text
https://codespaces.new/macamp0328/photo-signal
```

2. Wait for container setup to finish (dependencies + lightweight type-check run automatically).

3. Start app:

```bash
npm run dev
```

4. Optional audio workflow tools (only when needed):

```bash
bash scripts/dev/install-audio-tools.sh
```

## Core Commands

- Lint:

  ```bash
  npm run lint
  npm run lint:fix
  ```

- Format:

  ```bash
  npm run format:check
  npm run format
  ```

- Type-check:

  ```bash
  npm run type-check
  ```

- Unit tests:

  ```bash
  npm run test:run
  ```

- Production build:

  ```bash
  npm run build
  npm run preview
  ```

## Quality Gate (Before Commit)

Run the full local CI gate:

```bash
npm run pre-commit
```

This runs lint fix, formatting, type-checking, unit tests, build, and bundle-size checks.

## Visual Regression Tests

Install Playwright browsers once per machine/container:

```bash
npx playwright install --with-deps chromium
```

Then run visual tests:

```bash
npm run test:visual
npm run test:visual:update
npm run test:visual:report
```

## Docker and DevContainer

- Docker-first setup, commands, and troubleshooting are in [DOCKER.md](./DOCKER.md).
- Dev container config is in [.devcontainer](./.devcontainer).

## CI/CD Summary

The main CI workflow in [.github/workflows/ci.yml](./.github/workflows/ci.yml) runs on pushes/PRs to `main` and includes:

- install dependencies
- audit dependencies (non-blocking)
- lint + format check + type-check
- tests with coverage and Codecov upload
- production build
- audio data artifact build/validation
- bundle-size check

Visual regression tests run in a separate workflow: [.github/workflows/visual-regression.yml](./.github/workflows/visual-regression.yml).

## Deployment

- Site: Vercel static deployment
- Audio proxy: Cloudflare Worker + R2

See [docs/AUDIO_R2_WORKER.md](./docs/AUDIO_R2_WORKER.md).
