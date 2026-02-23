#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_FILE_PATTERN = 'photo-signal-telemetry-';

function parseArgs(argv = process.argv.slice(2)) {
  const args = {
    inputs: [],
    pattern: DEFAULT_FILE_PATTERN,
    requireData: false,
  };

  for (const arg of argv) {
    if (arg === '--require-data') {
      args.requireData = true;
      continue;
    }

    if (arg.startsWith('--pattern=')) {
      args.pattern = arg.slice('--pattern='.length);
      continue;
    }

    args.inputs.push(arg);
  }

  if (args.inputs.length === 0) {
    args.inputs = [process.cwd()];
  }

  return args;
}

function collectJsonFiles(inputPath, collected = []) {
  const resolvedPath = path.resolve(inputPath);
  const stats = statSync(resolvedPath);

  if (stats.isFile()) {
    if (resolvedPath.endsWith('.json')) {
      collected.push(resolvedPath);
    }
    return collected;
  }

  const entries = readdirSync(resolvedPath, { withFileTypes: true });
  for (const entry of entries) {
    const nextPath = path.join(resolvedPath, entry.name);
    if (entry.isDirectory()) {
      collectJsonFiles(nextPath, collected);
      continue;
    }

    if (entry.isFile() && nextPath.endsWith('.json')) {
      collected.push(nextPath);
    }
  }

  return collected;
}

function isTelemetryExport(jsonFilePath, pattern = DEFAULT_FILE_PATTERN) {
  const fileName = path.basename(jsonFilePath);
  return fileName.includes(pattern);
}

function parseTelemetryFile(jsonFilePath) {
  const raw = readFileSync(jsonFilePath, 'utf-8');
  return JSON.parse(raw);
}

function extractDataSourceTelemetry(report) {
  const dataSource = report?.dataSource;
  const policy = dataSource?.policy;
  const telemetry = dataSource?.telemetry;

  if (!policy || !telemetry) {
    return null;
  }

  return {
    policy,
    telemetry,
  };
}

export function evaluateCutoverReadiness({
  inputs = [process.cwd()],
  pattern = DEFAULT_FILE_PATTERN,
  requireData = false,
} = {}) {
  const files = inputs.flatMap((inputPath) => collectJsonFiles(inputPath));
  const telemetryFiles = files.filter((filePath) => isTelemetryExport(filePath, pattern));

  let analyzedSessions = 0;
  let sessionsMissingDataSource = 0;
  let sessionsWithLegacyFallback = 0;
  let sessionsWithLegacyFallbackInProduction = 0;
  let legacyFallbackLoads = 0;
  let legacyFallbackLoadsInProduction = 0;

  for (const filePath of telemetryFiles) {
    let parsed;
    try {
      parsed = parseTelemetryFile(filePath);
    } catch {
      sessionsMissingDataSource += 1;
      continue;
    }

    const extracted = extractDataSourceTelemetry(parsed);
    if (!extracted) {
      sessionsMissingDataSource += 1;
      continue;
    }

    analyzedSessions += 1;

    const legacyLoads = Number(extracted.telemetry.legacyFallbackLoads ?? 0);
    const productionLegacyLoads = Number(extracted.telemetry.legacyFallbackLoadsInProduction ?? 0);

    legacyFallbackLoads += legacyLoads;
    legacyFallbackLoadsInProduction += productionLegacyLoads;

    if (legacyLoads > 0) {
      sessionsWithLegacyFallback += 1;
    }

    if (productionLegacyLoads > 0) {
      sessionsWithLegacyFallbackInProduction += 1;
    }
  }

  const hasSufficientData = analyzedSessions > 0;
  const safeToRemoveLegacyFallback =
    hasSufficientData && sessionsWithLegacyFallbackInProduction === 0;

  const summary = {
    safeToRemoveLegacyFallback,
    analyzedSessions,
    sessionsMissingDataSource,
    sessionsWithLegacyFallback,
    sessionsWithLegacyFallbackInProduction,
    legacyFallbackLoads,
    legacyFallbackLoadsInProduction,
  };

  const status = safeToRemoveLegacyFallback ? 'yes' : 'no';
  const line =
    `safe to remove legacy fallback: ${status}` +
    ` (sessions=${analyzedSessions},` +
    ` missingDataSource=${sessionsMissingDataSource},` +
    ` legacyFallbackSessions=${sessionsWithLegacyFallback},` +
    ` prodLegacyFallbackSessions=${sessionsWithLegacyFallbackInProduction},` +
    ` prodLegacyFallbackLoads=${legacyFallbackLoadsInProduction})`;

  const ok = safeToRemoveLegacyFallback || (!hasSufficientData && !requireData);
  return { ok, line, summary };
}

function main() {
  const args = parseArgs();
  const result = evaluateCutoverReadiness({
    inputs: args.inputs,
    pattern: args.pattern,
    requireData: args.requireData,
  });

  if (!result.summary.analyzedSessions) {
    console.warn('[cutover-readiness] No telemetry exports with dataSource telemetry were found.');
  }

  if (result.ok) {
    console.log(result.line);
    return;
  }

  console.error(result.line);
  process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
