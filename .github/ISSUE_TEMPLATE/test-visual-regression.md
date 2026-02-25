---
name: Expand Visual Regression Test Coverage
about: Add more Playwright visual regression tests to catch UI bugs and ensure consistent user experience
title: 'test(visual): expand visual regression test coverage'
labels: ['testing', 'visual-regression', 'playwright', 'ui', 'ai-agent-ready']
assignees: ''
---

## Problem Statement

Currently, the visual regression test suite has **3 test files** covering landing page, camera view, and UI components. While this provides a good foundation, there are several UI states and user interactions that are not covered. Visual bugs in these areas could slip through to production.

**Current State:**

- ✅ **3 Playwright test files** with snapshots
- ✅ **Landing page** tested
- ✅ **Camera view** tested
- ✅ **UI components** tested
- ❌ **Secret settings menu** not tested
- ❌ **Concert info display** not tested
- ❌ **Error states** not tested
- ❌ **Feature flag variations** not tested
- ❌ **Mobile viewport** not tested
- ❌ **Accessibility** not tested

**Risks Without Comprehensive Visual Tests:**

1. **CSS Regressions** - Layout changes could break UI without notice
2. **Responsive Design** - Mobile viewport issues might go undetected
3. **Dark Mode** - Theme inconsistencies could slip through
4. **Error States** - Error messages might not be visible or styled correctly
5. **Animation Glitches** - Transitions might break or look janky
6. **Accessibility** - Color contrast or focus states could regress

---

## Proposed Solution

Expand Playwright visual regression test coverage to include all major UI states, error scenarios, and viewport sizes. Focus on user-visible components and critical user interactions.

### Test Coverage Goals

**High Priority (User-Visible UI):**

1. **Secret Settings Menu**
   - Closed state (invisible)
   - Open state (visible with all sections)
   - Feature flags toggled on/off
   - Custom settings sliders at various positions

- Rectangle detection overlay active

2. **Concert Info Display**
   - No concert selected (empty state)
   - Concert info displayed (band, venue, date)
   - Long band names (overflow handling)
   - Long venue names (overflow handling)

3. **Error States**
   - Camera permission denied error
   - Network error (data loading failed)
   - No concerts found (empty data)
   - Audio playback error

4. **Responsive Design**
   - Desktop viewport (1920×1080)
   - Tablet viewport (768×1024)
   - Mobile viewport (375×667)
   - Mobile landscape (667×375)

5. **Feature Flag Variations**
   - Debug overlay enabled
   - Grayscale mode enabled
   - Gallery layout vs normal layout
   - Test mode vs production mode

6. **Accessibility**
   - Focus states (keyboard navigation)
   - Color contrast (WCAG AA compliance)
   - Screen reader compatibility (aria labels)
   - High contrast mode

**Medium Priority (Secondary UI):**

7. **Guidance Messages**
   - Motion blur guidance
   - Glare guidance
   - Poor lighting guidance
   - Distance guidance
   - Off-center guidance

8. **Frame Quality Indicator**
   - Good quality (green)
   - Medium quality (yellow)
   - Poor quality (red)

9. **Loading States**
   - App loading (initial state)
   - Concert data loading
   - Audio loading

**Low Priority (Edge Cases):**

10. **Animation States**
    - Secret settings menu slide-in
    - Concert info fade-in
    - Audio crossfade visual feedback

---

## Implementation Plan

### Phase 1: Expand Secret Settings Tests

**File**: `tests/visual/secret-settings.spec.ts` (NEW)

