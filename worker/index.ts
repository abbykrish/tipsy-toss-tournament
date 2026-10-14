import { Hono } from "hono";
import {
  BracketError,
  PRELIM_ROUNDS,
  GAME_TARGET,
  applyBracketResult,
  draftBracket,
  draftPrelimRound,
  isComplete,
  shuffle,
  winnerFromScores,
} from "../shared/tournament";
import type { SignupRequest } from "../shared/types";
import { type AppEnv, logIn, logOut, requireAdmin } from "./auth";
import {
  ApiError,
  assertTeamEditable,
  insertMatch,
  loadMatch,
  loadMatches,
  loadState,
  loadTeamIds,
  type PlayerRow,
  updateMatch,
} from "./db";
import {
  availableTeamName,
  cleanName,
  cleanOptionalPhone,
  cleanTeamName,
  createTeamStatements,
  defaultTeamName,
  isTeamSizeViolation,
  isUniqueViolation,
  register,
} from "./entrants";

const app = new Hono<AppEnv>().basePath("/api");

app.onError((err, c) => {
  if (err instanceof ApiError) return c.json({ error: err.message }, err.status);
  if (err instanceof BracketError) return c.json({ error: err.message }, 400);
  if (err instanceof SyntaxError) return c.json({ error: "Bad request" }, 400);
  console.error(err);
  return c.json({ error: "Something went wrong" }, 500);
});

async function rateLimit(limiter: RateLimit, c: { req: { header: (name: string) => string | undefined } }) {
  const { success } = await limiter.limit({ key: c.req.header("cf-connecting-ip") ?? "unknown" });
  if (!success) throw new ApiError(429, "Whoa, slow down – try again in a minute");
}

function idParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Bad id");
  return id;
}

function score(raw: unknown): number {
  const n = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 99) throw new ApiError(400, "Scores must be whole numbers");
  return n;
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

app.get("/state", async (c) => {
  c.header("Cache-Control", "no-store");
  return c.json(await loadState(c.env.DB, false));
});

app.post("/signup", async (c) => {
  await rateLimit(c.env.SIGNUP_LIMITER, c);
  const body = await c.req.json<SignupRequest>();
  // Bots fill in every field; pretend it worked.
  if (body?.website) return c.json({ message: "You're in!" });
  return c.json(await register(c.env.DB, body));
});

app.post("/session", async (c) => {
  await rateLimit(c.env.LOGIN_LIMITER, c);
  const { password } = await c.req.json<{ password?: string }>();
  await logIn(c, password);
  return c.json({ ok: true });
});

