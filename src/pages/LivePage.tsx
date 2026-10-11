import { api } from "../api";
import { Bracket } from "../components/Bracket";
import { PrelimMatch } from "../components/PrelimMatch";
import { Standings } from "../components/Standings";
import { useTournament } from "../useTournament";
import { useTeamMap } from "./useTeamMap";

export function LivePage() {
  const { state, error } = useTournament(api.state, 15_000);
  const teams = useTeamMap(state);

  if (!state) return <div className="page-loading">{error ? error.message : "Loading…"}</div>;

  const prelims = state.matches.filter((m) => m.stage === "prelim");
  const bracket = state.matches.filter((m) => m.stage === "bracket");
  const rounds = [...new Set(prelims.map((m) => m.round))].sort((a, b) => b - a);

  return (
    <div className="live">
      <div className="page-head">
        <h1>Game day</h1>
        <p className="muted">
          Prelims, standings and the bracket. Updates on its own – no need to refresh.
          <span className="live-dot" aria-hidden />
        </p>
      </div>

      {!prelims.length && !bracket.length && (
        <div className="card empty-state">
          <h2>Matchups drop on game day</h2>
          <p>Round 1 gets drawn once everyone's checked in. Check back at 3!</p>
        </div>
      )}

      {bracket.length > 0 && (
        <section>
          <h2>Bracket</h2>
          <Bracket matches={bracket} teams={teams} />
        </section>
      )}

      {prelims.length > 0 && (
        <div className="live-grid">
          <section>
            {rounds.map((round) => (
              <div key={round} className="round-block">
                <h2>Prelim round {round}</h2>
                <div className="prelim-grid">
                  {prelims
                    .filter((m) => m.round === round)
                    .map((m) => (
                      <PrelimMatch key={m.id} match={m} teams={teams} />
                    ))}
                </div>
              </div>
            ))}
          </section>
          <section>
            <h2>Standings</h2>
            <Standings standings={state.standings} teams={teams} />
          </section>
        </div>
      )}
    </div>
  );
}
