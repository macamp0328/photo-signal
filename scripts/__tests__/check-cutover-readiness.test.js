import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateCutoverReadiness } from '../check-cutover-readiness.js';

function createTempDir() {
  return mkdtempSync(path.join(tmpdir(), 'cutover-readiness-'));
}

function writeJson(rootDir, relativePath, payload) {
  const fullPath = path.join(rootDir, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, JSON.stringify(payload, null, 2), 'utf-8');
}

function telemetryPayload({ legacyFallbackLoads, legacyFallbackLoadsInProduction }) {
  return {
    timestamp: new Date().toISOString(),
    dataSource: {
      policy: {
        runtimeMode: 'production',
        deployEnvironment: 'production',
        fallbackPolicy: 'error',
      },
      telemetry: {
        v2LoadAttempts: 10,
        v2LoadFailures: 0,
        legacyFallbackLoads,
        legacyFallbackLoadsInProduction,
      },
      cutoverReadiness: {
        legacyFallbackObserved: legacyFallbackLoads > 0,
        legacyFallbackObservedInProduction: legacyFallbackLoadsInProduction > 0,
      },
    },
  };
}

describe('evaluateCutoverReadiness', () => {
  it('returns yes when production fallback usage is zero', () => {
    const rootDir = createTempDir();

    try {
      writeJson(
        rootDir,
        'exports/photo-signal-telemetry-1.json',
        telemetryPayload({ legacyFallbackLoads: 0, legacyFallbackLoadsInProduction: 0 })
      );

      const result = evaluateCutoverReadiness({ inputs: [rootDir] });

      expect(result.ok).toBe(true);
      expect(result.summary.safeToRemoveLegacyFallback).toBe(true);
      expect(result.summary.analyzedSessions).toBe(1);
      expect(result.line).toContain('safe to remove legacy fallback: yes');
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('returns no when production fallback usage is present', () => {
    const rootDir = createTempDir();

    try {
      writeJson(
        rootDir,
        'exports/photo-signal-telemetry-1.json',
        telemetryPayload({ legacyFallbackLoads: 2, legacyFallbackLoadsInProduction: 2 })
      );

      const result = evaluateCutoverReadiness({ inputs: [rootDir] });

      expect(result.ok).toBe(false);
      expect(result.summary.safeToRemoveLegacyFallback).toBe(false);
      expect(result.summary.sessionsWithLegacyFallbackInProduction).toBe(1);
      expect(result.line).toContain('safe to remove legacy fallback: no');
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('tracks missing dataSource telemetry payloads', () => {
    const rootDir = createTempDir();

    try {
      writeJson(rootDir, 'exports/photo-signal-telemetry-1.json', { timestamp: Date.now() });

      const result = evaluateCutoverReadiness({ inputs: [rootDir] });

      expect(result.ok).toBe(true);
      expect(result.summary.analyzedSessions).toBe(0);
      expect(result.summary.sessionsMissingDataSource).toBe(1);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it('fails when no data is found and requireData is enabled', () => {
    const rootDir = createTempDir();

    try {
      writeJson(rootDir, 'exports/not-a-telemetry-export.json', { hello: 'world' });

      const result = evaluateCutoverReadiness({
        inputs: [rootDir],
        requireData: true,
      });

      expect(result.ok).toBe(false);
      expect(result.summary.analyzedSessions).toBe(0);
      expect(result.line).toContain('safe to remove legacy fallback: no');
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
