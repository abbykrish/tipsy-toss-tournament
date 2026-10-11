import { useState } from "react";
import { formatPhone } from "../../shared/tournament";
import type { Player, Team } from "../../shared/types";
import { api } from "../api";
import { SignupForm } from "../components/SignupForm";
import type { AdminTabProps } from "./AdminPage";

export function EntrantsTab({ state, busy, run, refresh }: AdminTabProps) {
  const freeAgents = state.freeAgents ?? [];
  const [picked, setPicked] = useState<number[]>([]);
  const [pairName, setPairName] = useState("");
  const scheduled = new Set(state.matches.flatMap((m) => [m.teamA, m.teamB]));
  const selected = picked.filter((id) => freeAgents.some((p) => p.id === id));
  const playerCount = state.teams.reduce((n, t) => n + t.players.length, 0) + freeAgents.length;

  const toggle = (id: number) =>
    setPicked((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-2)));

  return (
    <div className="admin-entrants">
      <div className="stat-row">
        <div className="stat">
          <strong>{state.teams.length}</strong> teams
        </div>
        <div className="stat">
          <strong>{freeAgents.length}</strong> free agents
        </div>
        <div className="stat">
          <strong>{playerCount}</strong> players
        </div>
      </div>

      <div className="admin-columns">
        <section className="card">
          <h2>Free agents</h2>
          {freeAgents.length === 0 ? (
            <p className="empty">No one waiting on a partner.</p>
          ) : (
            <>
              <p className="muted">Pick two people to make them a team.</p>
              <ul className="agent-list">
                {freeAgents.map((p) => (
                  <li key={p.id} className={selected.includes(p.id) ? "is-picked" : ""}>
                    <label className="agent-pick">
                      <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
                    </label>
                    <PlayerLine player={p} run={run} busy={busy} />
                  </li>
                ))}
              </ul>
              {selected.length === 2 && (
                <form
                  className="pair-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const ok = await run(() => api.admin.pair(selected, pairName || undefined), "Team created");
                    if (ok) {
                      setPicked([]);
                      setPairName("");
                    }
                  }}
                >
                  <input
                    value={pairName}
                    onChange={(e) => setPairName(e.target.value)}
                    placeholder={`Team name (default: ${defaultName(selected.map((id) => freeAgents.find((p) => p.id === id)!))})`}
                    maxLength={40}
                  />
                  <button className="btn btn-primary" disabled={busy}>
                    Make team
                  </button>
                </form>
              )}
              {freeAgents.length >= 2 && (
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Randomly pair all ${freeAgents.length} free agents?`)) {
                      run(() => api.admin.autoPair(), "Free agents paired up");
                    }
                  }}
                >
                  Randomly pair everyone
                </button>
              )}
            </>
          )}
        </section>

        <section className="card">
          <h2>Add a walk-up</h2>
          <p className="muted">Same dedupe rules as the public form.</p>
          <SignupForm compact submit={api.admin.addEntrant} onDone={refresh} />
        </section>
      </div>

      <section className="card">
        <h2>Teams</h2>
        {state.teams.length === 0 && <p className="empty">No teams yet.</p>}
        <ul className="team-list">
          {state.teams.map((t) => (
            <TeamRow key={t.id} team={t} locked={scheduled.has(t.id)} run={run} busy={busy} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function defaultName(players: Player[]) {
  return players.map((p) => p.name.split(" ")[0]).join(" & ");
}

function TeamRow({ team, locked, run, busy }: { team: Team; locked: boolean } & Pick<AdminTabProps, "run" | "busy">) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(team.name);
  const lockedNote = locked ? "Already on the schedule" : undefined;

  return (
    <li className="team-row">
      <div className="team-row-head">
        {renaming ? (
          <form
            className="inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => api.admin.renameTeam(team.id, name), "Renamed")) setRenaming(false);
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus />
            <button className="btn btn-sm btn-primary" disabled={busy}>
              Save
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRenaming(false)}>
              Cancel
            </button>
          </form>
        ) : (
          <h3>
            {team.seed !== null && <span className="seed-pill">#{team.seed}</span>}
            {team.name}
          </h3>
        )}
        <div className="row-actions">
          {!renaming && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                setName(team.name);
                setRenaming(true);
              }}
            >
              Rename
            </button>
          )}
          <button
            className="btn btn-sm btn-ghost"
            disabled={busy || locked}
            title={lockedNote}
            onClick={() => {
              if (window.confirm(`Split up ${team.name}? Both players go back to free agents.`)) {
                run(() => api.admin.splitTeam(team.id), "Team split");
              }
            }}
          >
            Split
          </button>
          <button
            className="btn btn-sm btn-danger"
            disabled={busy || locked}
            title={lockedNote}
            onClick={() => {
              if (window.confirm(`Remove ${team.name} and both players from the tournament?`)) {
                run(() => api.admin.deleteTeam(team.id), "Team removed");
              }
            }}
          >
            Remove
          </button>
        </div>
      </div>
      <ul className="team-players">
        {team.players.map((p) => (
          <li key={p.id}>
            <PlayerLine player={p} run={run} busy={busy} canDelete={!locked} />
          </li>
        ))}
      </ul>
    </li>
  );
}

function PlayerLine({
  player,
  run,
  busy,
  canDelete = true,
}: { player: Player; canDelete?: boolean } & Pick<AdminTabProps, "run" | "busy">) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player.name);
  const [phone, setPhone] = useState(player.phone ?? "");

  if (editing) {
    return (
      <form
        className="inline-form player-edit"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api.admin.updatePlayer(player.id, name, phone), "Saved")) setEditing(false);
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" maxLength={60} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Phone" type="tel" />
        <button className="btn btn-sm btn-primary" disabled={busy}>
          Save
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="player-line">
      <span className="player-name">{player.name}</span>
      {player.phone && (
        <a className="player-phone" href={`tel:${player.phone}`}>
          {formatPhone(player.phone)}
        </a>
      )}
      <span className="row-actions">
        <button
          className="link-btn"
          onClick={() => {
            setName(player.name);
            setPhone(player.phone ?? "");
            setEditing(true);
          }}
        >
          edit
        </button>
        {canDelete && (
          <button
            className="link-btn danger"
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Remove ${player.name}? If they're on a team, their partner becomes a free agent.`)) {
                run(() => api.admin.deletePlayer(player.id), "Removed");
              }
            }}
          >
            remove
          </button>
        )}
      </span>
    </div>
  );
}
