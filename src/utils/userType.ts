/**
 * User type persistence utility.
 *
 * Stores and retrieves the authenticated user type ("gallery" or "demo")
 * from localStorage. The value is set once at login by the access gate
 * and read by downstream code (e.g. audio preview duration).
 */

export type UserType = 'gallery' | 'demo';

const USER_TYPE_KEY = 'photo-signal-user-type';
const VALID_TYPES: ReadonlySet<string> = new Set<UserType>(['gallery', 'demo']);

/** Read the persisted user type, or null if none / invalid / unavailable. */
export function getUserType(): UserType | null {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return null;
  }

  try {
    const value = window.localStorage.getItem(USER_TYPE_KEY);
    if (value !== null && VALID_TYPES.has(value)) {
      return value as UserType;
    }
    return null;
  } catch {
    return null;
  }
}

/** Persist the user type to localStorage. */
export function setUserType(type: UserType): void {
  try {
    window.localStorage.setItem(USER_TYPE_KEY, type);
  } catch (error) {
    console.error('Failed to persist user type to localStorage:', error);
  }
}

/** Remove the persisted user type. */
export function clearUserType(): void {
  try {
    window.localStorage.removeItem(USER_TYPE_KEY);
  } catch {
    // Silently ignore — localStorage may be unavailable.
  }
}

/** Convenience: true when the active user is a demo user. */
export function isDemoUser(): boolean {
  return getUserType() === 'demo';
}
