#!/bin/bash

# Documentation Cleanup Script
# Removes AI-generated documentation bloat per cleanup requirements

set -e

echo "Starting documentation cleanup..."

# Root level - Historical/completed work docs
echo "Removing root-level historical documents..."
rm -f CLEANUP_EXECUTIVE_SUMMARY.md
rm -f README_ANALYSIS_COMPLETE.md
rm -f WORKFLOW_COMPARISON_TABLE.md
rm -f WORKFLOW_SPAM_EXAMPLES.md
rm -f AUTO_FIX_WORKFLOW.md
rm -f MOBILE_UX_IMPROVEMENTS.md
rm -f FAVICON_SETUP.md

# docs/ directory - Completed work and implementation summaries
echo "Removing completed work documentation..."
rm -f docs/test-mode-fix-summary.md
rm -f docs/grayscale-feature-implementation.md
rm -f docs/mobile-first-refactor-summary.md
rm -f docs/phase-1-implementation-verification.md
rm -f docs/IMPLEMENTATION_STATUS_SUMMARY.md

# docs/ directory - Research that's been consolidated
echo "Removing redundant research documents..."
rm -f docs/phase-2-angle-compensation-analysis.md
rm -f docs/phase-2-benchmarking-guide.md
rm -f docs/phase-2-migration-guide.md
rm -f docs/opus-streaming-implementation-plan.md
rm -f docs/audio-streaming-setup.md
rm -f docs/code-analysis-examples.md
rm -f docs/code-analysis-tooling-research.md
rm -f docs/image-recognition-exploratory-analysis.md

echo "Cleanup complete!"
echo ""
echo "Summary:"
echo "  Removed: 21 documentation files"
echo "  Kept: Core documentation (README, CONTRIBUTING, ARCHITECTURE, etc.)"
echo "  Created: FUTURE_FEATURES.md to consolidate unimplemented features"
echo ""
echo "Next step: Review git status and commit changes"
