import type { Standing, Team } from "../../shared/types";

interface Props {
  standings: Standing[];
  teams: Map<number, Team>;
}

export function Standings({ standings, teams }: Props) {
  if (!standings.length) return <p className="empty">No teams yet.</p>;
  return (
    <div className="table-wrap">
      <table className="standings">
        <thead>
          <tr>
            <th>#</th>
            <th className="left">Team</th>
            <th title="Wins – losses">W–L</th>
            <th title="Point differential">+/–</th>
            <th title="Points scored">PF</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            const diff = s.pointsFor - s.pointsAgainst;
            return (
              <tr key={s.teamId}>
                <td className="rank">{i + 1}</td>
                <td className="left">
                  {teams.get(s.teamId)?.name}
                  {s.byes > 0 && <span className="tag">bye</span>}
                </td>
                <td>
                  {s.wins}–{s.losses}
                </td>
                <td className={diff > 0 ? "pos" : diff < 0 ? "neg" : ""}>{diff > 0 ? `+${diff}` : diff}</td>
                <td>{s.pointsFor}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="fine-print">
        Ranked by wins, then point differential, then points scored. A bye counts as a win.
      </p>
    </div>
  );
}
