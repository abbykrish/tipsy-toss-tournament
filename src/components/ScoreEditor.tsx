import { useState } from "react";
import type { Match } from "../../shared/types";

interface Props {
  match: Match;
  nameA: string;
  nameB: string;
  /** Resolve to false to keep the editor open (e.g. the save failed). */
  onSave: (scoreA: number, scoreB: number) => Promise<boolean | void>;
  onCancel?: () => void;
  busy?: boolean;
}

/** Two score boxes and a save button, sized for thumbs on a lawn. */
export function ScoreEditor({ match, nameA, nameB, onSave, onCancel, busy }: Props) {
  const [a, setA] = useState(match.scoreA?.toString() ?? "");
  const [b, setB] = useState(match.scoreB?.toString() ?? "");
  const ready = a !== "" && b !== "" && Number(a) !== Number(b);

  return (
    <form
      className="score-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        if (ready) await onSave(Number(a), Number(b));
      }}
    >
      <label>
        <span>{nameA}</span>
        <input inputMode="numeric" pattern="[0-9]*" maxLength={2} value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ""))} aria-label={`${nameA} score`} placeholder="0" />
      </label>
      <label>
        <span>{nameB}</span>
        <input inputMode="numeric" pattern="[0-9]*" maxLength={2} value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ""))} aria-label={`${nameB} score`} placeholder="0" />
      </label>
      <div className="score-editor-actions">
        <button type="submit" className="btn btn-primary btn-sm" disabled={!ready || busy}>
          Save
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
