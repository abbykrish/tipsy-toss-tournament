import { useEffect, useState } from "react";
import type { TournamentState } from "../../shared/types";
import { api, HttpError } from "../api";
import { useTeamMap } from "../pages/useTeamMap";
import { useTournament } from "../useTournament";
import { BracketTab } from "./BracketTab";
import { EntrantsTab } from "./EntrantsTab";
import { PrelimsTab } from "./PrelimsTab";

const TABS = [
  { id: "entrants", label: "Entrants & teams", short: "Teams" },
  { id: "prelims", label: "Prelims & scores", short: "Scores" },
  { id: "bracket", label: "Seeding & bracket", short: "Bracket" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export interface AdminTabProps {
  state: TournamentState;
  teams: ReturnType<typeof useTeamMap>;
  busy: boolean;
  /** Runs a mutation, refreshes state, and surfaces errors. Resolves to whether it worked. */
  run: (action: () => Promise<unknown>, success?: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function AdminPage() {
  const { state, error, refresh } = useTournament(api.admin.state, 20_000);
  const teams = useTeamMap(state);
  const [tab, setTab] = useState<TabId>(() => (sessionStorage.getItem("admin-tab") as TabId) ?? "entrants");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => sessionStorage.setItem("admin-tab", tab), [tab]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.kind === "error" ? 6000 : 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  if (error instanceof HttpError && error.status === 401) return <Login onLogin={refresh} />;
  if (!state) return <div className="page-loading">{error ? error.message : "Loading…"}</div>;

  const run: AdminTabProps["run"] = async (action, success) => {
    setBusy(true);
    try {
      await action();
      if (success) setToast({ kind: "ok", text: success });
      return true;
    } catch (err) {
      setToast({ kind: "error", text: (err as Error).message });
      return false;
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const props: AdminTabProps = { state, teams, busy, run, refresh };

  return (
    <div className="admin">
      <div className="admin-head">
        <h1>Admin</h1>
        <button
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            await api.logout();
            await refresh();
          }}
        >
          Log out
        </button>
      </div>
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            <span className="tab-long">{t.label}</span>
            <span className="tab-short">{t.short}</span>
          </button>
        ))}
      </nav>
      {tab === "entrants" && <EntrantsTab {...props} />}
      {tab === "prelims" && <PrelimsTab {...props} />}
      {tab === "bracket" && <BracketTab {...props} />}
      {toast && (
        <div className={`toast toast-${toast.kind}`} role="status" onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

function Login({ onLogin }: { onLogin: () => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="login card">
      <h1>Admin</h1>
      <p className="muted">Organizers only.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api.login(password);
            await onLogin();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-lg" disabled={busy || !password}>
          Log in
        </button>
      </form>
    </div>
  );
}
