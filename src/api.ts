import type { SignupRequest, TournamentState } from "../shared/types";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  state: () => request<TournamentState>("GET", "/state"),
  signup: (body: SignupRequest) => request<{ message: string }>("POST", "/signup", body),
  login: (password: string) => request("POST", "/session", { password }),
  logout: () => request("DELETE", "/session"),

  admin: {
    state: () => request<TournamentState>("GET", "/admin/state"),
    addEntrant: (body: SignupRequest) => request<{ message: string }>("POST", "/admin/entrants", body),
    updatePlayer: (id: number, name: string, phone: string) => request("PATCH", `/admin/players/${id}`, { name, phone }),
    deletePlayer: (id: number) => request("DELETE", `/admin/players/${id}`),
    pair: (playerIds: number[], name?: string) => request("POST", "/admin/teams", { playerIds, name }),
    autoPair: () => request<{ made: number; leftover: string | null }>("POST", "/admin/teams/auto-pair"),
    renameTeam: (id: number, name: string) => request("PATCH", `/admin/teams/${id}`, { name }),
    splitTeam: (id: number) => request("POST", `/admin/teams/${id}/split`),
    deleteTeam: (id: number) => request("DELETE", `/admin/teams/${id}`),
    nextRound: (round: number) => request<{ round: number }>("POST", "/admin/prelims/next-round", { round }),
    deleteRound: (round: number) => request("DELETE", `/admin/prelims/rounds/${round}`),
    setScore: (matchId: number, scoreA: number, scoreB: number) =>
      request("PUT", `/admin/matches/${matchId}/score`, { scoreA, scoreB }),
    clearScore: (matchId: number) => request("DELETE", `/admin/matches/${matchId}/score`),
    createBracket: (teamIds: number[]) => request("POST", "/admin/bracket", { teamIds }),
    deleteBracket: () => request("DELETE", "/admin/bracket"),
    advance: (matchId: number, teamId: number | null) =>
      request("POST", `/admin/bracket/matches/${matchId}/winner`, { teamId }),
  },
};
