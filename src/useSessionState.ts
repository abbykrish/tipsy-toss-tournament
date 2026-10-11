import { useEffect, useState } from "react";

/** useState that survives tab switches and reloads (but not closing the browser tab). */
export function useSessionState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const saved = sessionStorage.getItem(key);
    return saved === null ? initial : (JSON.parse(saved) as T);
  });
  useEffect(() => sessionStorage.setItem(key, JSON.stringify(value)), [key, value]);
  return [value, setValue] as const;
}
