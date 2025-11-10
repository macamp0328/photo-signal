/**
 * Global mocks for native browser APIs
 *
 * This file contains mock implementations for browser APIs that are not available
 * in the test environment (happy-dom/jsdom). These mocks are automatically loaded
 * by the test setup file.
 */

import { vi } from 'vitest';

/**
 * Mock MediaDevices API (navigator.mediaDevices.getUserMedia)
 *
 * Used by: camera-access module
 */
export function mockMediaDevices() {
  const mockStream = {
    getTracks: vi.fn(() => []),
    getVideoTracks: vi.fn(() => [
      {
        stop: vi.fn(),
        getSettings: vi.fn(() => ({
          width: 1280,
          height: 720,
          frameRate: 30,
        })),
      },
    ]),
    getAudioTracks: vi.fn(() => []),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue(mockStream),
      enumerateDevices: vi.fn().mockResolvedValue([]),
      getSupportedConstraints: vi.fn().mockReturnValue({}),
    },
  });

  return mockStream;
}

/**
 * Mock HTMLMediaElement (video/audio elements)
 *
 * Used by: camera-view, audio-playback modules
 */
export function mockHTMLMediaElement() {
  // Mock HTMLVideoElement
  Object.defineProperty(HTMLVideoElement.prototype, 'play', {
    writable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });

  Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
    writable: true,
    value: vi.fn(),
  });

  Object.defineProperty(HTMLVideoElement.prototype, 'load', {
    writable: true,
    value: vi.fn(),
  });

  // Mock HTMLAudioElement
  Object.defineProperty(HTMLAudioElement.prototype, 'play', {
    writable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });

  Object.defineProperty(HTMLAudioElement.prototype, 'pause', {
    writable: true,
    value: vi.fn(),
  });

  Object.defineProperty(HTMLAudioElement.prototype, 'load', {
    writable: true,
    value: vi.fn(),
  });

  // Mock common properties
  Object.defineProperty(HTMLMediaElement.prototype, 'muted', {
    writable: true,
    value: false,
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
    writable: true,
    value: 1.0,
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    writable: true,
    value: 0,
  });

  Object.defineProperty(HTMLMediaElement.prototype, 'duration', {
    writable: true,
    value: NaN,
  });
}

/**
 * Mock ImageData constructor
 *
 * Used by: photo-recognition module
 */
export function mockImageData() {
  // Create a polyfill for ImageData if it doesn't exist
  if (typeof ImageData === 'undefined') {
    (global as any).ImageData = class ImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      colorSpace: PredefinedColorSpace;

      constructor(
        dataOrWidth: Uint8ClampedArray | number,
        widthOrHeight: number,
        height?: number,
        settings?: ImageDataSettings
      ) {
        if (dataOrWidth instanceof Uint8ClampedArray) {
          // Constructor: new ImageData(data, width, height)
          this.data = dataOrWidth;
          this.width = widthOrHeight;
          this.height = height || dataOrWidth.length / (widthOrHeight * 4);
        } else {
          // Constructor: new ImageData(width, height)
          this.width = dataOrWidth;
          this.height = widthOrHeight;
          this.data = new Uint8ClampedArray(this.width * this.height * 4);
        }
        this.colorSpace = settings?.colorSpace || 'srgb';
      }
    };
  }
}

/**
 * Mock CanvasRenderingContext2D
 *
 * Used by: motion-detection, photo-recognition modules
 */
export function mockCanvasRenderingContext2D() {
  const mockContext = {
    canvas: document.createElement('canvas'),
    drawImage: vi.fn(),
    getImageData: vi.fn((x: number, y: number, w: number, h: number) => {
      return new ImageData(w, h);
    }),
    putImageData: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    translate: vi.fn(),
    transform: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
  };

  // Mock canvas.getContext('2d')
  HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
    if (contextType === '2d') {
      return mockContext as unknown as CanvasRenderingContext2D;
    }
    return null;
  }) as HTMLCanvasElement['getContext'];

  return mockContext;
}

/**
 * Mock Fetch API
 *
 * Used by: data-service, photo-recognition modules
 */
export function mockFetch() {
  global.fetch = vi.fn((url: string | URL | Request) => {
    const urlString = typeof url === 'string' ? url : url.toString();

    // Mock response for data.json
    if (urlString.includes('data.json')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () =>
          Promise.resolve({
            concerts: [],
          }),
        text: () => Promise.resolve('{}'),
        blob: () => Promise.resolve(new Blob()),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        headers: new Headers(),
      } as Response);
    }

    // Default mock response
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      headers: new Headers(),
    } as Response);
  });
}

/**
 * Mock requestAnimationFrame / cancelAnimationFrame
 *
 * Used by: motion-detection module
 */
export function mockRequestAnimationFrame() {
  let frameId = 0;

  global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    frameId++;
    // Execute callback immediately in tests
    setTimeout(() => callback(performance.now()), 0);
    return frameId;
  });

  global.cancelAnimationFrame = vi.fn(() => {
    // No-op in tests
  });
}

/**
 * Initialize all global mocks
 *
 * Call this function in your test setup file to enable all mocks
 */
export function setupGlobalMocks() {
  mockImageData();
  mockMediaDevices();
  mockHTMLMediaElement();
  mockCanvasRenderingContext2D();
  mockFetch();
  mockRequestAnimationFrame();
}
