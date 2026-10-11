import type { Match, Standing } from "./types";

/** Games to 11 this year – everything except the final. */
export const GAME_TARGET = 11;
export const FINAL_TARGET = 21;
export const PRELIM_ROUNDS = 2;

// ---------------------------------------------------------------------------
// Phones
// ---------------------------------------------------------------------------

/**
 * Normalizes a phone number to digits so "(415) 555-1234", "415.555.1234" and
 * "+1 415 555 1234" all dedupe to the same entrant. Returns null if it doesn't
 * look like a real number.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length === 10) return digits;
  // International numbers: must be written with a leading "+".
  if (trimmed.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function formatPhone(phone: string): string {
  if (/^\d{10}$/.test(phone)) return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
  return phone;
}

// ---------------------------------------------------------------------------
// Prelims
// ---------------------------------------------------------------------------

export function isComplete(m: Match): boolean {
  return m.isBye || m.winner !== null;
}

export function winnerFromScores(m: Pick<Match, "teamA" | "teamB">, scoreA: number, scoreB: number): number | null {
  if (scoreA === scoreB) return null;
  return scoreA > scoreB ? m.teamA : m.teamB;
}

/**
 * Prelim standings, best first: wins, then point differential, then points
 * scored. A bye counts as a win (worth no points), as is usual for Swiss rounds,
 * so sitting out doesn't drop a team below everyone who played.
 */
export function computeStandings(teamIds: number[], prelims: Match[]): Standing[] {
  const table = new Map<number, Standing>();
  for (const id of teamIds) {
    table.set(id, { teamId: id, played: 0, wins: 0, losses: 0, byes: 0, pointsFor: 0, pointsAgainst: 0 });
  }

  for (const m of prelims) {
    if (m.isBye) {
      const s = m.teamA !== null ? table.get(m.teamA) : undefined;
      if (s) {
        s.byes++;
        s.wins++;
      }
      continue;
    }
    if (m.winner === null || m.teamA === null || m.teamB === null) continue;
    const a = table.get(m.teamA);
    const b = table.get(m.teamB);
    const sa = m.scoreA ?? 0;
    const sb = m.scoreB ?? 0;
    for (const [s, pf, pa, won] of [
      [a, sa, sb, m.winner === m.teamA],
      [b, sb, sa, m.winner === m.teamB],
    ] as const) {
      if (!s) continue;
      s.played++;
      s.pointsFor += pf;
      s.pointsAgainst += pa;
      if (won) s.wins++;
      else s.losses++;
    }
  }

  return [...table.values()].sort(compareStandings);
}

export function compareStandings(a: Standing, b: Standing): number {
  return (
    b.wins - a.wins ||
    b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst) ||
    b.pointsFor - a.pointsFor ||
    a.teamId - b.teamId
  );
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface RoundDraft {
  round: number;
  pairs: [number, number][];
  bye: number | null;
}

/**
 * Builds the next prelim round. Round 1 is a random draw; later rounds are
 * Swiss-style (teams with similar records play each other) and avoid rematches
 * whenever possible. With an odd number of teams, the lowest-ranked team that
 * hasn't sat out yet gets the bye.
 */
export function draftPrelimRound(
  teamIds: number[],
  prelims: Match[],
  random: () => number = Math.random,
): RoundDraft {
  const round = prelims.reduce((max, m) => Math.max(max, m.round), 0) + 1;
  const order =
    round === 1 ? shuffle(teamIds, random) : computeStandings(teamIds, prelims).map((s) => s.teamId);

  let bye: number | null = null;
  if (order.length % 2 === 1) {
    const byeCount = new Map<number, number>();
    for (const m of prelims) if (m.isBye && m.teamA !== null) byeCount.set(m.teamA, (byeCount.get(m.teamA) ?? 0) + 1);
    const fewest = Math.min(...order.map((id) => byeCount.get(id) ?? 0));
    for (let i = order.length - 1; i >= 0; i--) {
      if ((byeCount.get(order[i]) ?? 0) === fewest) {
        bye = order[i];
        break;
      }
    }
    order.splice(order.indexOf(bye!), 1);
  }

  const played = new Set<string>();
  for (const m of prelims) {
    if (m.teamA !== null && m.teamB !== null) {
      played.add(`${m.teamA}:${m.teamB}`);
      played.add(`${m.teamB}:${m.teamA}`);
    }
  }

  return { round, pairs: pairWithoutRematches(order, (a, b) => played.has(`${a}:${b}`)), bye };
}

/**
 * Pairs teams in order (1v2, 3v4, …), bumping partners down the list when a
 * pairing would be a rematch. Falls back to straight adjacent pairs if every
 * arrangement has a rematch.
 */
export function pairWithoutRematches(
  order: number[],
  hasPlayed: (a: number, b: number) => boolean,
): [number, number][] {
  let budget = 50_000;
  const search = (remaining: number[]): [number, number][] | null => {
    if (remaining.length === 0) return [];
    if (--budget < 0) return null;
    const [first, ...rest] = remaining;
    for (let i = 0; i < rest.length; i++) {
      if (hasPlayed(first, rest[i])) continue;
      const tail = search([...rest.slice(0, i), ...rest.slice(i + 1)]);
      if (tail) return [[first, rest[i]], ...tail];
    }
    return null;
  };

  const found = search(order);
  if (found) return found;
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
  return pairs;
}

