# Visual Regression Tests

This directory contains Playwright-based visual regression tests for the Photo Signal project.

## Purpose

Visual regression tests detect unintended CSS or visual changes by comparing screenshots of UI components across runs. These tests ensure that any changes to styles, layouts, or visual elements are intentional and reviewed before merging.

## Test Structure

Tests are organized by UI area:

- **`landing-page.spec.ts`** - Landing page in inactive state, multiple viewports
- **`camera-view.spec.ts`** - Camera permission states, active camera view, error states
- **`ui-components.spec.ts`** - Secret settings, themes, responsive design, interactive states

## Running Tests

### Prerequisites

Install Playwright browsers (one-time setup):

```bash
npx playwright install chromium
```

### Run All Visual Tests

```bash
npx playwright test
```

### Run Specific Test File

```bash
npx playwright test tests/visual/landing-page.spec.ts
```

### Update Baseline Screenshots

When you intentionally change CSS or UI, update the baseline screenshots:

```bash
npx playwright test --update-snapshots
```

### View Test Results

After running tests, view the HTML report:

```bash
npx playwright show-report
```

## CI Integration

Visual regression tests run automatically in GitHub Actions via the `.github/workflows/visual-regression.yml` workflow:

- Runs on all pull requests and pushes to `main`
- Fails the check if visual differences are detected
- Uploads diff images as artifacts for review
- Separate from the main CI workflow for clarity

## Screenshot Storage

Baseline screenshots are stored alongside test files in:

```
tests/visual/
├── landing-page.spec.ts
├── landing-page.spec.ts-snapshots/
│   ├── landing-page-chromium-linux.png
│   ├── landing-page-mobile-chromium-linux.png
│   └── landing-page-tablet-chromium-linux.png
├── camera-view.spec.ts
├── camera-view.spec.ts-snapshots/
│   └── ...
└── ...
```

**Important**: Baseline screenshots are committed to the repository so CI can compare against them.

## Configuration

Visual regression test configuration is in `playwright.config.ts`:

- **Test directory**: `./tests/visual`
- **Base URL**: `http://localhost:4173` (Vite preview server)
- **Browser**: Chromium (can add Firefox, WebKit if needed)
- **Threshold**: 0.2% pixel difference tolerance (for anti-aliasing)
- **Timeout**: 30 seconds per test
- **Retries**: 2 on CI, 0 locally

## Writing New Visual Tests

When adding new UI components or pages, add corresponding visual tests:

```typescript
import { test, expect } from '@playwright/test';

test.describe('My New Component', () => {
  test('should render correctly', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigate to your component state
    // ...

    // Take screenshot
    await expect(page).toHaveScreenshot('my-component.png');
  });
});
```

### Best Practices

1. **Wait for stability**: Use `page.waitForLoadState('networkidle')` to ensure page is fully loaded
2. **Disable animations**: Configured globally in `playwright.config.ts`
3. **Full page vs component**: Use `fullPage: true` for page-level tests
4. **Multiple viewports**: Test responsive layouts at mobile, tablet, desktop sizes
5. **Meaningful names**: Use descriptive screenshot names like `landing-page-mobile.png`
6. **Isolate tests**: Each test should be independent and reset state

## Troubleshooting

### Tests Failing Due to Minor Differences

If tests fail due to anti-aliasing or minor rendering differences:

1. Review the diff images in `test-results/`
2. If differences are acceptable, update threshold in `playwright.config.ts`
3. Or update baselines with `--update-snapshots`

### Flaky Tests

If screenshots vary between runs:

1. Ensure animations are disabled
2. Wait for network idle: `await page.waitForLoadState('networkidle')`
3. Add specific waits: `await page.waitForTimeout(500)`
4. Mock dynamic content (dates, randomness)

### CI-Only Failures

If tests pass locally but fail on CI:

1. Font rendering differs between OS - update baselines from CI
2. Run tests in Docker locally to match CI environment
3. Check for system font differences

## References

- [Playwright Visual Comparisons](https://playwright.dev/docs/test-snapshots)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [GitHub Actions Integration](https://playwright.dev/docs/ci-intro)
