#!/usr/bin/env node

import { existsSync } from 'node:fs';
import path from 'node:path';

export const REQUIRED_V2_ARTIFACTS = ['public/data.app.v2.json', 'public/data.recognition.v2.json'];

function parseArgs(argv = process.argv.slice(2)) {
  const args = { root: process.cwd(), policy: undefined };

  for (const arg of argv) {
    if (arg.startsWith('--root=')) {
      args.root = path.resolve(arg.slice('--root='.length));
      continue;
    }

    if (arg.startsWith('--policy=')) {
      args.policy = arg.slice('--policy='.length);
    }
  }

  return args;
}

export function resolveDeployEnvironment(env = process.env) {
  const deployEnv = (env.VITE_DEPLOY_ENV ?? env.VERCEL_ENV ?? 'unknown').toLowerCase();

  if (deployEnv === 'production') return 'production';
  if (deployEnv === 'preview') return 'preview';
  if (deployEnv === 'development') return 'development';
  return 'unknown';
}

export function resolveCheckPolicy({
  runtimeMode,
  deployEnvironment,
  configuredPolicy,
  strictFlag,
}) {
  const normalizedConfiguredPolicy = configuredPolicy?.toLowerCase();
  if (normalizedConfiguredPolicy === 'error') return 'error';
  if (normalizedConfiguredPolicy === 'warn') return 'warn';

  const normalizedStrictFlag = strictFlag?.toLowerCase();
  if (normalizedStrictFlag === 'true' || normalizedStrictFlag === '1') return 'error';

  if (runtimeMode !== 'production') return 'warn';
  if (deployEnvironment === 'preview' || deployEnvironment === 'development') return 'warn';

  return 'error';
}

export function findMissingArtifacts(rootDir, requiredArtifacts = REQUIRED_V2_ARTIFACTS) {
  return requiredArtifacts.filter((relativePath) => !existsSync(path.join(rootDir, relativePath)));
}

export function checkV2Artifacts({
  rootDir = process.cwd(),
  runtimeMode = process.env.NODE_ENV?.toLowerCase() ?? 'production',
  deployEnvironment = resolveDeployEnvironment(process.env),
  configuredPolicy = process.env.VITE_DATA_V2_ARTIFACT_POLICY,
  strictFlag = process.env.VITE_DATA_V2_REQUIRED,
  requiredArtifacts = REQUIRED_V2_ARTIFACTS,
} = {}) {
  const policy = resolveCheckPolicy({
    runtimeMode,
    deployEnvironment,
    configuredPolicy,
    strictFlag,
  });

  const missingArtifacts = findMissingArtifacts(rootDir, requiredArtifacts);
  const missingList = missingArtifacts.join(', ');
  const context = `policy=${policy}, mode=${runtimeMode}, deployEnv=${deployEnvironment}`;

  if (missingArtifacts.length === 0) {
    console.log(`[v2-artifacts] All required artifacts found (${context}).`);
    return { ok: true, policy, missingArtifacts };
  }

  if (policy === 'error') {
    console.error(`[v2-artifacts] Missing required artifacts: ${missingList} (${context}).`);
    return { ok: false, policy, missingArtifacts };
  }

  console.warn(`[v2-artifacts] Missing required artifacts: ${missingList} (${context}).`);
  return { ok: true, policy, missingArtifacts };
}

function main() {
  const { root, policy } = parseArgs();
  const result = checkV2Artifacts({ rootDir: root, configuredPolicy: policy });

  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
