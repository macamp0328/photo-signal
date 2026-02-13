/**
 * Test Setup File
 *
 * This file runs before all tests and sets up:
 * - Testing library extensions (@testing-library/jest-dom)
 * - Global mocks for native browser APIs
 * - Test utilities and helpers
 * - Console warning/error suppression for expected messages
 */

import '@testing-library/jest-dom';
import { setupGlobalMocks } from './mocks';
import { vi } from 'vitest';

const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';

if (typeof navigator === 'undefined') {
  (globalThis as unknown as { navigator: Navigator }).navigator = {
    userAgent: 'node',
  } as Navigator;
}

// Initialize all global mocks (skip DOM-heavy mocks when not available)
setupGlobalMocks({ enableDom: hasDom });

// Suppress expected console warnings/errors during tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// List of expected error/warning patterns that should be suppressed
const EXPECTED_MESSAGES = [
  // Camera access errors are expected when testing permission denial
  'Camera access error:',
  // Video srcObject errors are expected in test environment due to mock limitations
  'Failed to set video srcObject in test environment:',
  // localStorage errors are expected when testing error handling
  'Failed to load feature flags from localStorage:',
  'Failed to load custom settings from localStorage:',
  // React act() warnings - these are known issues with React 19 and testing-library
  'inside a test was not wrapped in act',
];

/**
 * Creates a console filter function that suppresses expected messages.
 *
 * @param originalFn - The original console function (error or warn)
 * @param expectedMessages - Array of message patterns to suppress
 * @returns A function that suppresses expected messages and calls originalFn for unexpected ones
 */
function createConsoleFilter(
  originalFn: (...args: unknown[]) => void,
  expectedMessages: string[]
): (...args: unknown[]) => void {
  return (...args: unknown[]) => {
    const message = args.join(' ');
    const isExpected = expectedMessages.some((pattern) => message.includes(pattern));
    if (!isExpected) {
      originalFn(...args);
    }
  };
}

// Mock console.error to suppress expected messages
console.error = vi.fn(createConsoleFilter(originalConsoleError, EXPECTED_MESSAGES));

// Mock console.warn to suppress expected messages
console.warn = vi.fn(createConsoleFilter(originalConsoleWarn, EXPECTED_MESSAGES));
