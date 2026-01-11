# Environment & Pipeline Directory Reorganization Plan

## Overview

- **Problem**: The repository mixes local tooling, CI scripts, and production deploy artifacts in shared paths, making it hard to keep test/local pipelines isolated from production. We need a directory plan that cleanly separates environment-specific configs, assets, and automation while reusing shared logic.
- **Success criteria**:  
  - Local, test, and production each have clear entrypoints (scripts/config) with no path collisions.  
  - CI pipelines map 1:1 to those entrypoints.  
  - Environment-specific data (env files, sample assets, manifests) lives under dedicated directories with documented ownership and rollout steps.
- **Who uses this**: Contributors running local dev/test flows, CI pipelines (unit/integration/visual), and production deploy automation.

## Technical Approach

- **Directory layout** (new top-level anchors):
  - `environments/`  
    - `local/`: `.env.local.example`, Vite overrides (`vite.config.local.ts`), dev docker compose override, local data manifests.  
    - `test/`: `.env.test.example`, Vite/Playwright overrides, synthetic assets manifest, fixture seeding instructions.  
    - `prod/`: `.env.prod.example`, production Vite overrides (minimal), deployment manifests.  
    - `shared/`: env variable contract, feature flag defaults, schema for data manifests (consumed by all envs).
  - `scripts/pipelines/` (thin entrypoints that call existing helpers in `scripts/lib/`):  
    - `local/` (dev server, story/dev data seeding),  
    - `test/` (unit, integration, visual, edge-case accuracy),  
    - `prod/` (build, bundle-size, deploy/package).
  - `infra/`  
    - `docker/` (split `compose.local.yml`, `compose.test.yml`, `compose.prod.yml`, NGINX templates),  
    - `ci/` (helper files referenced by GitHub Actions; keeps workflow YAML minimal).
  - `config/` (TypeScript config surface): central typed config loader that reads from `environments/*` manifests and exposes per-env settings to Vite/Node scripts.
- **Config strategy**: Use a single typed loader (e.g., `config/index.ts`) that accepts `NODE_ENV`/`APP_ENV` to pull the right manifest and validate against a Zod schema. Keep defaults in `environments/shared/`.
- **Data separation**: Keep existing test assets but register them under `environments/test/manifests/` (pointers to `assets/test-*`). Production data (`public/data.json`, audio) referenced via `environments/prod/manifests/`.
- **Pipeline mapping**: GitHub Actions jobs call `scripts/pipelines/{env}/{task}.sh` so local runners and CI share the same entrypoints. Each pipeline sets `APP_ENV` explicitly.
- **Migration safety**: Introduce shims (e.g., legacy `scripts/test.sh` → `scripts/pipelines/test/run-all.sh`) during transition; remove after verification.

## Implementation Plan

### Phase 1: Foundation
- (Medium) Inventory current scripts, Docker files, Vite configs, and data locations; map each to target env buckets. **Dependency**: none.
- (Medium) Create skeleton directories `environments/{local,test,prod,shared}`, `scripts/pipelines/{local,test,prod}`, `infra/{docker,ci}`, and `config/`. Add README stubs describing ownership. **Dependency**: inventory.
- (Small) Define `APP_ENV` naming and config schema (Zod/types) in `config/` with placeholder manifests in each env. **Dependency**: skeleton in place.

### Phase 2: Core Functionality
- (Medium) Wire Vite/Node entrypoints to use the typed loader (`config/index.ts`) and env-specific override files (e.g., `vite.config.local.ts`, `vite.config.test.ts`, `vite.config.prod.ts`). **Dependency**: config schema.
- (Medium) Move or reference assets/manifests into `environments/{test,prod}/manifests/` and document symlinks/pointers to existing `assets/` and `public/` data. **Dependency**: schema + skeleton.
- (Medium) Refactor helper scripts into pipeline entrypoints (`scripts/pipelines/{env}/...`) and update GitHub Actions to call them. Keep legacy shims with deprecation notes. **Dependency**: inventory + schema.
- (Medium) Split Docker Compose into env-scoped files and update `Dockerfile` references/NGINX templates under `infra/docker/`. **Dependency**: skeleton + pipeline entrypoints.

### Phase 3: Polish & Deploy
- (Small) Update documentation (README/SETUP/ARCHITECTURE plus new env README files) to reflect paths and commands. **Dependency**: core moves done.
- (Small) Add guardrails: lint rule or script that rejects missing `APP_ENV`, CI job that validates env manifests against schema. **Dependency**: config loader.
- (Small) Remove shims once CI/local flows are green and communicate migration timeline. **Dependency**: successful CI dry-runs.

## Considerations

- **Assumptions**: Vite remains the build tool; GitHub Actions is the CI; no backend services. Deploy target stays static hosting (Vercel/NGINX).
- **Constraints**: Keep bundle size and dev ergonomics; avoid breaking existing test assets; limit new dependencies (Zod or existing validator only).
- **Risks**: Path churn breaking imports, stale scripts in CI, divergent env defaults. Mitigations: shims, phased rollout, schema validation, and doc updates.

## Not Included

- Provisioning new cloud infrastructure or CD system beyond wiring to existing GitHub Actions.
- Secrets management overhaul (assumed handled by repo/CI secrets).
- Converting audio/test asset storage strategy; only path ownership/manifesting is in scope.
