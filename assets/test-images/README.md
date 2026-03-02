# Test image fixtures

This directory stores **small, synthetic, git-tracked image fixtures** used by image-dependent tests.

## Why this exists

- CI and local tests must not depend on private/local-only source photos.
- Fixtures here are deterministic and safe to keep in the public repo.
- Image-processing and hashing tests should read fixtures from this directory.

## Current fixtures

- `easy-target-bullseye.png`
- `easy-target-checker.png`
- `easy-target-diagonals.png`

If you regenerate fixtures, keep names stable unless tests are updated in the same change.
