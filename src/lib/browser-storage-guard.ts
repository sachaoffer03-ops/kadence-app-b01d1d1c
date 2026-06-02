const createMemoryStorage = (): Storage => {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => data.delete(key),
    setItem: (key: string, value: string) => data.set(key, String(value)),
  };
};

function ensureSafeStorage(name: "localStorage" | "sessionStorage") {
  if (typeof window === "undefined") return;
  try {
    const storage = window[name];
    const testKey = `kadence_storage_test_${Date.now()}`;
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
  } catch {
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        value: createMemoryStorage(),
      });
    } catch {
      // Si le navigateur refuse le patch, les autres garde-fous try/catch prennent le relais.
    }
  }
}

ensureSafeStorage("localStorage");
ensureSafeStorage("sessionStorage");