**Test Cases:**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Secret Settings Menu', () => {
  test('closed state - should be invisible', async ({ page }) => {
    await page.goto('/');

    // Verify secret settings not visible
    const secretSettings = page.locator('[data-testid="secret-settings"]');
    await expect(secretSettings).not.toBeVisible();

    // Take snapshot
    await expect(page).toHaveScreenshot('secret-settings-closed.png');
  });

  test('open state - should display all sections', async ({ page }) => {
    await page.goto('/');

    // Triple-tap to open (simulate)
    const body = page.locator('body');
    await body.click({ clickCount: 3 });

    // Wait for menu to open
    const secretSettings = page.locator('[data-testid="secret-settings"]');
    await expect(secretSettings).toBeVisible();

    // Take snapshot
    await expect(page).toHaveScreenshot('secret-settings-open.png');
  });

  test('feature flags - test mode enabled', async ({ page }) => {
    await page.goto('/');

    // Open secret settings
    await page.locator('body').click({ clickCount: 3 });

    // Enable Test Mode
    const testModeToggle = page.locator('[data-testid="flag-test-mode"]');
    await testModeToggle.click();

    // Verify toggle state changed
    await expect(testModeToggle).toBeChecked();

    // Take snapshot
    await expect(page).toHaveScreenshot('secret-settings-test-mode-on.png');
  });

  test('feature flags - rectangle detection enabled', async ({ page }) => {
    await page.goto('/');

    // Open secret settings
    await page.locator('body').click({ clickCount: 3 });

    // Enable rectangle detection
    const rectangleToggle = page.locator('[data-testid="flag-rectangle-detection"]');
    await rectangleToggle.click();

    // Verify toggle state changed
    await expect(rectangleToggle).toBeChecked();

    // Take snapshot
    await expect(page).toHaveScreenshot('secret-settings-rectangle-detection-on.png');
  });

  test('custom settings - motion threshold slider', async ({ page }) => {
    await page.goto('/');

    // Open secret settings
    await page.locator('body').click({ clickCount: 3 });

    // Adjust motion threshold slider
    const slider = page.locator('[data-testid="setting-motion-threshold"]');
    await slider.fill('50'); // Set to 50%

    // Take snapshot
    await expect(page).toHaveScreenshot('secret-settings-slider-50.png');
  });

  test('feature flags - grayscale mode preview', async ({ page }) => {
    await page.goto('/');

    // Open secret settings
    await page.locator('body').click({ clickCount: 3 });

    // Enable grayscale mode
    const grayscaleToggle = page.locator('[data-testid="flag-grayscale-mode"]');
    await grayscaleToggle.click();

    // Verify toggle state changed
    await expect(grayscaleToggle).toBeChecked();

    // Take snapshot to capture grayscale UI changes
    await expect(page).toHaveScreenshot('secret-settings-grayscale-mode.png');
  });
});
```

---

### Phase 2: Add Concert Info Display Tests

**File**: `tests/visual/concert-info.spec.ts` (NEW)

**Test Cases:**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Concert Info Display', () => {
  test('empty state - no concert selected', async ({ page }) => {
    await page.goto('/');

    // Verify no concert info displayed
    const concertInfo = page.locator('[data-testid="concert-info"]');
    await expect(concertInfo).not.toBeVisible();

    // Take snapshot
    await expect(page).toHaveScreenshot('concert-info-empty.png');
  });

  test('concert displayed - normal band/venue names', async ({ page }) => {
    // Mock concert data
    await page.route('**/data.json', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          concerts: [
            {
              id: 1,
              band: 'The Midnight Echoes',
              venue: 'The Fillmore',
              date: '2023-08-15',
              audioFile: '/audio/test.opus',
            },
          ],
        }),
      });
    });

    await page.goto('/');

    // Trigger photo recognition (simulate)
    // ... trigger recognition

    // Verify concert info displayed
    const concertInfo = page.locator('[data-testid="concert-info"]');
    await expect(concertInfo).toBeVisible();

    // Take snapshot
    await expect(page).toHaveScreenshot('concert-info-displayed.png');
  });

  test('long band name - overflow handling', async ({ page }) => {
    // Mock concert with very long band name
    await page.route('**/data.json', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          concerts: [
            {
              id: 1,
              band: 'The Incredibly Long Band Name That Should Wrap or Truncate Properly',
              venue: 'Venue',
              date: '2023-01-01',
            },
          ],
        }),
      });
    });

    await page.goto('/');

    // Trigger recognition
    // ...

    // Take snapshot to verify text overflow handling
    await expect(page).toHaveScreenshot('concert-info-long-band-name.png');
  });

  test('long venue name - overflow handling', async ({ page }) => {
    // Mock concert with very long venue name
    await page.route('**/data.json', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          concerts: [
            {
              id: 1,
              band: 'Band',
              venue: 'The Incredibly Long Venue Name With Many Words That Should Handle Overflow',
              date: '2023-01-01',
            },
          ],
        }),
      });
    });

    await page.goto('/');

    // Trigger recognition
    // ...

    // Take snapshot
    await expect(page).toHaveScreenshot('concert-info-long-venue-name.png');
  });
});
```

---

### Phase 3: Add Error State Tests

**File**: `tests/visual/error-states.spec.ts` (NEW)

