#!/usr/bin/env node
/**
 * check-module-readmes.js
 *
 * Verifies that each module's README.md mentions every non-type export from its index.ts.
 * Runs in CI (ci.yml) and locally via `npm run pre-commit`.
 *
 * Fails with exit code 1 if:
 *   - A module has an index.ts but no README.md
 *   - A non-type export name from index.ts is absent from the README's ## API section
 *
 * Type-only exports (export type { ... }) are intentionally skipped — types change
 * frequently and are better read directly from types.ts.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = join(__dirname, '..', 'src', 'modules');

/**
 * Extract non-type export names from an index.ts.
 *
 * Handles patterns like:
 *   export { foo, bar } from './...'
 *   export { baz } from './...'
 *
 * Skips:
 *   export type { TypeA, TypeB } from './...'
 */
function extractExports(indexSource) {
  const names = [];

  // Match `export { ... } from '...'` lines (NOT `export type { ... }`)
  const reExportPattern = /^export\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"]/gm;
  let match;

  while ((match = reExportPattern.exec(indexSource)) !== null) {
    // Check the full line to see if it starts with `export type`
    const lineStart = indexSource.lastIndexOf('\n', match.index) + 1;
    const line = indexSource.slice(lineStart, match.index + match[0].length);
    if (/^export\s+type\s+\{/.test(line.trim())) continue;

    // Extract individual names from the braces
    const namesInBraces = match[1]
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    names.push(...namesInBraces);
  }

  return names;
}

/**
 * Extract the content of the ## API section from a README.
 * Returns the full README text if no ## API section is found (liberal fallback).
 */
function extractApiSection(readmeSource) {
  const apiStart = readmeSource.search(/^## API/m);
  if (apiStart === -1) return readmeSource;
  const afterApi = readmeSource.slice(apiStart);
  const nextSection = afterApi.search(/\n## /);
  return nextSection === -1 ? afterApi : afterApi.slice(0, nextSection);
}

let hasFailure = false;
const failures = [];

const moduleDirs = readdirSync(MODULES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

for (const moduleName of moduleDirs) {
  const moduleDir = join(MODULES_DIR, moduleName);
  const indexPath = join(moduleDir, 'index.ts');
  const readmePath = join(moduleDir, 'README.md');

  if (!existsSync(indexPath)) continue;

  const indexSource = readFileSync(indexPath, 'utf8');
  const exports = extractExports(indexSource);

  if (exports.length === 0) continue; // nothing to check

  if (!existsSync(readmePath)) {
    failures.push({
      module: moduleName,
      error: `README.md missing — module has ${exports.length} export(s): ${exports.join(', ')}`,
    });
    hasFailure = true;
    continue;
  }

  const readmeSource = readFileSync(readmePath, 'utf8');
  const apiSection = extractApiSection(readmeSource);

  const missing = exports.filter((name) => !apiSection.includes(name));

  if (missing.length > 0) {
    failures.push({
      module: moduleName,
      error: `Export(s) not mentioned in ## API section: ${missing.join(', ')}`,
    });
    hasFailure = true;
  }
}

if (hasFailure) {
  console.error('\n❌ Module README check failed:\n');
  for (const { module, error } of failures) {
    console.error(`  ${module}: ${error}`);
  }
  console.error(
    '\nUpdate the module README.md to mention each export, or add a README.md if one is missing.'
  );
  console.error('Type-only exports (export type { ... }) are intentionally excluded.\n');
  process.exit(1);
} else {
  console.log(`✅ Module README check passed (${moduleDirs.length} modules checked)`);
}
