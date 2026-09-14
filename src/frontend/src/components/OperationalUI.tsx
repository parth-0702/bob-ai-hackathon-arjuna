import type React from "react";
import { solutions } from "../services/portService";
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
  solutionId = "S1",
}: {
  horizon?: number;
  solutionId?: string;
}) {
  const baseline = [48, 52, 61, 70, 82, 76, 68, 62, 58];
  const reduction =
    solutions.find((s) => s.id === solutionId)?.congestion || 31;
  const count = Math.max(2, Math.round(horizon / 6) + 1),
    values = baseline.slice(0, count);
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 600},${155 - v * 1.45}`)
    .join(" ");
  const response = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1)) * 600},${155 - (v - reduction * Math.min(1, i / 2)) * 1.45}`,
    )
    .join(" ");
  return (
    <div className="forecast">
      <div className="chart-grid">
        <svg
          viewBox="0 0 600 155"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Illustrative ${horizon}-hour congestion outlook; baseline peak ${Math.max(...values)} percent`}
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
          <polyline
            points={response}
            fill="none"
            stroke="#31816c"
            strokeWidth="2"
            strokeDasharray="6 5"
            strokeLinejoin="round"
          />
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
          Baseline congestion
        </span>
        <span>
          <i className="dot" />
          With proposed response
        </span>
      </div>
    </div>
  );
}
