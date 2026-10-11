import { api } from "../api";
import { SignupForm } from "../components/SignupForm";
import { TossScene } from "../components/TossScene";
import { PARTIFUL_URL, RULES_VIDEO_EMBED, RULES_VIDEO_URL } from "../links";
import { Link } from "../router";
import { useTournament } from "../useTournament";

export function HomePage() {
  const { state, refresh } = useTournament(api.state);
  const hasStarted = Boolean(state?.matches.length);

  return (
    <>
      <section className="hero">
        <h1>
          The Tipsy Toss <span className="nowrap">Tournament <span className="badge-num">#2</span></span>
        </h1>
        <p className="hero-meta">
          <span>Sat, Oct 17</span>
          <span>Starts at 3pm</span>
          {hasStarted && (
            <Link href="/live" className="text-link">
              Live bracket →
            </Link>
          )}
          <a href={PARTIFUL_URL} className="text-link" target="_blank" rel="noreferrer">
            Partiful for updates ↗
          </a>
        </p>
        <div className="hero-scene">
          <TossScene />
        </div>
      </section>

      <section id="signup" className="signup card">
        <div className="signup-intro">
          <h2>Sign up</h2>
          <p>Got a partner? Sign up as a team. Flying solo? Sign up as a free agent and you'll get paired with someone.</p>
        </div>
        <div className="signup-details">
          <ul className="checklist">
            <li>Teams of 2</li>
            <li>One signup per phone number</li>
            <li>Found a partner after signing up solo? Have them sign up the team with your number.</li>
          </ul>
          <p className="fine-print">
            Phone numbers are only used to avoid duplicate signups and reach you on game day. They're never shown on the
            site.
          </p>
        </div>
        <SignupForm submit={api.signup} onDone={refresh} />
      </section>

      <section className="facts">
        <article className="fact">
          <div className="fact-big">3pm</div>
          <h3>Tournament starts at 3</h3>
          <p>Saturday, October 17. First tosses fly at 3:00 sharp.</p>
        </article>
        <article className="fact fact-hot">
          <div className="fact-big">11</div>
          <h3>Shorter this year</h3>
          <p>
            Every game is played to <strong>11 points</strong> instead of 21. Only the final goes the full 21.
          </p>
        </article>
        <article className="fact">
          <div className="fact-big">2</div>
          <h3>Prelim rounds, then a bracket</h3>
          <p>
            Everyone plays 2 prelim rounds. Results set the seeding for a single-elimination bracket – if we're short of
            16 teams, the top seeds earn a first-round bye.
          </p>
        </article>
      </section>

      <section className="rules card">
        <div className="rules-copy">
          <h2>New to tipsy toss?</h2>
          <p>Two poles, a bottle on each, a frisbee, and a lot of yelling. Watch the rules before you show up.</p>
          <div className="stack-sm">
            <a href={RULES_VIDEO_URL} className="btn" target="_blank" rel="noreferrer">
              Watch on YouTube ↗
            </a>
            <a href={PARTIFUL_URL} className="text-link" target="_blank" rel="noreferrer">
              Event details & updates on Partiful ↗
            </a>
          </div>
        </div>
        <div className="video">
          <iframe
            src={RULES_VIDEO_EMBED}
            title="Tipsy toss rules"
            loading="lazy"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </section>

      <section className="whos-in">
        <div className="section-head">
          <h2>Who's in</h2>
          {state && (
            <p className="muted">
              {state.teams.length} {state.teams.length === 1 ? "team" : "teams"}
              {state.freeAgentCount > 0 &&
                ` · ${state.freeAgentCount} free ${state.freeAgentCount === 1 ? "agent" : "agents"} looking for a partner`}
            </p>
          )}
        </div>
        {state && state.teams.length === 0 && <p className="empty">Nobody yet – be the first!</p>}
        <ul className="team-chips">
          {state?.teams.map((t) => (
            <li key={t.id}>
              <strong>{t.name}</strong>
              <span>{t.players.map((p) => p.name).join(" & ")}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