**Test Cases:**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Error States', () => {
  test('camera permission denied', async ({ page, context }) => {
    // Deny camera permission
    await context.grantPermissions([], { permissions: ['camera'] });

    await page.goto('/');

    // Click start camera
    const startButton = page.locator('button:has-text("Start Camera")');
    await startButton.click();

    // Wait for error message
    const errorMessage = page.locator('[role="alert"]');
    await expect(errorMessage).toBeVisible();

    // Take snapshot
    await expect(page).toHaveScreenshot('error-camera-denied.png');
  });

  test('network error - data loading failed', async ({ page }) => {
    // Mock network error
    await page.route('**/data.json', (route) => {
      route.abort('failed');
    });

    await page.goto('/');

    // Wait for error state
    await page.waitForTimeout(1000); // Give time for fetch to fail

    // Take snapshot
    await expect(page).toHaveScreenshot('error-network-failed.png');
  });

  test('no concerts found - empty data', async ({ page }) => {
    // Mock empty concert data
    await page.route('**/data.json', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ concerts: [] }),
      });
    });

    await page.goto('/');

    // Take snapshot
    await expect(page).toHaveScreenshot('error-no-concerts.png');
  });

  test('audio playback error', async ({ page }) => {
    // Mock audio file not found
    await page.route('**/audio/*.opus', (route) => {
      route.abort('failed');
    });

    await page.goto('/');

    // Trigger audio playback (simulate recognition)
    // ...

    // Wait for error
    await page.waitForTimeout(1000);

    // Take snapshot
    await expect(page).toHaveScreenshot('error-audio-failed.png');
  });
});
```

---

### Phase 4: Add Responsive Design Tests

**File**: `tests/visual/responsive.spec.ts` (NEW)

**Test Cases:**

```typescript
import { test, expect, devices } from '@playwright/test';

