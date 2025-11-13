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

// Initialize all global mocks
setupGlobalMocks();

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
  'An update to',
  'inside a test was not wrapped in act',
];

// Mock console.error to suppress expected messages
console.error = vi.fn((...args: unknown[]) => {
  const message = args.join(' ');
  const isExpected = EXPECTED_MESSAGES.some((pattern) => message.includes(pattern));

  // Only log unexpected errors
  if (!isExpected) {
    originalConsoleError(...args);
  }
});

// Mock console.warn to suppress expected messages
console.warn = vi.fn((...args: unknown[]) => {
  const message = args.join(' ');
  const isExpected = EXPECTED_MESSAGES.some((pattern) => message.includes(pattern));

  // Only log unexpected warnings
  if (!isExpected) {
    originalConsoleWarn(...args);
  }
});
