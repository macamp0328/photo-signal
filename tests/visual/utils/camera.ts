import type { BrowserContext, Page } from '@playwright/test';

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

/**
 * Inject a deterministic placeholder for camera video elements so screenshots are stable.
 */
export async function applyStableCameraPlaceholder(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
video,
[data-testid="camera-video"] {
  background: linear-gradient(135deg, #0f172a, #1e293b);
  object-fit: cover !important;
}
video::-webkit-media-controls,
video::-moz-media-controls {
  display: none !important;
}
`,
  });
}
