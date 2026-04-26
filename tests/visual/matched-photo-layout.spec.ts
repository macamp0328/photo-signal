import { test, expect, type Page } from '@playwright/test';
import { safeGrantCameraPermissions } from './utils/camera';
import { bootstrapVisualState, gotoLanding } from './utils/visual-helpers';
import type { AppDataV2 } from '../../src/types';

type PhotoAspect = 'landscape' | 'portrait';

interface LayoutCase {
  name: string;
  photoAspect: PhotoAspect;
  viewport: {
    width: number;
    height: number;
  };
}

const MATCH_DETAILS = {
  band: 'Overcoats Layout Test',
  venue: 'Electric Ballroom Test Venue',
  date: '2026-04-26T21:30:00-05:00',
  aperture: 'f/2.8',
  shutterSpeed: '1/250s',
  iso: '800',
  focalLength: '35mm',
};

const layoutCases: LayoutCase[] = [
  {
    name: 'landscape photo in small portrait viewport',
    photoAspect: 'landscape',
    viewport: { width: 360, height: 640 },
  },
  {
    name: 'portrait photo in small portrait viewport',
    photoAspect: 'portrait',
    viewport: { width: 360, height: 640 },
  },
  {
    name: 'landscape photo in short landscape viewport',
    photoAspect: 'landscape',
    viewport: { width: 844, height: 390 },
  },
  {
    name: 'portrait photo in short landscape viewport',
    photoAspect: 'portrait',
    viewport: { width: 844, height: 390 },
  },
];

