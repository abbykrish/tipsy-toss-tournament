import { bracketSize, isComplete } from "../../shared/tournament";
import { api } from "../api";
import { Bracket } from "../components/Bracket";
import { useSessionState } from "../useSessionState";
import type { AdminTabProps } from "./AdminPage";

export function BracketTab(props: AdminTabProps) {
  const { state, teams, busy, run } = props;
  const bracket = state.matches.filter((m) => m.stage === "bracket");

  if (!bracket.length) return <SeedingBuilder {...props} />;

  return (
    <div className="admin-bracket">
      <section className="card">
        <div className="section-head">
          <h2>Bracket</h2>
          <button
            className="btn btn-ghost btn-sm push-right"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Scrap this bracket and go back to seeding? All bracket results will be lost.")) {
                run(() => api.admin.deleteBracket(), "Bracket cleared");
              }
            }}
          >
            Redo seeding
          </button>
        </div>
        <p className="muted">
          Tap a team to send them through to the next round. Tap the winner again to undo. Adding a score is optional.
        </p>
      </section>
      <Bracket
        matches={bracket}
        teams={teams}
        busy={busy}
        onPick={(m, teamId) => run(() => api.admin.advance(m.id, teamId))}
        onScore={(m, a, b) => run(() => api.admin.setScore(m.id, a, b))}
      />
    </div>
  );
}

/** Keeps the admin's manual order, dropping removed teams and appending new ones. */
function reconcile(order: number[], latest: number[]): number[] {
  const present = new Set(latest);
  const kept = order.filter((id) => present.has(id));
  return [...kept, ...latest.filter((id) => !kept.includes(id))];
}

function SeedingBuilder({ state, teams, busy, run }: AdminTabProps) {
  const calculated = state.standings.map((s) => s.teamId);
  const [custom, setCustom] = useSessionState<number[] | null>("seeding-order", null);
  const [excludedIds, setExcludedIds] = useSessionState<number[]>("seeding-excluded", []);
  const excluded = new Set(excludedIds);
  const order = custom ? reconcile(custom, calculated) : calculated;
  const seeded = order.filter((id) => !excluded.has(id));
  const standing = new Map(state.standings.map((s) => [s.teamId, s]));

  const size = seeded.length >= 2 ? bracketSize(seeded.length) : 0;
  const byes = size - seeded.length;
  const unscored = state.matches.filter((m) => m.stage === "prelim" && !isComplete(m)).length;
  const noPrelims = !state.matches.some((m) => m.stage === "prelim");

  const move = (id: number, delta: -1 | 1) => {
    const next = [...order];
    const i = next.indexOf(id);
    const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setCustom(next);
  };

  const seedOf = new Map(seeded.map((id, i) => [id, i + 1]));

  return (
    <div className="admin-seeding">
      <section className="card">
        <h2>Seeding</h2>
        <p className="muted">
          Calculated from prelim results: wins (a bye counts as one), then point differential, then points scored. Nudge
          teams up or down if you need to, or uncheck a team that's dropped out.
        </p>
        {noPrelims && <p className="callout">No prelim games yet – this is just signup order.</p>}
        {unscored > 0 && (
          <p className="callout">
            Heads up: {unscored} prelim {unscored === 1 ? "game is" : "games are"} still missing a score, so this
            seeding could change.
          </p>
        )}

        <div className="seeding-summary">
          {seeded.length < 2 ? (
            <span>Need at least 2 teams.</span>
          ) : byes === 0 ? (
            <span>
              <strong>{seeded.length} teams</strong> – a full bracket, no byes.
            </span>
          ) : (
            <span>
              <strong>{seeded.length} teams</strong> → bracket of {size}.{" "}
              {byes === 1 ? "The #1 seed gets" : `Seeds 1–${byes} get`} a first-round bye.
            </span>
          )}
        </div>

        <ol className="seed-list">
          {order.map((id, i) => {
            const s = standing.get(id);
            const seed = seedOf.get(id);
            const bye = seed !== undefined && seed <= byes;
            return (
              <li key={id} className={`${seed === undefined ? "is-out" : ""} ${bye ? "has-bye" : ""}`}>
                <span className="seed-num">{seed ?? "–"}</span>
                <span className="seed-team">
                  {teams.get(id)?.name}
                  {bye && <span className="tag">bye</span>}
                </span>
                {s && (
                  <span className="seed-record">
                    {s.wins}–{s.losses}, {s.pointsFor - s.pointsAgainst >= 0 ? "+" : ""}
                    {s.pointsFor - s.pointsAgainst}
                  </span>
                )}
                <span className="seed-controls">
                  <button className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => move(id, -1)}>
                    ↑
                  </button>
                  <button className="icon-btn" aria-label="Move down" disabled={i === order.length - 1} onClick={() => move(id, 1)}>
                    ↓
                  </button>
                  <label className="include-toggle" title="Include in bracket">
                    <input
                      type="checkbox"
                      checked={seed !== undefined}
                      onChange={() =>
                        setExcludedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
                      }
                    />
                  </label>
                </span>
              </li>
            );
          })}
        </ol>

        <div className="button-row">
          <button
            className="btn btn-primary btn-lg"
            disabled={busy || seeded.length < 2}
            onClick={() => {
              if (window.confirm(`Create the bracket with ${seeded.length} teams?`)) {
                run(() => api.admin.createBracket(seeded), "Bracket created");
              }
            }}
          >
            Create bracket
          </button>
          {custom && (
            <button className="btn btn-ghost" onClick={() => setCustom(null)}>
              Reset to calculated order
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
