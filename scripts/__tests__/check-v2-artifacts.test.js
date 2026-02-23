import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  checkV2Artifacts,
  findMissingArtifacts,
  resolveCheckPolicy,
  resolveDeployEnvironment,
} from '../check-v2-artifacts.js';

function createTempRoot() {
  return mkdtempSync(path.join(tmpdir(), 'v2-artifacts-'));
}

function writeArtifact(rootDir, relativePath) {
  const targetPath = path.join(rootDir, relativePath);
  const parentDir = path.dirname(targetPath);
  mkdirSync(parentDir, { recursive: true });
  writeFileSync(targetPath, '{}');
}

describe('resolveDeployEnvironment', () => {
  it('prefers VITE_DEPLOY_ENV when provided', () => {
    expect(resolveDeployEnvironment({ VITE_DEPLOY_ENV: 'preview', VERCEL_ENV: 'production' })).toBe(
      'preview'
    );
  });

  it('uses VERCEL_ENV as fallback', () => {
    expect(resolveDeployEnvironment({ VERCEL_ENV: 'production' })).toBe('production');
  });

  it('returns unknown for unsupported values', () => {
    expect(resolveDeployEnvironment({ VERCEL_ENV: 'staging' })).toBe('unknown');
  });
});

describe('resolveCheckPolicy', () => {
  it('honors explicit policy override', () => {
    expect(
      resolveCheckPolicy({
        runtimeMode: 'production',
        deployEnvironment: 'production',
        configuredPolicy: 'warn',
      })
    ).toBe('warn');
  });

  it('defaults to error in production with production deploy env', () => {
    expect(
      resolveCheckPolicy({
        runtimeMode: 'production',
        deployEnvironment: 'production',
      })
    ).toBe('error');
  });

  it('defaults to warn in production with preview deploy env', () => {
    expect(
      resolveCheckPolicy({
        runtimeMode: 'production',
        deployEnvironment: 'preview',
      })
    ).toBe('warn');
  });

  it('defaults to warn in development runtime', () => {
    expect(
      resolveCheckPolicy({
        runtimeMode: 'development',
        deployEnvironment: 'production',
      })
    ).toBe('warn');
  });
});

describe('findMissingArtifacts', () => {
  it('returns missing artifact paths', () => {
    const rootDir = createTempRoot();

    try {
      writeArtifact(rootDir, 'public/data.app.v2.json');
      const missing = findMissingArtifacts(rootDir, [
        'public/data.app.v2.json',
        'public/data.recognition.v2.json',
      ]);

      expect(missing).toEqual(['public/data.recognition.v2.json']);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});

describe('checkV2Artifacts', () => {
  it('passes when artifacts are missing under warn policy', () => {
    const rootDir = createTempRoot();

    try {
      const result = checkV2Artifacts({
        rootDir,
        runtimeMode: 'production',
        deployEnvironment: 'preview',
        requiredArtifacts: ['public/data.app.v2.json'],
      });

      expect(result.ok).toBe(true);
      expect(result.policy).toBe('warn');
      expect(result.missingArtifacts).toEqual(['public/data.app.v2.json']);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('fails when artifacts are missing under error policy', () => {
    const rootDir = createTempRoot();

    try {
      const result = checkV2Artifacts({
        rootDir,
        runtimeMode: 'production',
        deployEnvironment: 'production',
        requiredArtifacts: ['public/data.app.v2.json'],
      });

      expect(result.ok).toBe(false);
      expect(result.policy).toBe('error');
      expect(result.missingArtifacts).toEqual(['public/data.app.v2.json']);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('passes when all required artifacts are present', () => {
    const rootDir = createTempRoot();

    try {
      writeArtifact(rootDir, 'public/data.app.v2.json');
      writeArtifact(rootDir, 'public/data.recognition.v2.json');
      const result = checkV2Artifacts({
        rootDir,
        runtimeMode: 'production',
        deployEnvironment: 'production',
      });

      expect(result.ok).toBe(true);
      expect(result.missingArtifacts).toEqual([]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
