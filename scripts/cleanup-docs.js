#!/usr/bin/env node

/**
 * Documentation Cleanup Script
 * Removes AI-generated documentation bloat per cleanup requirements
 */

import { unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const filesToDelete = [
  // Root level - Historical/completed work docs
  'CLEANUP_EXECUTIVE_SUMMARY.md',
  'README_ANALYSIS_COMPLETE.md',
  'WORKFLOW_COMPARISON_TABLE.md',
  'WORKFLOW_SPAM_EXAMPLES.md',
  'AUTO_FIX_WORKFLOW.md',
  'MOBILE_UX_IMPROVEMENTS.md',
  'FAVICON_SETUP.md',
  
  // docs/ directory - Completed work and implementation summaries
  'docs/test-mode-fix-summary.md',
  'docs/grayscale-feature-implementation.md',
  'docs/mobile-first-refactor-summary.md',
  'docs/phase-1-implementation-verification.md',
  'docs/IMPLEMENTATION_STATUS_SUMMARY.md',
  
  // docs/ directory - Research that's been consolidated into FUTURE_FEATURES.md
  'docs/phase-2-angle-compensation-analysis.md',
  'docs/phase-2-benchmarking-guide.md',
  'docs/phase-2-migration-guide.md',
  'docs/opus-streaming-implementation-plan.md',
  'docs/audio-streaming-setup.md',
  
  // docs/ directory - Redundant documentation
  'docs/code-analysis-examples.md',
  'docs/code-analysis-tooling-research.md',
  'docs/image-recognition-exploratory-analysis.md',
];

async function deleteFile(filepath) {
  const fullPath = join(rootDir, filepath);
  try {
    await unlink(fullPath);
    console.log(`✓ Deleted: ${filepath}`);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`⊘ Already deleted: ${filepath}`);
      return true;
    }
    console.error(`✗ Error deleting ${filepath}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('Starting documentation cleanup...\n');
  
  let deletedCount = 0;
  let errorCount = 0;
  
  for (const file of filesToDelete) {
    const success = await deleteFile(file);
    if (success) {
      deletedCount++;
    } else {
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('Cleanup Summary:');
  console.log(`  Total files processed: ${filesToDelete.length}`);
  console.log(`  Successfully deleted: ${deletedCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log('='.repeat(50));
  
  if (errorCount === 0) {
    console.log('\n✓ Documentation cleanup complete!');
    console.log('\nNext steps:');
    console.log('  1. Review git status: git status');
    console.log('  2. Review changes: git diff');
    console.log('  3. Commit changes: git add . && git commit');
    process.exit(0);
  } else {
    console.log('\n✗ Cleanup completed with errors');
    process.exit(1);
  }
}

main();
