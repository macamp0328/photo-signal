/**
 * Feature Flag Context
 *
 * Provides global state for feature flags including test data mode and grayscale mode.
 * Now syncs with the secret-settings module's feature flag system for consistency.
 *
 * This context bridges the old API (isTestMode, isGrayscaleMode) with the new
 * secret-settings module's feature flag system.
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface FeatureFlagContextType {
  /**
   * Whether test data mode is enabled
   */
  isTestMode: boolean;

  /**
   * Toggle test data mode on/off
   */
  setTestMode: (enabled: boolean) => void;

  /**
   * Whether grayscale conversion is enabled for photo recognition
   */
  isGrayscaleMode: boolean;

  /**
   * Toggle grayscale conversion on/off
   */
  setGrayscaleMode: (enabled: boolean) => void;
}

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

// Use the same storage key as secret-settings module for consistency
const STORAGE_KEY = 'photo-signal-feature-flags';

interface FeatureFlagProviderProps {
  children: ReactNode;
}

/**
 * Feature Flag Provider Component
 *
 * Wraps the app to provide feature flag state and controls.
 * Syncs with secret-settings module's feature flag system.
 */
export function FeatureFlagProvider({ children }: FeatureFlagProviderProps) {
  // Load flags from localStorage (shared with secret-settings module)
  const loadStoredFlags = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const flags = JSON.parse(stored);
        // Extract test-mode and grayscale-mode from the flags array
        const testMode = flags.find((f: { id: string }) => f.id === 'test-mode')?.enabled ?? false;
        const grayscaleMode =
          flags.find((f: { id: string }) => f.id === 'grayscale-mode')?.enabled ?? false;
        return { testMode, grayscaleMode };
      }
    } catch (error) {
      console.error('Failed to load feature flags from localStorage:', error);
    }
    return { testMode: false, grayscaleMode: false };
  };

  const storedFlags = loadStoredFlags();

  const [isTestMode, setIsTestMode] = useState<boolean>(storedFlags.testMode);
  const [isGrayscaleMode, setIsGrayscaleMode] = useState<boolean>(storedFlags.grayscaleMode);

  // Persist to localStorage whenever flags change (update the flags array)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      let flags = stored ? JSON.parse(stored) : [];

      // Update test-mode and grayscale-mode flags in the array
      flags = flags.map((flag: { id: string; enabled: boolean }) => {
        if (flag.id === 'test-mode') {
          return { ...flag, enabled: isTestMode };
        }
        if (flag.id === 'grayscale-mode') {
          return { ...flag, enabled: isGrayscaleMode };
        }
        return flag;
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
    } catch (error) {
      console.error('Failed to save feature flags to localStorage:', error);
    }
  }, [isTestMode, isGrayscaleMode]);

  // Listen for storage events to sync across tabs/components
  useEffect(() => {
    const handleStorageChange = () => {
      const { testMode, grayscaleMode } = loadStoredFlags();
      setIsTestMode(testMode);
      setIsGrayscaleMode(grayscaleMode);
    };

    window.addEventListener('storage', handleStorageChange);

    // Also set up a custom event listener for same-tab updates
    const handleCustomStorageChange = () => {
      const { testMode, grayscaleMode } = loadStoredFlags();
      setIsTestMode(testMode);
      setIsGrayscaleMode(grayscaleMode);
    };

    window.addEventListener('feature-flags-updated', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('feature-flags-updated', handleCustomStorageChange);
    };
  }, []);

  return (
    <FeatureFlagContext.Provider
      value={{
        isTestMode,
        setTestMode: setIsTestMode,
        isGrayscaleMode,
        setGrayscaleMode: setIsGrayscaleMode,
      }}
    >
      {children}
    </FeatureFlagContext.Provider>
  );
}

/**
 * Hook to access feature flags
 *
 * @returns Feature flag state and controls
 * @throws If used outside FeatureFlagProvider
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useFeatureFlags(): FeatureFlagContextType {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    throw new Error('useFeatureFlags must be used within FeatureFlagProvider');
  }
  return context;
}