app.delete("/session", (c) => {
  logOut(c);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

const admin = new Hono<AppEnv>();
admin.use(requireAdmin);

admin.get("/state", async (c) => {
  c.header("Cache-Control", "no-store");
  return c.json(await loadState(c.env.DB, true));
});

// --- Entrants --------------------------------------------------------------

admin.post("/entrants", async (c) => c.json(await register(c.env.DB, await c.req.json<SignupRequest>())));

admin.patch("/players/:id", async (c) => {
  const id = idParam(c.req.param("id"));
  const body = await c.req.json<{ name?: string; phone?: string }>();
  const name = cleanName(body.name);
  const phone = cleanOptionalPhone(body.phone);
  const res = await c.env.DB.prepare("UPDATE players SET name = ?, phone = ? WHERE id = ?").bind(name, phone, id).run();
  if (!res.meta.changes) throw new ApiError(404, "Player not found");
  return c.json({ ok: true });
});

admin.delete("/players/:id", async (c) => {
  const db = c.env.DB;
  const id = idParam(c.req.param("id"));
  const player = await db.prepare("SELECT team_id FROM players WHERE id = ?").bind(id).first<{ team_id: number | null }>();
  if (!player) throw new ApiError(404, "Player not found");
  if (player.team_id === null) {
    await db.prepare("DELETE FROM players WHERE id = ?").bind(id).run();
  } else {
    // A team of one isn't a team: their partner goes back into the free agent pool.
    await assertTeamEditable(db, player.team_id);
    await db.batch([
      db.prepare("DELETE FROM players WHERE id = ?").bind(id),
      db.prepare("UPDATE players SET team_id = NULL WHERE team_id = ?").bind(player.team_id),
      db.prepare("DELETE FROM teams WHERE id = ?").bind(player.team_id),
    ]);
  }
  return c.json({ ok: true });
});

admin.post("/teams", async (c) => {
  const db = c.env.DB;
  const body = await c.req.json<{ playerIds?: number[]; name?: string }>();
  const ids = body.playerIds ?? [];
  if (ids.length !== 2 || ids[0] === ids[1]) throw new ApiError(400, "Pick exactly two free agents");
  const { results } = await db
    .prepare("SELECT id, name, phone, team_id FROM players WHERE id IN (?, ?)")
    .bind(ids[0], ids[1])
    .all<PlayerRow>();
  if (results.length !== 2) throw new ApiError(404, "Player not found");
  if (results.some((p) => p.team_id !== null)) throw new ApiError(409, "One of them is already on a team");

  const requested = cleanTeamName(body.name);
  const name = requested ?? (await availableTeamName(db, defaultTeamName(results[0].name, results[1].name)));
  try {
    await db.batch(createTeamStatements(db, name, results));
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, `There's already a team called "${name}"`);
    if (isTeamSizeViolation(err)) throw new ApiError(409, "One of them just got paired up – refresh and try again");
    throw err;
  }
  return c.json({ ok: true });
});

admin.post("/teams/auto-pair", async (c) => {
  const db = c.env.DB;
  const { results } = await db
    .prepare("SELECT id, name, phone, team_id FROM players WHERE team_id IS NULL")
    .all<PlayerRow>();
  const pool = shuffle(results);
  let made = 0;
  for (let i = 0; i + 1 < pool.length; i += 2) {
    const name = await availableTeamName(db, defaultTeamName(pool[i].name, pool[i + 1].name));
    try {
      await db.batch(createTeamStatements(db, name, [pool[i], pool[i + 1]]));
      made++;
    } catch (err) {
      // Someone got paired (or a name got taken) mid-shuffle; skip this pair.
      if (!isTeamSizeViolation(err) && !isUniqueViolation(err)) throw err;
    }
  }
  return c.json({ made, leftover: pool.length % 2 === 1 ? pool[pool.length - 1].name : null });
});

admin.patch("/teams/:id", async (c) => {
  const id = idParam(c.req.param("id"));
  const name = cleanTeamName((await c.req.json<{ name?: string }>()).name);
  if (!name) throw new ApiError(400, "Team name is required");
  try {
    const res = await c.env.DB.prepare("UPDATE teams SET name = ? WHERE id = ?").bind(name, id).run();
    if (!res.meta.changes) throw new ApiError(404, "Team not found");
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, `There's already a team called "${name}"`);
    throw err;
  }
  return c.json({ ok: true });
});

admin.post("/teams/:id/split", async (c) => {
  const db = c.env.DB;
  const id = idParam(c.req.param("id"));
  await assertTeamEditable(db, id);
  await db.batch([
    db.prepare("UPDATE players SET team_id = NULL WHERE team_id = ?").bind(id),
    db.prepare("DELETE FROM teams WHERE id = ?").bind(id),
  ]);
  return c.json({ ok: true });
});

admin.delete("/teams/:id", async (c) => {
  const db = c.env.DB;
  const id = idParam(c.req.param("id"));
  await assertTeamEditable(db, id);
  await db.batch([
    db.prepare("DELETE FROM players WHERE team_id = ?").bind(id),
    db.prepare("DELETE FROM teams WHERE id = ?").bind(id),
  ]);
  return c.json({ ok: true });
});

// --- Prelims ---------------------------------------------------------------

admin.post("/prelims/next-round", async (c) => {
  const db = c.env.DB;
  const { round: expected } = await c.req.json<{ round?: number }>();
  const [teamIds, prelims, bracket] = await Promise.all([
    loadTeamIds(db),
    loadMatches(db, "prelim"),
    loadMatches(db, "bracket"),
  ]);
  if (bracket.length) throw new ApiError(409, "The bracket has already been made");
  if (teamIds.length < 2) throw new ApiError(409, "Need at least two teams");
  const unfinished = prelims.find((m) => !isComplete(m));
  if (unfinished) throw new ApiError(409, `Enter all of round ${unfinished.round}'s scores first`);

  const draft = draftPrelimRound(teamIds, prelims);
  // Guards against a stale tab drawing round 2 when it meant round 1.
  if (expected !== draft.round) throw new ApiError(409, `Round ${draft.round - 1} is already drawn – refresh`);
  if (draft.round > PRELIM_ROUNDS) throw new ApiError(409, `There are only ${PRELIM_ROUNDS} prelim rounds`);

  const base = { stage: "prelim", round: draft.round, seedA: null, seedB: null, scoreA: null, scoreB: null, winner: null, target: GAME_TARGET } as const;
  const statements = draft.pairs.map(([teamA, teamB], position) =>
    insertMatch(db, { ...base, position, teamA, teamB, isBye: false }),
  );
  if (draft.bye !== null) {
    statements.push(insertMatch(db, { ...base, position: draft.pairs.length, teamA: draft.bye, teamB: null, isBye: true }));
  }
  await db.batch(statements);
  return c.json({ round: draft.round });
});

