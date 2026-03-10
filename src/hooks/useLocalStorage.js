import { useState, useCallback } from "react";

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
