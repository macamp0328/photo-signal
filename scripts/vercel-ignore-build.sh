#!/bin/bash
# Vercel Ignore Build Step Script
#
# This script determines whether Vercel should build and deploy.
# Exit code 0 = proceed with build
# Exit code 1 = skip build
#
# Strategy: Only build when pushing to the main branch
# This prevents preview deployments for PRs and other branches,
# helping to stay within Vercel's free tier limits.

# Check if VERCEL_GIT_COMMIT_REF is set (Vercel environment variable)
if [ -z "$VERCEL_GIT_COMMIT_REF" ]; then
  echo "⚠️  VERCEL_GIT_COMMIT_REF not set. Allowing build."
  exit 0
fi

# Only build for main branch
if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then
  echo "✅ Building main branch"
  exit 0
else
  echo "⏭️  Skipping build for branch: $VERCEL_GIT_COMMIT_REF (only main branch triggers builds)"
  exit 1
fi
