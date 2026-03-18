import { test, expect } from '@playwright/test';
import { bootstrapVisualState, gotoLanding } from './utils/visual-helpers';

/**
 * Visual Regression Tests for --glow-reactive-scale CSS variable consumption. @extended
 *
 * useAudioReactiveGlow modulates two CSS vars on :root from a bass-energy rAF loop:
 *   --glow-reactive-scale      range 0.6–1.8  consumed by .signalBand, .bandName
 *   --glow-reactive-scale-ring range 0.4–2.0  consumed by .signalDot
 *
 * All real consumers (.signalDot, .signalBand, .bandName) only render when
 * activeConcert is set — i.e. after a real photo match — which Playwright cannot
 * trigger. These tests therefore inject a probe element with the same calc() pattern
 * as .signalBand / .bandName (both consume --glow-reactive-scale):
 *
 *   text-shadow:
 *     0 0 calc(8px * var(--glow-reactive-scale)) <color>,
 *     0 0 calc(18px * var(--glow-reactive-scale)) <color>;
 *
 * The CSS var is set to the hook's min (0.6) and max (1.8) values and snapshotted.
 * The two baseline images will differ visually, proving the CSS var chain is intact:
 * any regression that breaks the property cascade will diverge from baseline.
 *
 * Scope: validates CSS-side var resolution. The JS side (hook sets the var correctly)
 * is covered by the unit tests in useAudioReactiveGlow.test.ts.
 */

const PROBE_TESTID = 'glow-probe';

async function injectGlowProbe(page: Parameters<typeof bootstrapVisualState>[0]): Promise<void> {
  // Replicate the two-layer text-shadow from .signalBand in App.module.css.
  // Uses --signal-glow and --signal-glow-soft (set by concert palette on :root).
  // Falls back to known accent colours so the probe is visible without an active palette.
  await page.evaluate((testId) => {
    const probe = document.createElement('div');
    probe.setAttribute('data-testid', testId);
    probe.style.cssText = [
      'position: fixed',
      'bottom: 40px',
      'left: 50%',
      'transform: translateX(-50%)',
      'font-size: 2rem',
      // Same calc() pattern as .signalBand (App.module.css) and .bandName (InfoDisplay.module.css)
      'text-shadow:' +
        '0 0 calc(8px * var(--glow-reactive-scale)) var(--signal-glow, #60a5fa),' +
        '0 0 calc(18px * var(--glow-reactive-scale)) var(--signal-glow-soft, rgba(96,165,250,0.4))',
      'color: var(--color-accent, #60a5fa)',
      'font-family: monospace',
      'z-index: 9999',
      'pointer-events: none',
      // Stable dark background so the glow is legible in CI screenshots
      'padding: 8px 12px',
      'background: rgba(0,0,0,0.6)',
      'border-radius: 4px',
    ].join('; ');
    probe.textContent = '○';
    document.body.appendChild(probe);
  }, PROBE_TESTID);
}

async function setupAndInjectProbe(
  page: Parameters<typeof bootstrapVisualState>[0]
): Promise<void> {
  await bootstrapVisualState(page, {
    featureFlags: { 'audio-reactive-glow': true },
  });
  await gotoLanding(page);
  await injectGlowProbe(page);
}

test.describe('@extended Audio-Reactive Glow CSS variable', () => {
  test('glow probe renders at minimum scale (0.6) — tight text-shadow', async ({ page }) => {
    await setupAndInjectProbe(page);

    await page.evaluate(() => {
      document.documentElement.style.setProperty('--glow-reactive-scale', '0.600');
    });

    const probe = page.locator(`[data-testid="${PROBE_TESTID}"]`);
    await expect(probe).toBeVisible();

    await expect(probe).toHaveScreenshot('glow-scale-min.png');
  });

  test('glow probe renders at maximum scale (1.8) — expanded text-shadow', async ({ page }) => {
    await setupAndInjectProbe(page);

    await page.evaluate(() => {
      document.documentElement.style.setProperty('--glow-reactive-scale', '1.800');
    });

    const probe = page.locator(`[data-testid="${PROBE_TESTID}"]`);
    await expect(probe).toBeVisible();

    await expect(probe).toHaveScreenshot('glow-scale-max.png');
  });
});
