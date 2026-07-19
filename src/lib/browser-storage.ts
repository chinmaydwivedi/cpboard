type StorageKind = "local" | "session";

const volatileOverrides: Record<StorageKind, Map<string, string | null>> = {
  local: new Map(),
  session: new Map(),
};

function getStorage(kind: StorageKind): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    // Storage access can throw in private/restricted browser contexts.
    return null;
  }
}

function createSafeStorage(kind: StorageKind) {
  return {
    getItem(key: string): string | null {
      if (typeof window === "undefined") return null;

      try {
        if (volatileOverrides[kind].has(key)) {
          return volatileOverrides[kind].get(key) ?? null;
        }
        const storage = getStorage(kind);
        if (!storage) return null;
        return storage.getItem(key);
      } catch {
        return volatileOverrides[kind].get(key) ?? null;
      }
    },
    setItem(key: string, value: string): void {
      if (typeof window === "undefined") return;

      try {
        const storage = getStorage(kind);
        if (!storage) {
          volatileOverrides[kind].set(key, value);
          return;
        }
        storage.setItem(key, value);
        volatileOverrides[kind].delete(key);
      } catch {
        // Keep preferences functional for this tab when persistence is blocked
        // or full. A reload may reset this deliberately non-persistent fallback.
        volatileOverrides[kind].set(key, value);
      }
    },
    removeItem(key: string): void {
      if (typeof window === "undefined") return;

      try {
        const storage = getStorage(kind);
        if (!storage) {
          volatileOverrides[kind].set(key, null);
          return;
        }
        storage.removeItem(key);
        volatileOverrides[kind].delete(key);
      } catch {
        // A tombstone prevents a stale persisted value from resurfacing in
        // this tab if persistent removal was rejected.
        volatileOverrides[kind].set(key, null);
      }
    },
  } as const;
}

export const safeLocalStorage = createSafeStorage("local");
export const safeSessionStorage = createSafeStorage("session");
