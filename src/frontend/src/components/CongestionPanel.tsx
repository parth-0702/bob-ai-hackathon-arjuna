import { Badge, Forecast } from "./OperationalUI";
import type { Snapshot } from "../services/portService";
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
  const c = data.report.congestion;
  const recommended = data.report.scenarios.find(
    (s) => s.id === data.report.recommended_id,
  );
  return (
    <>
      <div className="summary-row">
        <div>
          <span>Current congestion index</span>
          <b>
            {c.currentCongestion}
            <small>/ 100</small>
          </b>
        </div>
        <div>
          <span>Peak in 48h</span>
          <b>
            {c.peakCongestion}
            <small>/ 100</small>
          </b>
        </div>
        <div>
          <span>Vessels waiting</span>
          <b>
            {c.waitingVessels}
            <small>modeled queue</small>
          </b>
        </div>
        <div>
          <span>Average delay</span>
          <b>
            {c.averageDelayHours}
            <small>hours</small>
          </b>
        </div>
      </div>
      <article className="panel">
        <div className="section-heading">
          <div>
            <h2>Pressure over time</h2>
            <p>Backend queue simulation · baseline and recommended response</p>
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
        <Forecast
          horizon={horizon || 24}
          series={c.series}
          response={recommended?.series}
        />
        <p className="fine-print">
          {c.basis}{" "}
          {c.delayIsLowerBound
            ? "Unavailable capacity creates delays censored at the 48-hour horizon; displayed aggregate delay is a lower bound."
            : ""}
        </p>
      </article>
      <div className="section-heading">
        <h2>Berth-level outlook</h2>
        <Badge tone="neutral">BACKEND SIMULATION</Badge>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Berth</th>
              <th>Demand/capacity</th>
              <th>Utilization</th>
              <th>Queue now</th>
              <th>Average delay</th>
              <th>Handling resources</th>
            </tr>
          </thead>
          <tbody>
            {c.berths.map((b) => (
              <tr key={b.id}>
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
                    <i style={{ width: `${b.congestion}%` }} />
                  </div>
                  {b.congestion}%
                </td>
                <td>{b.utilization}%</td>
                <td>{b.queue}</td>
                <td>{b.delay}h</td>
                <td>
                  {b.cranes.join(", ") || "No available cranes"}
                  <small className="cell-note">
                    {b.capacity} cargo units/h
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!c.berths.length && (
          <div className="empty-inline">No berths configured.</div>
        )}
      </div>
      <p className="fine-print">
        Weather derating:{" "}
        {c.weatherApplied
          ? "external current weather applied"
          : "unavailable; neutral weather factor explicitly assumed"}
        . Per-berth demand/capacity and the port queue index are different
        metrics.
      </p>
    </>
  );
}
