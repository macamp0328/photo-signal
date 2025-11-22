/**
 * Global mocks for native browser APIs
 *
 * This file contains mock implementations for browser APIs that are not available
 * in the test environment (happy-dom/jsdom). These mocks are automatically loaded
 * by the test setup file.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const concertsFixturePath = resolve(__dirname, '../../assets/test-data/concerts.json');
const concertsFixture = JSON.parse(readFileSync(concertsFixturePath, 'utf-8')) as Record<
  string,
  unknown
>;

const cloneFixture = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

type TrackKind = 'audio' | 'video';

const createMockTrack = (kind: TrackKind): MediaStreamTrack => {
  return {
    kind,
    enabled: true,
    muted: false,
    label: kind === 'video' ? 'Mock Camera' : 'Mock Mic',
    readyState: 'live',
    id: `${kind}-track`,
    stop: vi.fn(),
    clone: vi.fn(() => createMockTrack(kind)),
    getSettings: vi.fn(() => ({
      width: 1280,
      height: 720,
      frameRate: 30,
      deviceId: `${kind}-device`,
    })),
    getConstraints: vi.fn(() => ({})),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onended: null,
    onmute: null,
    onunmute: null,
    contentHint: '',
    context: null,
    idBase: undefined,
    isolated: false,
    mutedInternal: false,
    processors: [],
  } as unknown as MediaStreamTrack;
};

class TestMediaStream extends EventTarget {
  private tracks: MediaStreamTrack[];

  constructor(initialTracks?: MediaStreamTrack[]) {
    super();
    this.tracks = initialTracks ? [...initialTracks] : [createMockTrack('video')];
  }

  get active() {
    return true;
  }

  get id() {
    return 'mock-stream';
  }

  addTrack = vi.fn((track: MediaStreamTrack) => {
    this.tracks.push(track);
    this.dispatchEvent(new Event('addtrack'));
  });

  removeTrack = vi.fn((track: MediaStreamTrack) => {
    this.tracks = this.tracks.filter((item) => item !== track);
    this.dispatchEvent(new Event('removetrack'));
  });

  getTracks = vi.fn(() => [...this.tracks]);

  getVideoTracks = vi.fn(() => this.tracks.filter((track) => track.kind === 'video'));

  getAudioTracks = vi.fn(() => this.tracks.filter((track) => track.kind === 'audio'));

  clone = vi.fn(() => new TestMediaStream(this.tracks));

  onaddtrack: ((this: MediaStream, ev: MediaStreamTrackEvent) => unknown) | null = null;

  onremovetrack: ((this: MediaStream, ev: MediaStreamTrackEvent) => unknown) | null = null;
}

const ensureMediaStream = () => {
  if (typeof MediaStream === 'function' && MediaStream.name === 'TestMediaStream') {
    return;
  }

  Object.defineProperty(globalThis, 'MediaStream', {
    configurable: true,
    writable: true,
    value: TestMediaStream as unknown as typeof MediaStream,
  });
};

/**
 * Mock MediaDevices API (navigator.mediaDevices.getUserMedia)
 *
 * Used by: camera-access module
 */
export function mockMediaDevices() {
  ensureMediaStream();
  const mockStream = new MediaStream();

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

  const srcObjectKey = Symbol('mockSrcObject');

  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    configurable: true,
    get() {
      return (this as Record<symbol, unknown>)[srcObjectKey] ?? null;
    },
    set(value: MediaStream | null) {
      if (value !== null && !(value instanceof MediaStream)) {
        throw new TypeError('HTMLMediaElement.srcObject expects a MediaStream or null.');
      }
      (this as Record<symbol, unknown>)[srcObjectKey] = value;
    },
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
    (global as Record<string, unknown>).ImageData = class ImageData {
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
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => {
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

    // Mock response for concert data files so tests exercise real fixtures
    if (urlString.includes('concerts.json') || urlString.includes('data.json')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => Promise.resolve(cloneFixture(concertsFixture)),
        text: () => Promise.resolve(JSON.stringify(concertsFixture)),
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
 * Mock Web Audio API (AudioContext)
 *
 * Used by: secret-settings retro sounds hook
 */
export function mockAudioContext() {
  class TestGainNode {
    public readonly gain = {
      value: 1,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    };

    connect = vi.fn();
    disconnect = vi.fn();
  }

  class TestOscillatorNode {
    public type: OscillatorType = 'sine';
    public readonly frequency = {
      value: 0,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    };

    connect = vi.fn();
    disconnect = vi.fn();
    start = vi.fn();
    stop = vi.fn();
  }

  class TestAudioContext {
    public readonly destination = {};
    public currentTime = 0;

    createGain() {
      return new TestGainNode();
    }

    createOscillator() {
      return new TestOscillatorNode();
    }

    resume = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
  }

  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    writable: true,
    value: TestAudioContext,
  });

  Object.defineProperty(globalThis, 'webkitAudioContext', {
    configurable: true,
    writable: true,
    value: TestAudioContext,
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
  mockAudioContext();
  mockFetch();
  mockRequestAnimationFrame();
}