admin.delete("/prelims/rounds/:round", async (c) => {
  const db = c.env.DB;
  const round = idParam(c.req.param("round"));
  const [prelims, bracket] = await Promise.all([loadMatches(db, "prelim"), loadMatches(db, "bracket")]);
  if (bracket.length) throw new ApiError(409, "The bracket has already been made");
  const latest = prelims.reduce((max, m) => Math.max(max, m.round), 0);
  if (round !== latest) throw new ApiError(409, "You can only delete the most recent round");
  await db.prepare("DELETE FROM matches WHERE stage = 'prelim' AND round = ?").bind(round).run();
  return c.json({ ok: true });
});

// --- Scores ----------------------------------------------------------------

admin.put("/matches/:id/score", async (c) => {
  const db = c.env.DB;
  const match = await loadMatch(db, idParam(c.req.param("id")));
  const body = await c.req.json<{ scoreA?: unknown; scoreB?: unknown }>();
  const scoreA = score(body.scoreA);
  const scoreB = score(body.scoreB);
  if (match.isBye || match.teamA === null || match.teamB === null) throw new ApiError(400, "This match doesn't have two teams yet");
  const winner = winnerFromScores(match, scoreA, scoreB);
  if (winner === null) throw new ApiError(400, "Scores can't be tied – somebody has to win");

  if (match.stage === "prelim") {
    await db.prepare("UPDATE matches SET score_a = ?, score_b = ?, winner_id = ? WHERE id = ?").bind(scoreA, scoreB, winner, match.id).run();
  } else {
    const changed = applyBracketResult(await loadMatches(db, "bracket"), match.id, winner, { scoreA, scoreB });
    if (changed.length) await db.batch(changed.map((m) => updateMatch(db, m)));
  }
  return c.json({ ok: true });
});

admin.delete("/matches/:id/score", async (c) => {
  const db = c.env.DB;
  const match = await loadMatch(db, idParam(c.req.param("id")));
  if (match.stage === "prelim") {
    await db.prepare("UPDATE matches SET score_a = NULL, score_b = NULL, winner_id = NULL WHERE id = ?").bind(match.id).run();
  } else {
    const changed = applyBracketResult(await loadMatches(db, "bracket"), match.id, null);
    if (changed.length) await db.batch(changed.map((m) => updateMatch(db, m)));
  }
  return c.json({ ok: true });
});

// --- Bracket ---------------------------------------------------------------

admin.post("/bracket", async (c) => {
  const db = c.env.DB;
  const { teamIds } = await c.req.json<{ teamIds?: number[] }>();
  if (!Array.isArray(teamIds) || teamIds.length < 2) throw new ApiError(400, "Pick at least two teams");
  if (new Set(teamIds).size !== teamIds.length) throw new ApiError(400, "A team is listed twice");
  const known = new Set(await loadTeamIds(db));
  if (teamIds.some((id) => !known.has(id))) throw new ApiError(400, "Unknown team");
  if ((await loadMatches(db, "bracket")).length) {
    throw new ApiError(409, "There's already a bracket – use Redo seeding first");
  }

  await db.batch([
    ...teamIds.map((id, i) => db.prepare("UPDATE teams SET seed = ? WHERE id = ?").bind(i + 1, id)),
    ...draftBracket(teamIds).map((m) => insertMatch(db, m)),
  ]);
  return c.json({ ok: true });
});

admin.delete("/bracket", async (c) => {
  const db = c.env.DB;
  await db.batch([db.prepare("DELETE FROM matches WHERE stage = 'bracket'"), db.prepare("UPDATE teams SET seed = NULL")]);
  return c.json({ ok: true });
});

admin.post("/bracket/matches/:id/winner", async (c) => {
  const db = c.env.DB;
  const id = idParam(c.req.param("id"));
  const { teamId } = await c.req.json<{ teamId?: number | null }>();
  const changed = applyBracketResult(await loadMatches(db, "bracket"), id, teamId ?? null);
  if (changed.length) await db.batch(changed.map((m) => updateMatch(db, m)));
  return c.json({ ok: true });
});

app.route("/admin", admin);

app.all("*", (c) => c.json({ error: "Not found" }, 404));

export default app;
