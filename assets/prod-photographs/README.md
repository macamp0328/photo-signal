# Production Photographs (Local-Only Source Assets)

This directory is used as a local working area for source photo originals.

## Repository Policy

- Original photo files (`.jpg`, `.jpeg`, `.png`) are intentionally **not tracked** in git.
- The only tracked artifact in this folder is:
  - `prod-photographs-details.csv`

## Why

- Keep the public repository lightweight and professional.
- Avoid shipping private/high-volume source media in version control.
- Preserve deterministic metadata and mapping workflow through the CSV manifest.

## Expected Local Workflow

1. Keep source photos locally in this folder while running photo/audio workflows.
2. Update `prod-photographs-details.csv` when metadata or mappings change.
3. Commit only the CSV when needed.
