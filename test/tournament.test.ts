import { describe, expect, it } from "vitest";
import {
  applyBracketResult,
  bracketSize,
  computeStandings,
  draftBracket,
  draftPrelimRound,
  normalizePhone,
  pairWithoutRematches,
  roundName,
  seedOrder,
} from "../shared/tournament";
import type { Match } from "../shared/types";

let nextId = 1;
function prelim(round: number, teamA: number, teamB: number | null, scoreA?: number, scoreB?: number): Match {
  const isBye = teamB === null;
  const scored = scoreA !== undefined && scoreB !== undefined;
  return {
    id: nextId++,
    stage: "prelim",
    round,
    position: 0,
    teamA,
    teamB,
    seedA: null,
    seedB: null,
    scoreA: scored ? scoreA : null,
    scoreB: scored ? scoreB : null,
    winner: scored ? (scoreA > scoreB ? teamA : teamB) : null,
    isBye,
    target: 11,
  };
}

function withIds(drafts: ReturnType<typeof draftBracket>): Match[] {
  return drafts.map((d, i) => ({ ...d, id: 100 + i }));
}

function find(matches: Match[], round: number, position: number): Match {
  return matches.find((m) => m.round === round && m.position === position)!;
}

function merge(matches: Match[], changed: Match[]): Match[] {
  const byId = new Map(changed.map((m) => [m.id, m]));
  return matches.map((m) => byId.get(m.id) ?? m);
}

