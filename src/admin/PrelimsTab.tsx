import { PRELIM_ROUNDS, isComplete } from "../../shared/tournament";
import { api } from "../api";
import { PrelimMatch } from "../components/PrelimMatch";
import { Standings } from "../components/Standings";
import type { AdminTabProps } from "./AdminPage";

export function PrelimsTab({ state, teams, busy, run }: AdminTabProps) {
  const prelims = state.matches.filter((m) => m.stage === "prelim");
  const hasBracket = state.matches.some((m) => m.stage === "bracket");
  const latest = prelims.reduce((max, m) => Math.max(max, m.round), 0);
  const rounds = Array.from({ length: latest }, (_, i) => latest - i);
  const remaining = prelims.filter((m) => !isComplete(m)).length;
  const next = latest + 1;
  const freeAgents = state.freeAgents?.length ?? 0;

  let blocker: string | null = null;
  if (hasBracket) blocker = "The bracket's already been made.";
  else if (latest >= PRELIM_ROUNDS) blocker = `All ${PRELIM_ROUNDS} prelim rounds are drawn. Once scores are in, head to Seeding & bracket.`;
  else if (remaining) blocker = `Enter the last ${remaining} round ${latest} ${remaining === 1 ? "score" : "scores"} to unlock round ${next}.`;
  else if (state.teams.length < 2) blocker = "Need at least two teams.";

  return (
    <div className="admin-prelims">
      <section className="card next-round">
        <div>
          <h2>{latest === 0 ? "Draw round 1" : latest < PRELIM_ROUNDS ? `Round ${next}` : "Prelims"}</h2>
          <p className="muted">
            {PRELIM_ROUNDS} prelim rounds, games to 11. Round 1 is a random draw. Round 2 pairs teams with similar records
            and avoids rematches. With an odd number of teams, one team sits out each round.
          </p>
          {blocker && <p className="callout">{blocker}</p>}
          {hasBracket && (
            <p className="muted">You can still fix a prelim score, but the bracket's seeding won't change.</p>
          )}
          {!blocker && next === 1 && freeAgents > 0 && (
            <p className="callout">
              {freeAgents} free {freeAgents === 1 ? "agent isn't" : "agents aren't"} on a team yet and won't be in the draw.
            </p>
          )}
        </div>
        {!blocker && (
          <button
            className="btn btn-primary btn-lg"
            disabled={busy}
            onClick={() => {
              const msg =
                next === 1
                  ? `Draw round 1 for ${state.teams.length} teams? Make sure everyone's checked in – remove no-shows first.`
                  : `Draw round ${next}?`;
              if (window.confirm(msg)) run(() => api.admin.nextRound(next), `Round ${next} is set`);
            }}
          >
            Generate round {next} matchups
          </button>
        )}
      </section>

      <div className="live-grid">
        <div>
          {rounds.map((round) => {
            const games = prelims.filter((m) => m.round === round);
            const scored = games.filter((m) => !m.isBye && m.winner !== null).length;
            const total = games.filter((m) => !m.isBye).length;
            return (
              <section key={round} className="round-block">
                <div className="section-head">
                  <h2>Round {round}</h2>
                  <span className="muted">
                    {scored}/{total} scores in
                  </span>
                  {round === latest && !hasBracket && (
                    <button
                      className="btn btn-ghost btn-sm push-right"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete round ${round} and all of its scores?`)) {
                          run(() => api.admin.deleteRound(round), `Round ${round} deleted`);
                        }
                      }}
                    >
                      Delete round
                    </button>
                  )}
                </div>
                <div className="prelim-grid">
                  {games.map((m) => (
                    <PrelimMatch
                      key={m.id}
                      match={m}
                      teams={teams}
                      busy={busy}
                      onSave={(a, b) => run(() => api.admin.setScore(m.id, a, b))}
                      onClear={() => run(() => api.admin.clearScore(m.id))}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <section>
          <h2>Standings</h2>
          <Standings standings={state.standings} teams={teams} />
        </section>
      </div>
    </div>
  );
}
