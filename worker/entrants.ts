import { normalizePhone } from "../shared/tournament";
import type { SignupRequest } from "../shared/types";
import { ApiError } from "./db";

const MAX_NAME = 60;
const MAX_TEAM_NAME = 40;

export function cleanName(raw: unknown, label = "Name"): string {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!name) throw new ApiError(400, `${label} is required`);
  if (name.length > MAX_NAME) throw new ApiError(400, `${label} is too long`);
  return name;
}

/** Phone numbers are optional now; blank means none. */
export function cleanOptionalPhone(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const phone = normalizePhone(raw);
  if (!phone) throw new ApiError(400, "That phone number doesn't look right");
  return phone;
}

export function cleanTeamName(raw: unknown): string | null {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  if (!name) return null;
  if (name.length > MAX_TEAM_NAME) throw new ApiError(400, "Team name is too long");
  return name;
}

const firstName = (name: string) => name.split(" ")[0];

export function defaultTeamName(a: string, b: string): string {
  return `${firstName(a)} & ${firstName(b)}`;
}

async function teamNameTaken(db: D1Database, name: string): Promise<boolean> {
  return (await db.prepare("SELECT 1 FROM teams WHERE name = ? COLLATE NOCASE").bind(name).first()) !== null;
}

/** Picks a free team name, adding " (2)", " (3)"… if the base is taken. */
export async function availableTeamName(db: D1Database, base: string): Promise<string> {
  let name = base;
  for (let n = 2; await teamNameTaken(db, name); n++) name = `${base} (${n})`;
  return name;
}

/**
 * Statements that create a team and attach players to it in one atomic batch.
 * Team names are unique (case-insensitive), so players can find their team by
 * name without needing the new id first. Existing players are only moved if
 * they're still free agents; the last statement fails the whole batch (by
 * inserting a NULL team name) if the team didn't end up with exactly two.
 */
export function createTeamStatements(
  db: D1Database,
  name: string,
  members: ({ id: number } | { name: string })[],
): D1PreparedStatement[] {
  const teamId = "(SELECT id FROM teams WHERE name = ?1 COLLATE NOCASE)";
  return [
    db.prepare("INSERT INTO teams (name) VALUES (?)").bind(name),
    ...members.map((m) =>
      "id" in m
        ? db.prepare(`UPDATE players SET team_id = ${teamId} WHERE id = ?2 AND team_id IS NULL`).bind(name, m.id)
        : db.prepare(`INSERT INTO players (name, team_id) VALUES (?2, ${teamId})`).bind(name, m.name),
    ),
    db
      .prepare(`INSERT INTO teams (name) SELECT NULL WHERE (SELECT COUNT(*) FROM players WHERE team_id = ${teamId}) != 2`)
      .bind(name),
  ];
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
}

export function isTeamSizeViolation(err: unknown): boolean {
  return err instanceof Error && /NOT NULL constraint failed: teams\.name/i.test(err.message);
}

/**
 * Signs up a team of two or a solo free agent. There's no dedupe: if someone
 * signs up twice, the host removes the extra entry from the admin page.
 */
export async function register(db: D1Database, body: SignupRequest): Promise<{ message: string }> {
  const kind = body?.kind;
  if (kind !== "team" && kind !== "solo") throw new ApiError(400, "Pick team or solo");
  const raw = Array.isArray(body.players) ? body.players : [];
  if (raw.length !== (kind === "team" ? 2 : 1)) throw new ApiError(400, "Wrong number of players");

  const people = raw.map((p, i) => ({
    name: cleanName(p?.name, kind === "solo" ? "Your name" : `Player ${i + 1}'s name`),
  }));

  if (kind === "solo") {
    await db.prepare("INSERT INTO players (name) VALUES (?)").bind(people[0].name).run();
    return { message: `You're in, ${firstName(people[0].name)}! We'll pair you up with a partner before the tournament.` };
  }

  const requested = cleanTeamName(body.teamName);
  if (requested && (await teamNameTaken(db, requested))) {
    throw new ApiError(409, `There's already a team called "${requested}" – pick another name`);
  }
  const teamName = requested ?? (await availableTeamName(db, defaultTeamName(people[0].name, people[1].name)));

  try {
    await db.batch(createTeamStatements(db, teamName, people));
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, "Someone just grabbed that team name – try again");
    throw err;
  }
  return { message: `${teamName} is in! See you on the lawn.` };
}
