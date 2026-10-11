import { useState } from "react";
import type { Match, Team } from "../../shared/types";
import { ScoreEditor } from "./ScoreEditor";

interface Props {
  match: Match;
  teams: Map<number, Team>;
  /** Admin-only score entry. */
  onSave?: (scoreA: number, scoreB: number) => Promise<boolean>;
  onClear?: () => void;
  busy?: boolean;
}

export function teamName(teams: Map<number, Team>, id: number | null): string {
  if (id === null) return "TBD";
  return teams.get(id)?.name ?? "Removed team";
}

export function PrelimMatch({ match, teams, onSave, onClear, busy }: Props) {
  const [editing, setEditing] = useState(false);
  const nameA = teamName(teams, match.teamA);
  const nameB = teamName(teams, match.teamB);
  const done = match.winner !== null;

  if (match.isBye) {
    return (
      <div className="prelim-match is-bye">
        <div className="prelim-label">Bye</div>
        <div className="prelim-team">
          <span className="prelim-name">{nameA}</span>
        </div>
        <p className="prelim-note">Sits this round out – grab a drink.</p>
      </div>
    );
  }

  return (
    <div className={`prelim-match ${done ? "is-done" : ""}`}>
      <div className="prelim-label">
        Game {match.position + 1} <span className="to">to {match.target}</span>
      </div>
      {editing && onSave ? (
        <ScoreEditor
          match={match}
          nameA={nameA}
          nameB={nameB}
          busy={busy}
          onCancel={() => setEditing(false)}
          onSave={async (a, b) => {
            const saved = await onSave(a, b);
            if (saved) setEditing(false);
            return saved;
          }}
        />
      ) : (
        <>
          {[
            [match.teamA, nameA, match.scoreA],
            [match.teamB, nameB, match.scoreB],
          ].map(([id, name, score]) => (
            <div
              key={String(id)}
              className={`prelim-team ${done && match.winner === id ? "won" : ""} ${done && match.winner !== id ? "lost" : ""}`}
            >
              <span className="prelim-name">{name}</span>
              <span className="prelim-score">{score ?? "–"}</span>
            </div>
          ))}
          {onSave && (
            <div className="prelim-actions">
              <button className="btn btn-sm" onClick={() => setEditing(true)} disabled={busy}>
                {done ? "Edit score" : "Enter score"}
              </button>
              {done && onClear && (
                <button className="btn btn-ghost btn-sm" onClick={onClear} disabled={busy}>
                  Clear
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