describe("normalizePhone", () => {
  it("dedupes common US formats to the same digits", () => {
    const forms = ["(415) 555-1234", "415.555.1234", "+1 415 555 1234", "14155551234", " 415-555-1234 "];
    for (const f of forms) expect(normalizePhone(f)).toBe("4155551234");
  });

  it("accepts international numbers written with +", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
  });

  it("rejects junk", () => {
    expect(normalizePhone("555-1234")).toBeNull();
    expect(normalizePhone("hello")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("computeStandings", () => {
  it("ranks by wins, then point differential, then points scored", () => {
    const matches = [
      prelim(1, 1, 2, 11, 3), // 1: +8
      prelim(1, 3, 4, 11, 9), // 3: +2
      prelim(2, 1, 3, 11, 10), // 1: 2-0
      prelim(2, 2, 4, 11, 5), // 2: 1-1, -8+6 = -2 ; 4: 0-2
    ];
    const order = computeStandings([1, 2, 3, 4], matches).map((s) => s.teamId);
    expect(order).toEqual([1, 3, 2, 4]);
  });

  it("ignores unscored games", () => {
    const standings = computeStandings([1, 2], [prelim(1, 1, 2)]);
    expect(standings.every((s) => s.played === 0 && s.wins === 0)).toBe(true);
  });

  it("counts a bye as a win worth no points", () => {
    const matches = [
      prelim(1, 1, 2, 11, 2), // 1: 1-0, +9
      prelim(1, 3, null), // 3: bye
      prelim(2, 3, 2, 11, 9), // 3: 2-0 (incl. bye), +2
      prelim(2, 1, null), // 1: 2-0 (incl. bye), +9
    ];
    const standings = computeStandings([1, 2, 3], matches);
    expect(standings.map((s) => s.teamId)).toEqual([1, 3, 2]);
    const three = standings.find((s) => s.teamId === 3)!;
    expect(three).toMatchObject({ wins: 2, losses: 0, byes: 1, played: 1, pointsFor: 11 });
  });

  it("never ranks a bye team above an unbeaten team that played both games", () => {
    const matches = [
      prelim(1, 1, 2, 11, 3), // 1: +8
      prelim(1, 3, 4, 11, 3), // 3: +8
      prelim(1, 5, null), // 5: bye
      prelim(2, 1, 3, 11, 9), // 1: 2-0
      prelim(2, 5, 2, 11, 0), // 5: 1-0 + bye, +11
      prelim(2, 4, null),
    ];
    // 5 is 2-0 with +11 and 1 is 2-0 with +10 – both unbeaten, so diff decides.
    const order = computeStandings([1, 2, 3, 4, 5], matches).map((s) => s.teamId);
    expect(order.slice(0, 2)).toEqual([5, 1]);
  });
});

describe("draftPrelimRound", () => {
  const seq = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it("round 1 pairs every team exactly once", () => {
    const teams = [1, 2, 3, 4, 5, 6, 7, 8];
    const draft = draftPrelimRound(teams, [], seq([0.3, 0.7, 0.1, 0.9]));
    expect(draft.round).toBe(1);
    expect(draft.bye).toBeNull();
    expect(draft.pairs.flat().sort()).toEqual(teams);
  });

  it("gives a bye with an odd number of teams", () => {
    const draft = draftPrelimRound([1, 2, 3, 4, 5], []);
    expect(draft.bye).not.toBeNull();
    expect(draft.pairs).toHaveLength(2);
    expect(new Set([...draft.pairs.flat(), draft.bye]).size).toBe(5);
  });

  it("round 2 is Swiss-style and avoids rematches", () => {
    const r1 = [prelim(1, 1, 2, 11, 5), prelim(1, 3, 4, 11, 7), prelim(1, 5, 6, 11, 9), prelim(1, 7, 8, 11, 10)];
    const draft = draftPrelimRound([1, 2, 3, 4, 5, 6, 7, 8], r1);
    expect(draft.round).toBe(2);
    // Winners (1,3,5,7) play winners, losers play losers.
    const winners = new Set([1, 3, 5, 7]);
    for (const [a, b] of draft.pairs) expect(winners.has(a)).toBe(winners.has(b));
    const r1Pairs = new Set(r1.map((m) => [m.teamA, m.teamB].sort().join("-")));
    for (const [a, b] of draft.pairs) expect(r1Pairs.has([a, b].sort().join("-"))).toBe(false);
  });

  it("doesn't give the same team two byes", () => {
    const r1 = [prelim(1, 1, 2, 11, 5), prelim(1, 3, 4, 11, 7), prelim(1, 5, null)];
    // Team 5 sat out round 1 and has 0 games, so it's last in the standings,
    // but it shouldn't sit out again.
    const draft = draftPrelimRound([1, 2, 3, 4, 5], r1);
    expect(draft.bye).not.toBe(5);
    expect(draft.bye).not.toBeNull();
  });

  it("bumps partners down the list to dodge a rematch", () => {
    const played = new Set(["1-2", "3-4", "1-3"]);
    const hasPlayed = (a: number, b: number) => played.has([a, b].sort().join("-"));
    expect(pairWithoutRematches([1, 2, 3, 4], hasPlayed)).toEqual([
      [1, 4],
      [2, 3],
    ]);
  });

  it("falls back to adjacent pairs when a rematch is unavoidable", () => {
    expect(pairWithoutRematches([1, 2], () => true)).toEqual([[1, 2]]);
  });
});

describe("bracket", () => {
  it("sizes up to the next power of two", () => {
    expect(bracketSize(2)).toBe(2);
    expect(bracketSize(5)).toBe(8);
    expect(bracketSize(12)).toBe(16);
    expect(bracketSize(16)).toBe(16);
    expect(bracketSize(17)).toBe(32);
  });

  it("uses the standard seed order", () => {
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(seedOrder(16)).toEqual([1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11]);
  });

  it("gives byes to the top seeds and advances them", () => {
    const teams = Array.from({ length: 12 }, (_, i) => 1000 + i); // seed n = team 999+n
    const bracket = draftBracket(teams);
    expect(bracket.filter((m) => m.round === 1)).toHaveLength(8);
    expect(bracket.filter((m) => m.round === 4)).toHaveLength(1);

    const byes = bracket.filter((m) => m.isBye);
    expect(byes.map((m) => m.winner).sort()).toEqual([1000, 1001, 1002, 1003]); // seeds 1-4

    // Seed 1 is waiting in round 2 for the winner of 8 v 9.
    const r2 = bracket.find((m) => m.round === 2 && m.position === 0)!;
    expect(r2.teamA).toBe(1000);
    expect(r2.seedA).toBe(1);
    expect(r2.teamB).toBeNull();
    const r1 = bracket.find((m) => m.round === 1 && m.position === 1)!;
    expect([r1.seedA, r1.seedB]).toEqual([8, 9]);
  });

  it("plays the final to 21 and everything else to 11", () => {
    const bracket = draftBracket([1, 2, 3, 4, 5, 6]);
    expect(bracket.find((m) => m.round === 3)!.target).toBe(21);
    expect(bracket.filter((m) => m.round < 3).every((m) => m.target === 11)).toBe(true);
  });

  it("handles a full 16-team bracket with no byes", () => {
    const bracket = draftBracket(Array.from({ length: 16 }, (_, i) => i + 1));
    expect(bracket.some((m) => m.isBye)).toBe(false);
    expect(bracket).toHaveLength(15);
  });

  it("advances a pressed team into the next round", () => {
    let bracket = withIds(draftBracket([1, 2, 3, 4]));
    // Round 1: (1 v 4), (2 v 3)
    const m0 = find(bracket, 1, 0);
    bracket = merge(bracket, applyBracketResult(bracket, m0.id, 1));
    expect(find(bracket, 2, 0).teamA).toBe(1);
    expect(find(bracket, 2, 0).seedA).toBe(1);

    const m1 = find(bracket, 1, 1);
    bracket = merge(bracket, applyBracketResult(bracket, m1.id, 3, { scoreA: 7, scoreB: 11 }));
    const final = find(bracket, 2, 0);
    expect(final.teamB).toBe(3);
    expect(final.seedB).toBe(3);
    expect(find(bracket, 1, 1).scoreB).toBe(11);
  });

  it("changing an earlier result clears downstream results", () => {
    let bracket = withIds(draftBracket([1, 2, 3, 4]));
    bracket = merge(bracket, applyBracketResult(bracket, find(bracket, 1, 0).id, 1));
    bracket = merge(bracket, applyBracketResult(bracket, find(bracket, 1, 1).id, 2));
    bracket = merge(bracket, applyBracketResult(bracket, find(bracket, 2, 0).id, 1, { scoreA: 21, scoreB: 15 }));
    expect(find(bracket, 2, 0).winner).toBe(1);

    // Oops – 4 actually beat 1.
    const changed = applyBracketResult(bracket, find(bracket, 1, 0).id, 4);
    bracket = merge(bracket, changed);
    const final = find(bracket, 2, 0);
    expect(final.teamA).toBe(4);
    expect(final.teamB).toBe(2);
    expect(final.winner).toBeNull();
    expect(final.scoreA).toBeNull();
  });

  it("un-pressing a winner pulls them back out of the next round", () => {
    let bracket = withIds(draftBracket([1, 2, 3, 4]));
    bracket = merge(bracket, applyBracketResult(bracket, find(bracket, 1, 0).id, 1));
    bracket = merge(bracket, applyBracketResult(bracket, find(bracket, 1, 0).id, null));
    expect(find(bracket, 2, 0).teamA).toBeNull();
  });

  it("refuses to decide byes or half-filled matches", () => {
    const bracket = withIds(draftBracket([1, 2, 3]));
    const bye = bracket.find((m) => m.isBye)!;
    expect(() => applyBracketResult(bracket, bye.id, bye.winner)).toThrow();
    const waiting = find(bracket, 2, 0);
    expect(() => applyBracketResult(bracket, waiting.id, 1)).toThrow();
  });

  it("works for tiny brackets", () => {
    const two = draftBracket([7, 8]);
    expect(two).toHaveLength(1);
    expect(two[0]).toMatchObject({ teamA: 7, teamB: 8, target: 21, isBye: false });

    const three = withIds(draftBracket([1, 2, 3]));
    expect(three.filter((m) => m.isBye).map((m) => m.winner)).toEqual([1]);
    expect(find(three, 2, 0).teamA).toBe(1);
  });

  it("grows to a 32-team bracket past 16 teams, byes still on top", () => {
    const bracket = draftBracket(Array.from({ length: 17 }, (_, i) => i + 1));
    expect(bracket.filter((m) => m.round === 1)).toHaveLength(16);
    expect(bracket.filter((m) => m.isBye).map((m) => m.winner).sort((a, b) => a! - b!)).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 1),
    );
    const realGame = bracket.find((m) => m.round === 1 && !m.isBye)!;
    expect([realGame.seedA, realGame.seedB]).toEqual([16, 17]);
  });

  it("runs a whole bracket to a champion", () => {
    let bracket = withIds(draftBracket([1, 2, 3, 4, 5, 6]));
    for (let round = 1; round <= 3; round++) {
      for (const m of bracket.filter((m) => m.round === round && !m.isBye)) {
        const current = bracket.find((x) => x.id === m.id)!;
        bracket = merge(bracket, applyBracketResult(bracket, current.id, Math.min(current.teamA!, current.teamB!)));
      }
    }
    expect(find(bracket, 3, 0).winner).toBe(1);
  });

  it("names rounds from the end", () => {
    expect(roundName(4, 4)).toBe("Final");
    expect(roundName(3, 4)).toBe("Semifinals");
    expect(roundName(2, 4)).toBe("Quarterfinals");
    expect(roundName(1, 4)).toBe("Round of 16");
  });
});
