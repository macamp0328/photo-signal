/**
 * Feature Flag Context
 *
 * Provides global state for feature flags including test data mode.
 * Persists preferences in localStorage.
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
}

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

const STORAGE_KEY = 'photo-signal:feature-flags';

interface FeatureFlagProviderProps {
  children: ReactNode;
}

/**
 * Feature Flag Provider Component
 *
 * Wraps the app to provide feature flag state and controls.
 */
export function FeatureFlagProvider({ children }: FeatureFlagProviderProps) {
  const [isTestMode, setIsTestMode] = useState<boolean>(() => {
    // Load from localStorage on init
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const flags = JSON.parse(stored);
        return flags.isTestMode ?? false;
      }
    } catch (error) {
      console.error('Failed to load feature flags from localStorage:', error);
    }
    return false;
  });

  // Persist to localStorage whenever it changes
  useEffect(() => {
    try {
      const flags = { isTestMode };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
    } catch (error) {
      console.error('Failed to save feature flags to localStorage:', error);
    }
  }, [isTestMode]);

  return (
    <FeatureFlagContext.Provider value={{ isTestMode, setTestMode: setIsTestMode }}>
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
