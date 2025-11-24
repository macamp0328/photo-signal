import type { BrowserContext } from '@playwright/test';

/**
 * Attempt to grant camera permissions for browsers that support it.
 *
 * Firefox/WebKit running headless do not currently implement the
 * `camera` permission override API, so Playwright throws
 * "Unknown permission". These browsers would prompt (and fail)
 * regardless, so we swallow that specific error to keep tests
 * deterministic across engines.
 */
export async function safeGrantCameraPermissions(context: BrowserContext): Promise<void> {
  try {
    await context.grantPermissions(['camera']);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('unknown permission')) {
      console.warn('Camera permission override not supported; continuing without it.');
      return;
    }

    throw error;
  }
}
