import { CloudSun, Wind, ArrowRight, RefreshCw } from "lucide-react";
import { Badge } from "./OperationalUI";
import type { Weather } from "../services/portService";
export default function WeatherPanel({
  weather,
  setSelected,
  onRefresh,
}: {
  weather: Weather;
  setSelected: (id: string) => void;
  onRefresh: () => void;
}) {
  const current = weather.current;
  return (
    <>
      <div className="section-heading">
        <Badge tone={weather.status === "available" ? "green" : "amber"}>
          {weather.status.toUpperCase()} · {weather.source}
        </Badge>
        <button className="btn" onClick={onRefresh}>
          <RefreshCw size={14} />
          Refresh weather
        </button>
      </div>
      {!current ? (
        <article className="panel">
          <h2>Live weather unavailable</h2>
          <p>{weather.error || weather.summary}</p>
          <p className="fine-print">
            No simulated readings have been substituted.
          </p>
        </article>
      ) : (
        <>
          <article className="weather-banner">
            <div>
              <div className="eyebrow">
                KANDLA CREEK / EXTERNAL WEATHER MODEL
              </div>
              <h2>
                {current.condition}.<br />
                Plan around the conditions.
              </h2>
              <p>{weather.summary}</p>
              <small className="fine-print">
                Provider time: {new Date(current.time).toLocaleString()} ·{" "}
                {weather.stale
                  ? "STALE SNAPSHOT"
                  : "Open-Meteo modeled conditions"}
              </small>
            </div>
            <div className="weather-illustration">
              <CloudSun size={96} strokeWidth={0.7} />
              <b>
                {Math.round(current.temperature)}°
                <span>{current.condition}</span>
              </b>
            </div>
          </article>
          <div className="weather-metrics">
            {[
              [
                "Wind",
                `${current.windDirectionLabel || ""} ${current.windKnots} kn`,
              ],
              ["Rainfall", `${current.rainfall} mm`],
              ["Visibility", `${current.visibilityKm} km`],
              ["Humidity", `${current.humidity}%`],
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
              <span>External forecast · hourly precipitation</span>
            </div>
            <div className="weather-hours">
              {weather.forecast
                .filter((_, i) => [0, 4, 8, 12, 18, 24].includes(i))
                .map((p) => (
                  <div key={p.time}>
                    <small>
                      {new Date(p.time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                    {p.rainfall > 0 ? <Wind /> : <CloudSun />}
                    <b>{Math.round(p.temperature)}°</b>
                    <span>{p.windKnots} kn</span>
                    <small>{p.rainProbability ?? "—"}% rain</small>
                  </div>
                ))}
            </div>
          </article>
        </>
      )}
      <div className="section-heading">
        <h2>Operational exposure</h2>
        <span>Weather → equipment → handling capacity</span>
      </div>
      {weather.severe.length ? (
        <div className="panel">
          {weather.severe.map((s) => (
            <p key={s}>{s}</p>
          ))}
        </div>
      ) : (
        <p className="fine-print">
          {current
            ? "No configured severe-weather threshold is crossed."
            : "Exposure assessment is unavailable without weather data."}
        </p>
      )}
      <div className="solution-grid">
        {weather.affectedAssets.map((id) => (
          <button
            className="solution-card"
            key={id}
            onClick={() => setSelected(id)}
          >
            <Badge tone="amber">{id} · MONITOR</Badge>
            <h3>Review weather exposure</h3>
            <p>
              Check availability, dependencies and local equipment operating
              limits.
            </p>
            <footer>
              Inspect asset <ArrowRight size={16} />
            </footer>
          </button>
        ))}
      </div>
      <p className="fine-print">
        Weather data:{" "}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>{" "}
        · CC BY 4.0. These are weather-model values, not on-site port sensors.
      </p>
    </>
  );
}
