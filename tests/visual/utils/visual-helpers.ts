import { expect, type Page } from '@playwright/test';

const FEATURE_FLAG_STORAGE_KEY = 'photo-signal-feature-flags';

interface VisualBootstrapOptions {
  featureFlags?: Record<string, boolean>;
}

export async function bootstrapVisualState(
  page: Page,
  options: VisualBootstrapOptions = {}
): Promise<void> {
  const { featureFlags } = options;

  await page.addInitScript((flags) => {
    window.localStorage.clear();
    window.sessionStorage.clear();

    if (flags) {
      window.localStorage.setItem('photo-signal-feature-flags', JSON.stringify(flags));
    }
  }, featureFlags);
}

export async function gotoLanding(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: /photo signal/i })).toBeVisible();
  await dismissDebugOverlay(page);
}

export async function openSecretSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: /open settings/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

export async function dismissDebugOverlay(page: Page): Promise<void> {
  const hideOverlayButton = page.getByRole('button', { name: /hide debug overlay/i });
  if (await hideOverlayButton.isVisible().catch(() => false)) {
    await hideOverlayButton.click();
  }
}

export async function waitForCameraState(page: Page): Promise<void> {
  await Promise.race([
    page
      .locator('video')
      .waitFor({ state: 'visible', timeout: 12000 })
      .catch(() => null),
    page
      .getByText(/camera access required/i)
      .waitFor({ state: 'visible', timeout: 12000 })
      .catch(() => null),
    page
      .getByText(/point camera at a photo to play music/i)
      .waitFor({ state: 'visible', timeout: 12000 })
      .catch(() => null),
  ]);
}

export { FEATURE_FLAG_STORAGE_KEY };
