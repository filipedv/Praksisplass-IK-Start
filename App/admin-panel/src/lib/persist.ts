// Remember small UI choices (filters, sort order, period) between visits,
// in this browser only (localStorage). Never store personal data here.

import { useState } from 'react';

const PREFIX = 'ikstart-admin:';

export function usePersistentState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(PREFIX + key);
      return saved === null ? initial : (JSON.parse(saved) as T);
    } catch {
      return initial; // private mode / blocked storage: just don't remember
    }
  });

  function update(next: T) {
    setValue(next);
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(next));
    } catch {
      // ignore — remembering is a convenience only
    }
  }

  return [value, update];
}
