// A tiny in-memory cache so screens can show what we fetched last time
// IMMEDIATELY, then refresh quietly in the background. Without it, every
// screen starts empty ("0 ml", a spinner) and then jumps when data arrives —
// which feels buggy.
//
// It lives only in memory: cleared when the app restarts or the user signs
// out, and never written to the phone's storage.

const store = new Map<string, unknown>();

export function getCached<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): T {
  store.set(key, value);
  return value;
}

export function clearCache() {
  store.clear();
}
