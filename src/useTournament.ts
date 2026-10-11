import { useCallback, useEffect, useRef, useState } from "react";
import type { TournamentState } from "../shared/types";

/** Loads tournament state and optionally re-polls so phones on the lawn stay current. */
export function useTournament(load: () => Promise<TournamentState>, pollMs?: number) {
  const [state, setState] = useState<TournamentState | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const latest = useRef(0);

  const refresh = useCallback(async () => {
    // A slow poll can land after a newer refresh; only the newest request wins.
    const id = ++latest.current;
    try {
      const next = await load();
      if (id !== latest.current) return;
      setState(next);
      setError(null);
    } catch (err) {
      if (id === latest.current) setError(err as Error);
    }
  }, [load]);

  useEffect(() => {
    refresh();
    if (!pollMs) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, pollMs);
    return () => clearInterval(timer);
  }, [refresh, pollMs]);

  return { state, error, refresh };
}
