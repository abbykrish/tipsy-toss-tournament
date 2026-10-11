import { useMemo } from "react";
import type { Team, TournamentState } from "../../shared/types";

export function useTeamMap(state: TournamentState | null): Map<number, Team> {
  return useMemo(() => new Map(state?.teams.map((t) => [t.id, t]) ?? []), [state]);
}
