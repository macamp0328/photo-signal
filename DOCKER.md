# Docker Guide

This project supports both local Node workflows and Docker-based workflows.

## Quick commands

### Local

```bash
npm run dev
npm run build
npm run test:run
npm run pre-commit
```

### Docker Compose

```bash
# Start development server
docker compose up dev

# Build production image
docker compose build prod

# Start production service
docker compose up prod

# Run quality checks in dev container
docker compose run --rm dev npm run pre-commit
```

## Services

Defined in `docker-compose.yml`:

- `dev` — Vite dev workflow
- `prod` — production image/runtime path

## Dev Container (VS Code)

The repository includes `.devcontainer/devcontainer.json` for a consistent toolchain.

Typical usage:

1. Open the repo in VS Code.
2. Run **Dev Containers: Reopen in Container**.
3. After setup finishes, run normal npm commands inside the container.

Optional audio workflow tooling in container environments:

```bash
bash scripts/dev/install-audio-tools.sh
```

## GitHub Codespaces

This repo is Codespaces-ready via `.devcontainer/devcontainer.json`.

Quick start:

1. Open `https://codespaces.new/macamp0328/photo-signal`
2. Wait for setup to complete
3. Run `npm run dev`

## Visual Regression Tests in the Devcontainer

The devcontainer has Chromium and WebKit (Safari) installed via `post-create.sh`.
Use the `*:agent` variants — they set `CI=1` (correct `-linux` snapshot names) and
suppress the HTML reporter (avoids the port-9323 conflict in forwarded ports):

```bash
# Update all baselines after intentional UI changes
npm run test:visual:update:agent

# Smoke check only (Chrome + Safari)
npm run test:visual:smoke:agent

# Full run
npm run test:visual:full:agent
```

> **Do not use `npm run test:visual:update`** (no `:agent` suffix) in the devcontainer.
> That variant tries to open the HTML report in a browser on port 9323, which
> conflicts with the forwarded port and throws `EADDRINUSE`.

If WebKit fails with "Host system is missing dependencies", the container needs to be
rebuilt (or run `npx playwright install --with-deps chromium webkit` once inside it).

## Notes

- Docker workflows are optional; local npm workflows are first-class.
- Use `npm run pre-commit` before committing, regardless of environment.
- If Docker is not available, all core workflows can run locally.
