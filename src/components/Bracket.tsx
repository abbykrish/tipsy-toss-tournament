import { useState } from "react";
import { roundName } from "../../shared/tournament";
import type { Match, Team } from "../../shared/types";
import { teamName } from "./PrelimMatch";
import { ScoreEditor } from "./ScoreEditor";

interface Props {
  matches: Match[];
  teams: Map<number, Team>;
  /** Admin: press a team to send them through (or press the winner again to undo). */
  onPick?: (match: Match, teamId: number | null) => void;
  onScore?: (match: Match, scoreA: number, scoreB: number) => Promise<boolean>;
  busy?: boolean;
}

export function Bracket({ matches, teams, onPick, onScore, busy }: Props) {
  const totalRounds = matches.reduce((max, m) => Math.max(max, m.round), 0);
  const rounds = Array.from({ length: totalRounds }, (_, i) =>
    matches.filter((m) => m.round === i + 1).sort((a, b) => a.position - b.position),
  );
  const final = rounds[totalRounds - 1]?.[0];
  const champion = final?.winner != null ? teams.get(final.winner) : undefined;

  return (
    <div className="bracket-scroll">
      <div className="bracket">
        {rounds.map((games, i) => {
          const pairs: Match[][] = [];
          for (let p = 0; p < games.length; p += 2) pairs.push(games.slice(p, p + 2));
          return (
            <div className="bracket-round" key={i}>
              <h4 className="bracket-round-title">
                {roundName(i + 1, totalRounds)}
                <span>to {games[0]?.target}</span>
              </h4>
              <div className="bracket-round-body">
                {pairs.map((pair) => (
                  <div key={pair[0].id} className={`bracket-pair ${pair.length === 2 ? "is-pair" : "is-single"}`}>
                    {pair.map((m) => (
                      <div className="bracket-slot" key={m.id}>
                        <BracketMatch match={m} teams={teams} onPick={onPick} onScore={onScore} busy={busy} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div className="bracket-round champion-round">
          <h4 className="bracket-round-title">Champion</h4>
          <div className="bracket-round-body">
            <div className="bracket-slot">
              <div className={`champion ${champion ? "is-crowned" : ""}`}>
                <Trophy />
                <div className="champion-name">{champion?.name ?? "TBD"}</div>
                {champion && <div className="champion-players">{champion.players.map((p) => p.name).join(" & ")}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BracketMatch({ match, teams, onPick, onScore, busy }: Omit<Props, "matches"> & { match: Match }) {
  const [editing, setEditing] = useState(false);
  const admin = Boolean(onPick);
  const ready = match.teamA !== null && match.teamB !== null && !match.isBye;

  if (editing && onScore) {
    return (
      <div className="bm is-editing">
        <ScoreEditor
          match={match}
          nameA={teamName(teams, match.teamA)}
          nameB={teamName(teams, match.teamB)}
          busy={busy}
          onCancel={() => setEditing(false)}
          onSave={async (a, b) => {
            const saved = await onScore(match, a, b);
            if (saved) setEditing(false);
            return saved;
          }}
        />
      </div>
    );
  }

  const rows = [
    { id: match.teamA, seed: match.seedA, score: match.scoreA },
    { id: match.teamB, seed: match.seedB, score: match.scoreB },
  ];

  return (
    <div className={`bm ${match.isBye ? "is-bye" : ""} ${match.winner !== null ? "is-done" : ""}`}>
      {rows.map((row, i) => {
        const state =
          row.id === null ? "tbd" : match.winner === null ? "" : match.winner === row.id ? "won" : "lost";
        const label = row.id === null ? (match.isBye ? "Bye" : "TBD") : teamName(teams, row.id);
        const content = (
          <>
            <span className="bm-seed">{row.seed ?? ""}</span>
            <span className="bm-name">{label}</span>
            {row.score !== null && <span className="bm-score">{row.score}</span>}
          </>
        );
        if (admin && ready && row.id !== null) {
          return (
            <button
              key={i}
              type="button"
              className={`bm-team ${state} is-pickable`}
              disabled={busy}
              title={match.winner === row.id ? "Undo" : `Send ${label} through`}
              onClick={() => onPick!(match, match.winner === row.id ? null : row.id)}
            >
              {content}
            </button>
          );
        }
        return (
          <div key={i} className={`bm-team ${state}`}>
            {content}
          </div>
        );
      })}
      {onScore && ready && (
        <button type="button" className="bm-edit" onClick={() => setEditing(true)} disabled={busy}>
          {match.scoreA !== null ? "edit score" : "+ score"}
        </button>
      )}
    </div>
  );
}

function Trophy() {
  return (
    <svg viewBox="0 0 64 64" className="trophy" aria-hidden>
      <path d="M18 8h28v14a14 14 0 0 1-28 0z" fill="#ffcf3f" stroke="#1f2a22" strokeWidth="3" strokeLinejoin="round" />
      <path d="M18 13H9a9 9 0 0 0 10 12M46 13h9a9 9 0 0 1-10 12" fill="none" stroke="#1f2a22" strokeWidth="3" strokeLinecap="round" />
      <path d="M28 36h8v10h-8z" fill="#ffcf3f" stroke="#1f2a22" strokeWidth="3" strokeLinejoin="round" />
      <rect x="20" y="46" width="24" height="9" rx="2" fill="#ff5a36" stroke="#1f2a22" strokeWidth="3" />
    </svg>
  );
}
