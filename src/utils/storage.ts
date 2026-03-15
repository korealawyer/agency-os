/**
 * localStorage-based data persistence utilities
 */

const STORAGE_PREFIX = "agency_os_";

export function saveData<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to save data to localStorage:", e);
  }
}

export function loadData<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const stored = localStorage.getItem(STORAGE_PREFIX + key);
    if (stored === null) return defaultValue;
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}

export function removeData(key: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_PREFIX + key);
}

export function clearAllData(): void {
  if (typeof window === "undefined") return;
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX));
  keys.forEach((k) => localStorage.removeItem(k));
}
