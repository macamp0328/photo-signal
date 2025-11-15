---
name: Optimize MP3 Storage Strategy
about: Find the most sustainable way to ship and stream 100+ MP3 tracks without bloating the repo
title: 'chore(audio): design scalable MP3 storage plan'
labels: ['audio', 'storage', 'performance', 'ai-agent-ready']
assignees: ''
---

## Problem Statement

Test Mode now includes a pack of real 30-second clips under `assets/example-real-songs/`. The current approach works for a handful of files (~12 MB total) but does **not** scale once we add full-length takes or dozens more clips:

- Git history balloons quickly when committing large binaries
- Vite copies every MP3 into `public/assets/example-real-songs/`, increasing build times and preview startup
- GitHub clones/downloads pull the entire audio archive even when engineers just want the code
- Future roadmap calls for ~100 tracks, so the repository could easily exceed multiple gigabytes

We need a sustainable storage + delivery model before adding more real songs.

## Context

- Audio playback today expects static URLs (e.g., `/assets/example-real-songs/01-mass-romantic-clip-01.mp3`)
- Build pipeline runs in Vercel + GitHub Actions with default disk quotas
- Some contributors work offline, so we still need an easy path for local testing
- Licensing rules differ between synthetic tones (CC0) and user-provided recordings (internal-use only)

## Goals

1. Keep developer onboarding light (no multi-GB clone requirements)
2. Preserve the "flip a flag → hear real song" Test Mode experience
3. Maintain a trustworthy source of truth for each recording + metadata
4. Support CI/CD without failing due to artifact size limits

## Possible Approaches

1. **External Object Storage** (S3, R2, Supabase, etc.)
   - Store MP3s outside the repo, expose signed URLs or public bucket paths
   - Pros: Small repo, infinite scale
   - Cons: Requires credentials/config, offline dev may suffer

2. **Git LFS**
   - Keep MP3s versioned via LFS pointers
   - Pros: Minimal code changes, still "git clone" friendly
   - Cons: Requires LFS setup, still pushes data through GitHub quotas

3. **Hybrid**
   - Ship a tiny starter pack (1–2 songs) + script to pull the remaining catalog from storage on demand
   - Pros: Onboarding stays lightweight; advanced users fetch more files as needed

4. **App-Level Streaming**
   - Host MP3s on a streaming/CDN service and reference them directly from the dataset
   - Pros: No build impact; production-ready for end users
   - Cons: Requires resilient hosting + caching strategy

## Open Questions

- How much storage is acceptable inside the repo (threshold in MB)?
- Do we need offline access to _all_ songs, or just a curated subset?
- Can we reuse existing Vercel storage (Edge Config, KV, blob) or do we need separate infra?
- What compliance requirements apply to user-provided recordings?
- Should the data service expose a layer of indirection (e.g., `audioLibrary` field) to switch sources dynamically?

## Deliverables

- Decision document outlining the recommended approach and tradeoffs
- Implementation plan (code + infra + migration steps)
- Updated documentation (Test Mode guide, ASSET_LICENSES, SETUP) describing how contributors obtain the MP3 library
- Automation/scripts to sync or fetch audio if the source is outside the repo

## Acceptance Criteria

- ✅ Clear recommendation approved by maintainers
- ✅ Prototype or spike demonstrating the approach (e.g., sample URL rewrite, LFS config, or fetch script)
- ✅ Updated docs & tooling so future AI agents can follow the new workflow without guesswork
- ✅ No regression to Test Mode (real songs still play when the feature flag is enabled)
