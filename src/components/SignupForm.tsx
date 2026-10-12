import { useState } from "react";
import { uniqueFunnyTeamName } from "../../shared/teamNames";
import type { SignupRequest } from "../../shared/types";

type Kind = SignupRequest["kind"];

interface Props {
  submit: (body: SignupRequest) => Promise<{ message: string }>;
  onDone?: () => void;
  /** Admin walk-up form: skip the marketing copy. */
  compact?: boolean;
  /** Existing team names, so the random name button doesn't suggest one that's taken. */
  takenNames?: string[];
}

const blank = { name: "", phone: "" };

export function SignupForm({ submit, onDone, compact, takenNames = [] }: Props) {
  const [kind, setKind] = useState<Kind>("team");
  const [teamName, setTeamName] = useState("");
  const [players, setPlayers] = useState([blank, blank]);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const setPlayer = (i: number, field: "name" | "phone", value: string) =>
    setPlayers((ps) => ps.map((p, j) => (j === i ? { ...p, [field]: value } : p)));

  const reset = () => {
    setTeamName("");
    setPlayers([blank, blank]);
    setSuccess(null);
    setError(null);
  };

  if (success && !compact) {
    return (
      <div className="signup-success">
        <div className="big-check" aria-hidden>
          ✓
        </div>
        <h3>{success}</h3>
        <p>Keep an eye on the Partiful for updates. Matchups go up on the Live page on game day.</p>
        <button className="btn" onClick={reset}>
          Sign up someone else
        </button>
      </div>
    );
  }

  const count = kind === "team" ? 2 : 1;

  return (
    <form
      className="signup-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const res = await submit({
            kind,
            teamName: kind === "team" ? teamName : undefined,
            players: players.slice(0, count),
            website,
          });
          if (compact) {
            setTeamName("");
            setPlayers([blank, blank]);
          }
          setSuccess(res.message);
          onDone?.();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={kind === "team"} className={kind === "team" ? "active" : ""} onClick={() => setKind("team")}>
          {compact ? "Team" : "We have a team"}
        </button>
        <button type="button" role="tab" aria-selected={kind === "solo"} className={kind === "solo" ? "active" : ""} onClick={() => setKind("solo")}>
          {compact ? "Solo" : "I need a partner"}
        </button>
      </div>

      {kind === "solo" && !compact && (
        <p className="form-hint">Sign up solo and you'll get matched with another free agent before the tournament.</p>
      )}

      {kind === "team" && (
        <div className={compact ? undefined : "name-row"}>
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Team name (optional)"
            aria-label="Team name (optional)"
            maxLength={40}
          />
          {!compact && (
            <button
              type="button"
              className="btn"
              title="Pick a random team name"
              aria-label="Pick a random team name"
              onClick={() => setTeamName(uniqueFunnyTeamName([...takenNames, teamName]))}
            >
              🎲<span className="dice-label">Random</span>
            </button>
          )}
        </div>
      )}

      {players.slice(0, count).map((p, i) => {
        const who = compact ? `Player ${i + 1}` : i === 0 ? "Your" : "Partner's";
        return (
          <div key={i} className="player-row">
            <input
              required
              value={p.name}
              onChange={(e) => setPlayer(i, "name", e.target.value)}
              placeholder={`${who} name`}
              aria-label={`${who} name`}
              autoComplete={i === 0 && !compact ? "name" : "off"}
              maxLength={60}
            />
            <input
              required
              type="tel"
              value={p.phone}
              onChange={(e) => setPlayer(i, "phone", e.target.value)}
              placeholder={`${who} phone`}
              aria-label={`${who} phone`}
              autoComplete={i === 0 && !compact ? "tel" : "off"}
            />
          </div>
        );
      })}

      <label className="honeypot" aria-hidden>
        Website
        <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </label>

      {error && <p className="form-error">{error}</p>}
      {success && compact && <p className="form-success">{success}</p>}

      <button className="btn btn-primary btn-submit" disabled={busy}>
        {busy ? "Signing up…" : compact ? "Add" : kind === "team" ? "Sign up our team" : "Sign me up"}
      </button>
    </form>
  );
}