function buildSvgPhotoDataUrl(aspect: PhotoAspect): string {
  const size = aspect === 'landscape' ? { width: 900, height: 600 } : { width: 600, height: 900 };
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">
      <rect width="100%" height="100%" fill="#111827"/>
      <rect x="24" y="24" width="${size.width - 48}" height="${size.height - 48}" fill="#d9c79f"/>
      <rect x="48" y="48" width="${size.width - 96}" height="${size.height - 96}" fill="#334155"/>
      <circle cx="${size.width * 0.5}" cy="${size.height * 0.42}" r="${Math.min(size.width, size.height) * 0.18}" fill="#f97316"/>
      <rect x="${size.width * 0.22}" y="${size.height * 0.68}" width="${size.width * 0.56}" height="${size.height * 0.08}" fill="#f8fafc"/>
    </svg>
  `;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function buildMatchedPhotoPayload(photoAspect: PhotoAspect): AppDataV2 {
  return {
    version: 2,
    artists: [{ id: 'artist-layout-regression', name: MATCH_DETAILS.band }],
    photos: [
      {
        id: 'photo-layout-regression',
        artistId: 'artist-layout-regression',
        photoUrl: buildSvgPhotoDataUrl(photoAspect),
        recognitionEnabled: true,
        aperture: MATCH_DETAILS.aperture,
        shutterSpeed: MATCH_DETAILS.shutterSpeed,
        iso: MATCH_DETAILS.iso,
        focalLength: MATCH_DETAILS.focalLength,
      },
    ],
    tracks: [
      {
        id: 'track-layout-regression',
        artistId: 'artist-layout-regression',
        songTitle: 'Regression Test Tone',
        audioFile: '/test-assets/layout-regression-silence.wav',
      },
    ],
    entries: [
      {
        id: 9001,
        artistId: 'artist-layout-regression',
        trackId: 'track-layout-regression',
        photoId: 'photo-layout-regression',
        venue: MATCH_DETAILS.venue,
        date: MATCH_DETAILS.date,
      },
    ],
  };
}

async function routeMatchedPhotoData(page: Page, photoAspect: PhotoAspect): Promise<void> {
  await page.route('**/data.app.v2.json', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(buildMatchedPhotoPayload(photoAspect)),
    });
  });

  await page.route('**/test-assets/layout-regression-silence.wav', async (route) => {
    const silentWav = Buffer.from(
      'UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=',
      'base64'
    );

    await route.fulfill({
      contentType: 'audio/wav',
      body: silentWav,
    });
  });
}

async function forceMatchedPhoto(page: Page): Promise<void> {
  await gotoLanding(page);

  await page.getByRole('button', { name: /activate camera and begin experience/i }).click();
  await page.getByRole('button', { name: /open settings/i }).click();
  await page.getByRole('button', { name: /force a photo match for testing/i }).click();

  await expect(page.locator('html')).toHaveAttribute('data-state', 'matched');
  await expect(page.getByRole('heading', { name: MATCH_DETAILS.band, level: 2 })).toBeVisible();
  await expect(page.getByText(MATCH_DETAILS.venue)).toBeVisible();
  await expect(page.getByText(/2026/)).toBeVisible();
  await expect(page.getByText(/ISO 800/)).toBeVisible();

  const matchedImage = page.getByRole('img', {
    name: `${MATCH_DETAILS.band} scanned photograph`,
  });
  await expect(matchedImage).toBeVisible();
  await matchedImage.evaluate((image) => {
    if (!(image instanceof HTMLImageElement) || image.naturalWidth === 0) {
      throw new Error('Matched photo image did not finish loading.');
    }
  });

  await expect(
    page.getByRole('button', { name: /close concert view and scan a new photo/i })
  ).toBeVisible();
}

async function expectMatchedLayoutInsideViewport(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => {
    const selectors = {
      heading: 'h2',
      venue: 'section[aria-label="Concert details"] p:nth-of-type(1)',
      date: 'section[aria-label="Concert details"] p:nth-of-type(2)',
      exif: 'section[aria-label="Concert details"] p:nth-of-type(3)',
      image: 'img[alt*="scanned photograph"]',
      scanButton: 'button[aria-label="Close concert view and scan a new photo"]',
    };

    const rectFor = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      };
    };

    const rects = Object.fromEntries(
      Object.entries(selectors).map(([key, selector]) => [key, rectFor(selector)])
    );

    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      rects,
    };
  });

  const rects = metrics.rects as Record<
    string,
    {
      top: number;
      right: number;
      bottom: number;
      left: number;
      width: number;
      height: number;
    } | null
  >;

  for (const [name, rect] of Object.entries(rects)) {
    expect(rect, `${name} should exist`).not.toBeNull();
    expect(rect?.width, `${name} should have width`).toBeGreaterThan(0);
    expect(rect?.height, `${name} should have height`).toBeGreaterThan(0);
    expect(rect?.top, `${name} should not bleed above viewport`).toBeGreaterThanOrEqual(-0.5);
    expect(rect?.left, `${name} should not bleed left of viewport`).toBeGreaterThanOrEqual(-0.5);
    expect(rect?.right, `${name} should not bleed right of viewport`).toBeLessThanOrEqual(
      metrics.viewport.width + 0.5
    );
    expect(rect?.bottom, `${name} should not be cut off below viewport`).toBeLessThanOrEqual(
      metrics.viewport.height + 0.5
    );
  }

  expect(rects.heading!.bottom, 'heading should render above matched photo').toBeLessThanOrEqual(
    rects.image!.top
  );
  expect(
    rects.exif!.bottom,
    'all concert info should render above matched photo'
  ).toBeLessThanOrEqual(rects.image!.top);
  expect(rects.image!.bottom, 'matched photo should render above scan button').toBeLessThanOrEqual(
    rects.scanButton!.top
  );
}

test.describe('Matched Photo Layout', () => {
  for (const layoutCase of layoutCases) {
    test(`@smoke keeps concert info, ${layoutCase.name}, and scan controls visible`, async ({
      page,
    }) => {
      await bootstrapVisualState(page);
      await safeGrantCameraPermissions(page.context());
      await page.setViewportSize(layoutCase.viewport);
      await routeMatchedPhotoData(page, layoutCase.photoAspect);

      await forceMatchedPhoto(page);

      await expectMatchedLayoutInsideViewport(page);
    });
  }
});
