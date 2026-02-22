import fs from 'node:fs';
import path from 'node:path';

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const exportPrefix = 'export ';
  const normalized = trimmed.startsWith(exportPrefix)
    ? trimmed.slice(exportPrefix.length).trim()
    : trimmed;

  const separatorIndex = normalized.indexOf('=');
  if (separatorIndex <= 0) {
    return null;
  }

  const key = normalized.slice(0, separatorIndex).trim();
  let value = normalized.slice(separatorIndex + 1).trim();

  if (!key) {
    return null;
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  } else {
    const commentIndex = value.indexOf(' #');
    if (commentIndex !== -1) {
      value = value.slice(0, commentIndex).trim();
    }
  }

  return { key, value };
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      continue;
    }

    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

export function loadProjectEnv(projectRoot) {
  const envLocalPath = path.resolve(projectRoot, '.env.local');
  const envPath = path.resolve(projectRoot, '.env');

  loadEnvFile(envPath);
  loadEnvFile(envLocalPath);
}