test.describe('Responsive Design', () => {
  test('desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    // Take snapshot
    await expect(page).toHaveScreenshot('responsive-desktop.png');
  });

  test('tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    // Take snapshot
    await expect(page).toHaveScreenshot('responsive-tablet.png');
  });

  test('mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Take snapshot
    await expect(page).toHaveScreenshot('responsive-mobile.png');
  });

  test('mobile landscape', async ({ page }) => {
    await page.setViewportSize({ width: 667, height: 375 });
    await page.goto('/');

    // Take snapshot
    await expect(page).toHaveScreenshot('responsive-mobile-landscape.png');
  });

  test('secret settings menu - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Open secret settings
    await page.locator('body').click({ clickCount: 3 });

    // Verify menu fits viewport
    const secretSettings = page.locator('[data-testid="secret-settings"]');
    await expect(secretSettings).toBeVisible();

    // Take snapshot
    await expect(page).toHaveScreenshot('responsive-secret-settings-mobile.png');
  });

  test('concert info - mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Mock concert data
    await page.route('**/data.json', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          concerts: [
            {
              id: 1,
              band: 'Band Name',
              venue: 'Venue Name',
              date: '2023-01-01',
            },
          ],
        }),
      });
    });

    await page.goto('/');

    // Trigger recognition
    // ...

    // Take snapshot
    await expect(page).toHaveScreenshot('responsive-concert-info-mobile.png');
  });
});
```

---

### Phase 5: Add Accessibility Tests

**File**: `tests/visual/accessibility.spec.ts` (NEW)

**Test Cases:**

```typescript
import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility', () => {
  test('focus states - keyboard navigation', async ({ page }) => {
    await page.goto('/');

    // Tab to first focusable element
    await page.keyboard.press('Tab');

    // Take snapshot showing focus ring
    await expect(page).toHaveScreenshot('a11y-focus-first-element.png');

    // Tab to next element
    await page.keyboard.press('Tab');

    // Take snapshot
    await expect(page).toHaveScreenshot('a11y-focus-second-element.png');
  });

  test('color contrast - WCAG AA compliance', async ({ page }) => {
    await page.goto('/');

    // Inject axe for automated accessibility testing
    await injectAxe(page);

    // Check color contrast
    await checkA11y(page, null, {
      rules: {
        'color-contrast': { enabled: true },
      },
    });
  });

  test('screen reader - aria labels', async ({ page }) => {
    await page.goto('/');

    // Check for aria-label on important elements
    const startButton = page.locator('button:has-text("Start Camera")');
    const ariaLabel = await startButton.getAttribute('aria-label');

    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel).toContain('camera');

    // Take snapshot
    await expect(page).toHaveScreenshot('a11y-aria-labels.png');
  });

  test('high contrast mode', async ({ page }) => {
    await page.goto('/');

    // Enable high contrast mode (via CSS media query)
    await page.emulateMedia({ forcedColors: 'active' });

    // Take snapshot
    await expect(page).toHaveScreenshot('a11y-high-contrast.png');
  });

  test('focus visible - all interactive elements', async ({ page }) => {
    await page.goto('/');

    // Open secret settings to test all interactive elements
    await page.locator('body').click({ clickCount: 3 });

    // Tab through all elements
    const interactiveElements = page.locator('button, input, [role="button"], [role="checkbox"]');
    const count = await interactiveElements.count();

    for (let i = 0; i < count; i++) {
      await page.keyboard.press('Tab');

      // Take snapshot of each focus state
      await expect(page).toHaveScreenshot(`a11y-focus-element-${i}.png`);
    }
  });
});
```

---

### Phase 6: Add Feature Flag Variation Tests

**File**: `tests/visual/feature-flags.spec.ts` (NEW)

**Test Cases:**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Flag Variations', () => {
  test('debug overlay enabled', async ({ page }) => {
    // Set feature flag in localStorage
    await page.addInitScript(() => {
      localStorage.setItem(
        'feature-flags',
        JSON.stringify({
          'debug-overlay': true,
        })
      );
    });

    await page.goto('/');

    // Verify debug overlay visible
    const debugOverlay = page.locator('[data-testid="debug-overlay"]');
    await expect(debugOverlay).toBeVisible();

    // Take snapshot
    await expect(page).toHaveScreenshot('feature-debug-overlay.png');
  });

  test('multi-scale recognition enabled', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'feature-flags',
        JSON.stringify({
          'multi-scale-recognition': true,
        })
      );
    });

    await page.goto('/');

    // Verify flag persisted in localStorage
    const isEnabled = await page.evaluate(() => {
      const stored = localStorage.getItem('feature-flags');
      if (!stored) return false;
      const flags = JSON.parse(stored);
      return Boolean(flags['multi-scale-recognition']);
    });
    expect(isEnabled).toBe(true);

    // Take snapshot
    await expect(page).toHaveScreenshot('feature-multi-scale-recognition.png');
  });

  test('gallery layout enabled', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'feature-flags',
        JSON.stringify({
          'gallery-layout': true,
        })
      );
    });

    await page.goto('/');

    // Verify gallery layout applied
    const galleryLayout = page.locator('[data-testid="gallery-layout"]');
    await expect(galleryLayout).toBeVisible();

    // Take snapshot
    await expect(page).toHaveScreenshot('feature-gallery-layout.png');
  });

  test('test mode enabled', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'feature-flags',
        JSON.stringify({
          'test-mode': true,
        })
      );
    });

    // Mock test data
    await page.route('**/data.app.v2.json', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          version: 2,
          artists: [{ id: 'artist-1', name: 'Test Band' }],
          photos: [{ id: 'photo-1', artistId: 'artist-1', imageFile: '/assets/test.jpg' }],
          tracks: [{ id: 'track-1', artistId: 'artist-1', audioFile: '/audio/test.opus' }],
          entries: [
            {
              id: 1,
              artistId: 'artist-1',
              trackId: 'track-1',
              photoId: 'photo-1',
              venue: 'Test Venue',
              date: '2023-01-01',
            },
          ],
        }),
      });
    });

    await page.goto('/');

    // Take snapshot
    await expect(page).toHaveScreenshot('feature-test-mode.png');
  });
});
```

---

### Phase 7: Update Playwright Configuration

**File**: `playwright.config.ts`

**Add New Test Paths:**

```typescript
export default defineConfig({
  testDir: './tests',
  testMatch: [
    '**/visual/**/*.spec.ts', // Include all visual test files
  ],
  // ... rest of config
});
```

**Add Mobile Devices:**

```typescript
export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  // ... rest of config
});
```

---

### Phase 8: Update Documentation

**Files to Update:**

1. `TESTING.md` - Add visual regression test section
2. `tests/visual/README.md` - Update with new test files
3. `DOCUMENTATION_INDEX.md` - No changes needed (no new files outside tests/)

**TESTING.md Addition:**

````markdown
### Visual Regression Tests

Visual regression tests use Playwright to capture screenshots and detect UI changes:

| Test Suite      | Scenarios | Coverage                            |
| --------------- | --------- | ----------------------------------- |
| landing-page    | 3         | Initial app state                   |
| camera-view     | 5         | Camera UI, permissions, errors      |
| ui-components   | 4         | Buttons, overlays, info display     |
| secret-settings | 6         | Settings menu, flags, sliders       |
| concert-info    | 4         | Concert display, overflow handling  |
| error-states    | 4         | Permission, network, empty data     |
| responsive      | 6         | Desktop, tablet, mobile viewports   |
| accessibility   | 5         | Focus states, contrast, ARIA labels |
| feature-flags   | 4         | Flag variations, visual effects     |

