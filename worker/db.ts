import { computeStandings } from "../shared/tournament";
import type { Match, Player, Stage, Team, TournamentState } from "../shared/types";

export class ApiError extends Error {
  constructor(
    public status: 400 | 401 | 404 | 409 | 429 | 500,
    message: string,
  ) {
    super(message);
  }
}

interface TeamRow {
  id: number;
  name: string;
  seed: number | null;
}

export interface PlayerRow {
  id: number;
  name: string;
  phone: string;
  team_id: number | null;
}

interface MatchRow {
  id: number;
  stage: Stage;
  round: number;
  position: number;
  team_a_id: number | null;
  team_b_id: number | null;
  seed_a: number | null;
  seed_b: number | null;
  score_a: number | null;
  score_b: number | null;
  winner_id: number | null;
  is_bye: number;
  target: number;
}

function toMatch(r: MatchRow): Match {
  return {
    id: r.id,
    stage: r.stage,
    round: r.round,
    position: r.position,
    teamA: r.team_a_id,
    teamB: r.team_b_id,
    seedA: r.seed_a,
    seedB: r.seed_b,
    scoreA: r.score_a,
    scoreB: r.score_b,
    winner: r.winner_id,
    isBye: r.is_bye === 1,
    target: r.target,
  };
}

const MATCH_ORDER = "ORDER BY stage DESC, round, position";

export async function loadMatches(db: D1Database, stage: Stage): Promise<Match[]> {
  const { results } = await db.prepare(`SELECT * FROM matches WHERE stage = ? ${MATCH_ORDER}`).bind(stage).all<MatchRow>();
  return results.map(toMatch);
}

export async function loadMatch(db: D1Database, id: number): Promise<Match> {
  const row = await db.prepare("SELECT * FROM matches WHERE id = ?").bind(id).first<MatchRow>();
  if (!row) throw new ApiError(404, "Match not found");
  return toMatch(row);
}

export async function loadTeamIds(db: D1Database): Promise<number[]> {
  const { results } = await db.prepare("SELECT id FROM teams ORDER BY id").all<{ id: number }>();
  return results.map((r) => r.id);
}

export async function loadState(db: D1Database, includePrivate: boolean): Promise<TournamentState> {
  const [teamRows, playerRows, matchRows] = await db.batch([
    db.prepare("SELECT id, name, seed FROM teams ORDER BY id"),
    db.prepare("SELECT id, name, phone, team_id FROM players ORDER BY id"),
    db.prepare(`SELECT * FROM matches ${MATCH_ORDER}`),
  ]);

  const toPlayer = (p: PlayerRow): Player =>
    includePrivate ? { id: p.id, name: p.name, phone: p.phone } : { id: p.id, name: p.name };

  const players = playerRows.results as unknown as PlayerRow[];
  const teams: Team[] = (teamRows.results as unknown as TeamRow[]).map((t) => ({
    id: t.id,
    name: t.name,
    seed: t.seed,
    players: players.filter((p) => p.team_id === t.id).map(toPlayer),
  }));
  const freeAgents = players.filter((p) => p.team_id === null);
  const matches = (matchRows.results as unknown as MatchRow[]).map(toMatch);

  return {
    teams,
    freeAgentCount: freeAgents.length,
    ...(includePrivate ? { freeAgents: freeAgents.map(toPlayer) } : {}),
    matches,
    standings: computeStandings(
      teams.map((t) => t.id),
      matches.filter((m) => m.stage === "prelim"),
    ),
  };
}

export function insertMatch(db: D1Database, m: Omit<Match, "id">): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO matches (stage, round, position, team_a_id, team_b_id, seed_a, seed_b, score_a, score_b, winner_id, is_bye, target)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      m.stage,
      m.round,
      m.position,
      m.teamA,
      m.teamB,
      m.seedA,
      m.seedB,
      m.scoreA,
      m.scoreB,
      m.winner,
      m.isBye ? 1 : 0,
      m.target,
    );
}

export function updateMatch(db: D1Database, m: Match): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE matches SET team_a_id = ?, team_b_id = ?, seed_a = ?, seed_b = ?, score_a = ?, score_b = ?, winner_id = ?
       WHERE id = ?`,
    )
    .bind(m.teamA, m.teamB, m.seedA, m.seedB, m.scoreA, m.scoreB, m.winner, m.id);
}

export async function teamHasMatches(db: D1Database, teamId: number): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM matches WHERE team_a_id = ?1 OR team_b_id = ?1 LIMIT 1")
    .bind(teamId)
    .first();
  return row !== null;
}

export async function assertTeamEditable(db: D1Database, teamId: number): Promise<void> {
  if (await teamHasMatches(db, teamId)) {
    throw new ApiError(409, "That team is already on the schedule. Delete the prelim rounds/bracket first.");
  }
}
