import { useState, useCallback } from "react";

/**
 * useState backed by localStorage.
 * Value is serialised via JSON. Falls back to initialValue on parse errors.
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value) => {
      try {
        const toStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(toStore);
        localStorage.setItem(key, JSON.stringify(toStore));
      } catch (err) {
        console.error(`useLocalStorage: failed to write key "${key}"`, err);
      }
    },
    [key, storedValue],
  );

  return [storedValue, setValue];
}