**Running Visual Tests:**

```bash
# Run all visual tests
npm run test:visual

# Run in UI mode (interactive)
npm run test:visual:ui

# Update snapshots after intentional changes
npm run test:visual:update

# View test report
npm run test:visual:report
```
````

**When to Update Snapshots:**

- After intentional UI changes (new styles, layout changes)
- After updating dependencies that affect rendering
- After fixing visual bugs (verify fix looks correct first)

**Never update snapshots blindly** - always review changes in the Playwright UI first!

```

---

## Acceptance Criteria

- [ ] 6+ new visual regression test files created
- [ ] Tests cover secret settings, concert info, error states, responsive, accessibility, feature flags
- [ ] All tests pass: `npm run test:visual` exits with code 0
- [ ] Snapshots generated for all test cases
- [ ] Tests cover multiple viewport sizes (desktop, tablet, mobile)
- [ ] Tests verify keyboard navigation (focus states)
- [ ] Tests verify color contrast (WCAG AA)
- [ ] Tests handle error states gracefully
- [ ] playwright.config.ts updated with mobile devices
- [ ] TESTING.md updated with visual test documentation
- [ ] tests/visual/README.md updated with new test files
- [ ] All quality checks pass:
  - `npm run lint:fix`
  - `npm run format`
  - `npm run type-check`

---

## Code Quality Requirements

- [ ] **Descriptive Test Names**: Test names explain what is being tested
- [ ] **Stable Tests**: Tests are deterministic (no flakiness)
- [ ] **Clean Snapshots**: Snapshots show clear visual differences
- [ ] **Proper Waits**: Use `waitForSelector` or `waitForTimeout` appropriately
- [ ] **Mock Data**: Use consistent mock data for predictable results
- [ ] **Cleanup**: Reset state between tests (localStorage, etc.)

---

## Testing Checklist

### Manual Verification

- [ ] Run visual tests: `npm run test:visual`
- [ ] Review snapshots in Playwright UI: `npm run test:visual:ui`
- [ ] Verify snapshots look correct (no cut-off elements, proper styling)
- [ ] Verify tests run on multiple browsers (chromium, firefox, webkit)
- [ ] Verify tests run on mobile viewports (Pixel 5, iPhone 12)

### Visual Coverage

- [ ] Secret settings menu (closed/open states)
- [ ] Concert info (empty/displayed/overflow)
- [ ] Error states (permission, network, empty)
- [ ] Responsive (desktop, tablet, mobile, landscape)
- [ ] Accessibility (focus, contrast, ARIA)
- [ ] Feature flags (debug, rectangle detection, gallery, test mode)

---

## Future Enhancements

- [ ] Add dark mode visual tests
- [ ] Add animation regression tests (capture video)
- [ ] Add cross-browser visual diff tool
- [ ] Add Percy.io or Chromatic integration for cloud visual testing
- [ ] Add visual tests for guidance messages
- [ ] Add visual tests for loading states

---

## References

- **Existing Visual Tests**: `tests/visual/`
- **Playwright Docs**: https://playwright.dev/
- **Visual Testing Guide**: https://playwright.dev/docs/test-snapshots
- **Accessibility Testing**: https://playwright.dev/docs/accessibility-testing
- **Testing Guide**: `TESTING.md`

---

## AI Agent Guidelines

This issue is **AI agent-ready** and follows the project's testing standards.

### Visual Test Patterns

1. **Setup**: Navigate to page, set viewport, mock data
2. **Act**: Trigger UI changes (click, type, navigate)
3. **Assert**: Take screenshot with `expect(page).toHaveScreenshot()`
4. **Cleanup**: Reset state for next test

### Testing Workflow

1. Create test file in `tests/visual/`
2. Import `test` and `expect` from `@playwright/test`
3. Use `test.describe()` to group related tests
4. Use `test()` for individual test cases
5. Mock data with `page.route()` when needed
6. Set viewport with `page.setViewportSize()`
7. Take screenshots with `expect(page).toHaveScreenshot()`
8. Run tests: `npm run test:visual`
9. Review snapshots in UI: `npm run test:visual:ui`
10. Update snapshots if needed: `npm run test:visual:update`

### Commit Messages

```

test(visual): add secret settings visual regression tests
test(visual): add concert info display visual tests
test(visual): add error state visual tests
test(visual): add responsive design visual tests
test(visual): add accessibility visual tests
test(visual): add feature flag variation visual tests
docs(testing): update TESTING.md with visual test coverage

```

---

**Last Updated**: 2025-11-21
```
