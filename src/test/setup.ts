/**
 * Test Setup File
 *
 * This file runs before all tests and sets up:
 * - Testing library extensions (@testing-library/jest-dom)
 * - Global mocks for native browser APIs
 * - Test utilities and helpers
 */

import '@testing-library/jest-dom';
import { setupGlobalMocks } from './mocks';

// Initialize all global mocks
setupGlobalMocks();
