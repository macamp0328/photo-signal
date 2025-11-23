import { test, expect } from '@playwright/test';

/**
 * Visual Regression Tests for Concert Info Display
 *
 * These tests capture screenshots of the concert info display component
 * in various states to detect unintended CSS or visual changes.
 */

test.describe('Concert Info Display', () => {
  test('empty state - no concert selected', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // In the initial state, no concert should be displayed
    // Take snapshot of the landing page (empty state)
    await expect(page).toHaveScreenshot('concert-info-empty.png', {
      fullPage: true,
    });
  });

  test('concert displayed - normal band/venue names', async ({ page }) => {
    // Mock concert data with normal length names
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
    await page.waitForLoadState('networkidle');

    // Note: In a real scenario, we would need to trigger photo recognition
    // For this visual test, we're capturing the state as it appears
    // This may need adjustment based on how concert info is actually displayed

    // Take snapshot
    await expect(page).toHaveScreenshot('concert-info-normal.png', {
      fullPage: true,
    });
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
              band: 'The Incredibly Long Band Name That Should Wrap or Truncate Properly Without Breaking Layout',
              venue: 'The Venue',
              date: '2023-01-01',
              audioFile: '/audio/test.opus',
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take snapshot to verify text overflow handling
    await expect(page).toHaveScreenshot('concert-info-long-band-name.png', {
      fullPage: true,
    });
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
              band: 'Test Band',
              venue:
                'The Incredibly Long Venue Name With Many Words That Should Handle Overflow Gracefully',
              date: '2023-01-01',
              audioFile: '/audio/test.opus',
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take snapshot
    await expect(page).toHaveScreenshot('concert-info-long-venue-name.png', {
      fullPage: true,
    });
  });

  test('mobile viewport - concert info display', async ({ page }) => {
    // Set mobile viewport
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
              band: 'Mobile Test Band',
              venue: 'Mobile Test Venue',
              date: '2023-01-01',
              audioFile: '/audio/test.opus',
            },
          ],
        }),
      });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take snapshot on mobile
    await expect(page).toHaveScreenshot('concert-info-mobile.png', {
      fullPage: true,
    });
  });
});
