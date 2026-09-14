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
export default function WeatherPanel({
  setSelected,
}: {
  setSelected: (id: string) => void;
}) {
  return (
    <>
      <article className="weather-banner">
        <div>
          <div className="eyebrow">KANDLA CREEK / DEMO FORECAST</div>
          <h2>
            A calm start.
            <br />A changing afternoon.
          </h2>
          <p>
            Conditions are stable in this scenario. Southwesterly winds
            strengthen over the next 8 hours, with moderate rainfall later. Plan
            inspections of exposed power equipment before the weather window
            narrows.
          </p>
        </div>
        <div className="weather-illustration">
          <CloudSun size={96} strokeWidth={0.7} />
          <b>
            31°<span>Partly cloudy</span>
          </b>
        </div>
      </article>
      <div className="weather-metrics">
        {[
          ["Wind", "SW 14 kn"],
          ["Rainfall", "0.2 mm"],
          ["Visibility", "8 km"],
          ["Humidity", "76%"],
        ].map(([a, b]) => (
          <article className="panel" key={a}>
            <span>{a}</span>
            <h2>{b}</h2>
          </article>
        ))}
      </div>
      <article className="panel">
        <div className="section-heading">
          <h2>Next 24 hours</h2>
          <span>Illustrative forecast · not a weather advisory</span>
        </div>
        <div className="weather-hours">
          {["Now", "+4h", "+8h", "+12h", "+18h", "+24h"].map((t, i) => (
            <div key={t}>
              <small>{t}</small>
              {i < 2 ? <CloudSun /> : <Wind />}
              <b>{[31, 33, 30, 28, 27, 29][i]}°</b>
              <span>{[14, 18, 24, 27, 21, 16][i]} kn SW</span>
              <small>{[0, 10, 55, 75, 40, 20][i]}% rain</small>
            </div>
          ))}
        </div>
      </article>
      <div className="section-heading">
        <h2>Infrastructure to watch</h2>
        <span>Weather → exposure → operational impact</span>
      </div>
      <div className="solution-grid">
        {[
          [
            "C07",
            "Exposed crane operations",
            "Increasing wind may limit safe lifting windows.",
          ],
          [
            "P03",
            "East quay power supply",
            "Rain exposure may compound the existing equipment risk.",
          ],
          [
            "R01",
            "Reefer continuity",
            "Check backup supply availability before the afternoon window.",
          ],
        ].map(([id, title, desc]) => (
          <button
            className="solution-card"
            key={id}
            onClick={() => setSelected(id)}
          >
            <Badge tone="amber">{id} · MONITOR</Badge>
            <h3>{title}</h3>
            <p>{desc}</p>
            <footer>
              Inspect asset <ArrowRight size={16} />
            </footer>
          </button>
        ))}
      </div>
    </>
  );
}
