import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Clock,
  CloudSun,
  ShieldCheck,
  Wind,
} from "lucide-react";
import { Badge, Forecast } from "./OperationalUI";
import { solutions, type Snapshot } from "../services/portService";
export default function CongestionPanel({
  data,
  horizon,
  setHorizon,
  setSelected,
}: {
  data: Snapshot;
  horizon: number;
  setHorizon: (h: number) => void;
  setSelected: (id: string) => void;
}) {
  return (
    <>
      <div className="summary-row">
        <div>
          <span>Port congestion</span>
          <b>
            48<small>% current</small>
          </b>
        </div>
        <div>
          <span>Peak in next 24h</span>
          <b>
            82<small>% estimated</small>
          </b>
        </div>
        <div>
          <span>Vessels waiting</span>
          <b>
            02<small>at anchorage</small>
          </b>
        </div>
        <div>
          <span>Average delay</span>
          <b>
            1.4<small>hours</small>
          </b>
        </div>
      </div>
      <article className="panel">
        <div className="section-heading">
          <div>
            <h2>Pressure over time</h2>
            <p>
              Baseline versus the proposed crane reassignment · demo scenario
            </p>
          </div>
          <div className="segmented">
            {[6, 12, 24, 48].map((h) => (
              <button
                className={(horizon || 24) === h ? "active" : ""}
                key={h}
                onClick={() => setHorizon(h)}
              >
                {h}h
              </button>
            ))}
          </div>
        </div>
        <Forecast horizon={horizon || 24} />
      </article>
      <div className="section-heading">
        <h2>Berth-level outlook</h2>
        <Badge tone="neutral">SIMULATED FORECAST</Badge>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Berth</th>
              <th>Congestion</th>
              <th>Utilization</th>
              <th>Queue</th>
              <th>Expected delay</th>
              <th>Crane impact</th>
            </tr>
          </thead>
          <tbody>
            {data.registers.Berths.map((b, i) => (
              <tr key={b.id} onClick={() => setSelected(b.id)}>
                <td>
                  <button
                    className="table-link"
                    onClick={() => setSelected(b.id)}
                  >
                    {b.id} · {b.name}
                  </button>
                </td>
                <td>
                  <div className="meter">
                    <i style={{ width: `${[24, 48, 82, 18][i % 4]}%` }} />
                  </div>
                  {[24, 48, 82, 18][i % 4]}%
                </td>
                <td>{b.workload}%</td>
                <td>{[1, 2, 5, 0][i % 4]}</td>
                <td>{["+10m", "+35m", "+3.2h", "On schedule"][i % 4]}</td>
                <td>
                  {i === 2 ? (
                    <Badge tone="amber">C07 restricted</Badge>
                  ) : (
                    "Capacity available"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.registers.Berths.length && (
          <div className="empty-inline">
            No berths available. Configure berths to see the outlook.
          </div>
        )}
      </div>
    </>
  );
}
