/**
 * Integration Test Setup
 *
 * Global setup and utilities for integration tests.
 * This file provides common setup, mocks, and cleanup for cross-module tests.
 */

import { beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Auto-cleanup after each test
 * Ensures no state leakage between integration tests
 */
afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

/**
 * Reset all mocks before each test
 */
beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Mock Howler.js for audio playback tests
 * Returns a mock Howl instance with all necessary methods
 */
export const createMockHowl = () => {
  const mockInstance = {
    play: vi.fn().mockReturnValue(1), // Howl.play() returns sound ID
    stop: vi.fn().mockReturnThis(),
    pause: vi.fn().mockReturnThis(),
    fade: vi.fn().mockReturnThis(),
    volume: vi.fn().mockReturnThis(),
    playing: vi.fn().mockReturnValue(false),
    seek: vi.fn().mockReturnValue(0),
    duration: vi.fn().mockReturnValue(30),
    state: vi.fn().mockReturnValue('loaded'),
    on: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
  };
  return mockInstance;
};

/**
 * Mock concert data for integration tests
 */
export const mockConcertData = {
  concerts: [
    {
      id: 1,
      band: 'Test Band 1',
      venue: 'Test Venue 1',
      date: '2023-08-15T20:00:00-05:00',
      audioFile: '/audio/test1.opus',
      photoHashes: {
        phash: ['aaaaaaaaaaaaaaaa'],
      },
    },
    {
      id: 2,
      band: 'Test Band 2',
      venue: 'Test Venue 2',
      date: '2023-09-20T19:30:00-05:00',
      audioFile: '/audio/test2.opus',
      photoHashes: {
        phash: ['bbbbbbbbbbbbbbbb'],
      },
    },
  ],
};

/**
 * Create a mock MediaStream for camera tests
 */
export const createMockMediaStream = () => {
  const mockStream = new MediaStream();
  const [firstVideoTrack] = mockStream.getVideoTracks();
  const fallbackTrack = {
    stop: vi.fn(),
    enabled: true,
    kind: 'video',
    label: 'Mock Video Track',
  } as unknown as MediaStreamTrack;
  const mockTrack = firstVideoTrack ?? fallbackTrack;

  if (!firstVideoTrack) {
    mockStream.addTrack(mockTrack);
  }

  return { mockStream, mockTrack };
};

/**
 * Setup common browser API mocks for integration tests
 * @returns Object containing mockStream for use in tests
 */
export const setupBrowserMocks = () => {
  // Mock navigator.mediaDevices
  const { mockStream } = createMockMediaStream();
  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue(mockStream),
    },
  });

  // Mock fetch for concert data
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => mockConcertData,
  } as Response);

  // Mock HTMLVideoElement methods
  HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLVideoElement.prototype.pause = vi.fn();

  // Mock HTMLCanvasElement.getContext
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    drawImage: vi.fn(),
    getImageData: vi.fn().mockReturnValue({
      data: new Uint8ClampedArray(640 * 480 * 4),
      width: 640,
      height: 480,
    }),
  });

  // Return mockStream for tests that need to customize camera behavior
  return { mockStream };
};