// ---------------------------------------------------------------------------
// Bracket
// ---------------------------------------------------------------------------

export function bracketSize(teamCount: number): number {
  let size = 2;
  while (size < teamCount) size *= 2;
  return size;
}

/**
 * Standard bracket slot order, e.g. for 8: [1,8,4,5,2,7,3,6]. Adjacent slots
 * play each other, and the top two seeds can only meet in the final.
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const sum = order.length * 2 + 1;
    order = order.flatMap((s) => [s, sum - s]);
  }
  return order;
}

export type BracketDraft = Omit<Match, "id">;

/**
 * Lays out a single-elimination bracket for teams given in seed order. The
 * bracket is padded to the next power of two; missing seeds become byes, which
 * always land on the top seeds, and bye winners are pre-advanced to round 2.
 */
export function draftBracket(seededTeamIds: number[]): BracketDraft[] {
  if (seededTeamIds.length < 2) throw new Error("Need at least 2 teams for a bracket");
  const size = bracketSize(seededTeamIds.length);
  const rounds = Math.log2(size);
  const slots = seedOrder(size);
  const teamForSeed = (seed: number) => seededTeamIds[seed - 1] ?? null;

  const matches: BracketDraft[] = [];
  for (let round = 1; round <= rounds; round++) {
    const count = size / 2 ** round;
    for (let position = 0; position < count; position++) {
      matches.push({
        stage: "bracket",
        round,
        position,
        teamA: null,
        teamB: null,
        seedA: null,
        seedB: null,
        scoreA: null,
        scoreB: null,
        winner: null,
        isBye: false,
        target: round === rounds ? FINAL_TARGET : GAME_TARGET,
      });
    }
  }

  const at = (round: number, position: number) =>
    matches.find((m) => m.round === round && m.position === position)!;

  for (let position = 0; position < size / 2; position++) {
    const m = at(1, position);
    const seedA = slots[position * 2];
    const seedB = slots[position * 2 + 1];
    const teamA = teamForSeed(seedA);
    const teamB = teamForSeed(seedB);
    m.teamA = teamA;
    m.seedA = teamA === null ? null : seedA;
    m.teamB = teamB;
    m.seedB = teamB === null ? null : seedB;
    if (teamA === null || teamB === null) {
      m.isBye = true;
      m.winner = teamA ?? teamB;
      if (rounds > 1) {
        const next = at(2, position >> 1);
        const seed = teamA !== null ? seedA : seedB;
        if (position % 2 === 0) {
          next.teamA = m.winner;
          next.seedA = seed;
        } else {
          next.teamB = m.winner;
          next.seedB = seed;
        }
      }
    }
  }
  return matches;
}

export class BracketError extends Error {}

/**
 * Records a bracket result (pressing a team, or entering a score) and advances
 * the winner. Changing an earlier result clears anything downstream that
 * depended on it. Returns only the matches that changed.
 */
export function applyBracketResult(
  bracket: Match[],
  matchId: number,
  winner: number | null,
  scores: { scoreA: number; scoreB: number } | null = null,
): Match[] {
  const matches = bracket.map((m) => ({ ...m }));
  const byKey = new Map(matches.map((m) => [`${m.round}:${m.position}`, m]));
  const changed = new Map<number, Match>();
  const target = matches.find((m) => m.id === matchId);

  if (!target) throw new BracketError("Match not found");
  if (target.isBye) throw new BracketError("That's a bye – nothing to decide");
  if (winner !== null) {
    if (target.teamA === null || target.teamB === null) throw new BracketError("Waiting on the other team");
    if (winner !== target.teamA && winner !== target.teamB) throw new BracketError("That team isn't in this match");
  }

  const setWinner = (m: Match, w: number | null, scoreA: number | null, scoreB: number | null) => {
    if (m.winner === w && m.scoreA === scoreA && m.scoreB === scoreB) return;
    m.winner = w;
    m.scoreA = scoreA;
    m.scoreB = scoreB;
    changed.set(m.id, m);
    const next = byKey.get(`${m.round + 1}:${m.position >> 1}`);
    if (!next) return;
    const seed = w === null ? null : w === m.teamA ? m.seedA : m.seedB;
    setSlot(next, m.position % 2 === 0 ? "A" : "B", w, seed);
  };

  const setSlot = (m: Match, slot: "A" | "B", team: number | null, seed: number | null) => {
    if (m[`team${slot}`] === team) return;
    m[`team${slot}`] = team;
    m[`seed${slot}`] = seed;
    changed.set(m.id, m);
    // The opponent changed, so any result recorded here no longer stands.
    if (m.winner !== null || m.scoreA !== null || m.scoreB !== null) setWinner(m, null, null, null);
  };

  setWinner(target, winner, scores?.scoreA ?? null, scores?.scoreB ?? null);
  return [...changed.values()];
}

export function roundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  return `Round of ${2 ** (fromEnd + 1)}`;
}
