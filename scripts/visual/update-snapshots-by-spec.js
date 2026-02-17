#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function printUsage() {
  console.error(
    'Usage: npm run test:visual:update:spec:agent -- <spec-file> [extra-playwright-args]'
  );
  console.error(
    'Example: npm run test:visual:update:spec:agent -- tests/visual/secret-settings.spec.ts'
  );
}

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  printUsage();
  process.exit(args.length === 0 ? 1 : 0);
}

const specPath = args[0];
const passthroughArgs = args.slice(1);

if (specPath.startsWith('-')) {
  console.error(`Expected first argument to be a spec path, got option: ${specPath}`);
  printUsage();
  process.exit(1);
}

if (!specPath.endsWith('.spec.ts')) {
  console.error(`Expected a TypeScript visual spec (*.spec.ts), got: ${specPath}`);
  process.exit(1);
}

const absoluteSpecPath = resolve(process.cwd(), specPath);
if (!existsSync(absoluteSpecPath)) {
  console.error(`Spec file does not exist: ${specPath}`);
  process.exit(1);
}

if (!specPath.startsWith('tests/visual/')) {
  console.error(`Spec must be in tests/visual/: ${specPath}`);
  process.exit(1);
}

const playwrightArgs = ['test', specPath, '--update-snapshots', ...passthroughArgs];
const result = spawnSync('playwright', playwrightArgs, {
  stdio: 'inherit',
  env: process.env,
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
