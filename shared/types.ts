export type Stage = "prelim" | "bracket";

export interface Match {
  id: number;
  stage: Stage;
  round: number;
  position: number;
  teamA: number | null;
  teamB: number | null;
  seedA: number | null;
  seedB: number | null;
  scoreA: number | null;
  scoreB: number | null;
  winner: number | null;
  isBye: boolean;
  /** Points needed to win this game. */
  target: number;
}

export interface Player {
  id: number;
  name: string;
  /** Only collected from older signups; only present in admin responses. */
  phone?: string;
}

export interface Team {
  id: number;
  name: string;
  seed: number | null;
  players: Player[];
}

export interface Standing {
  teamId: number;
  /** Games actually played (byes not included). */
  played: number;
  /** Includes byes. */
  wins: number;
  losses: number;
  byes: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface TournamentState {
  teams: Team[];
  freeAgentCount: number;
  /** Only present in admin responses. */
  freeAgents?: Player[];
  matches: Match[];
  standings: Standing[];
}

export interface SignupPlayer {
  name: string;
}

export interface SignupRequest {
  kind: "team" | "solo";
  teamName?: string;
  players: SignupPlayer[];
  /** Honeypot – real people leave this empty. */
  website?: string;
}
