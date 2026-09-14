import type React from "react";
import type { Point } from "../services/portService";
export function Badge({
  children,
  tone = "green",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Forecast({
  horizon = 24,
  series = [],
  response = [],
}: {
  horizon?: number;
  series?: Point[];
  response?: Point[];
}) {
  const values = series.filter((p) => p.hour <= horizon);
  const alternatives = response.filter((p) => p.hour <= horizon);
  if (!values.length)
    return <p className="fine-print">No forecast available.</p>;
  const points = values
    .map((p) => `${(p.hour / horizon) * 600},${155 - p.congestion * 1.45}`)
    .join(" ");
  const other = alternatives
    .map((p) => `${(p.hour / horizon) * 600},${155 - p.congestion * 1.45}`)
    .join(" ");
  return (
    <div className="forecast">
      <div className="chart-grid">
        <svg
          viewBox="0 0 600 155"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Backend ${horizon}-hour congestion outlook; peak ${Math.max(...values.map((p) => p.congestion))} out of 100`}
        >
          {[25, 65, 105, 145].map((y) => (
            <line
              key={y}
              x1="0"
              x2="600"
              y1={y}
              y2={y}
              stroke="#dce2dc"
              strokeDasharray="4 5"
            />
          ))}
          <polygon points={`0,155 ${points} 600,155`} fill="#b18a4314" />
          <polyline
            points={points}
            fill="none"
            stroke="#b18a43"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {other && (
            <polyline
              points={other}
              fill="none"
              stroke="#31816c"
              strokeWidth="2"
              strokeDasharray="6 5"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>
      <div className="axis">
        <span>NOW</span>
        <span>+{horizon / 4}H</span>
        <span>+{horizon / 2}H</span>
        <span>+{(horizon * 3) / 4}H</span>
        <span>+{horizon}H</span>
      </div>
      <div className="chart-legend">
        <span>
          <i className="dot amber" />
          Backend baseline
        </span>
        {other && (
          <span>
            <i className="dot" />
            Selected response
          </span>
        )}
      </div>
    </div>
  );
}
