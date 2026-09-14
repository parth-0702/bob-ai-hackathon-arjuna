/**
 * PortSentinel Nexus — Backend Entry Point
 *
 * Minimal Express server.
 * Phase 2 adds real Kandla weather from Open-Meteo (no API key required).
 *
 * Future phases will add:
 *   ✅ Weather API integration (Phase 2 — Open-Meteo)
 *   - Model 1 (failure-risk) .pkl endpoint
 *   - Model 2 (congestion prediction)
 *   - LLM-backed recommendation engine
 *   - Scenario engine
 */

import express from "express";
import cors from "cors";
import portRoutes from "./routes/portRoutes.js";
import weatherRoutes from "./routes/weatherRoutes.js";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json());

// Allow the Vite dev server (default :5173) to call the backend during dev.
// In production both will be on the same origin or behind a reverse-proxy.
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
    ],
    methods: ["GET"],
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use("/api", portRoutes);
app.use("/api/weather", weatherRoutes);

// Root — developer convenience
app.get("/", (_req, res) => {
  res.json({
    service: "PortSentinel Nexus Backend",
    version: "0.1.0",
    phase: "Phase 2 — Simulated data + real Kandla weather (Open-Meteo)",
    environment: "simulation",
    endpoints: [
      "GET /api/health",
      "GET /api/port-summary",
      "GET /api/port-state",
      "GET /api/assets",
      "GET /api/cranes",
      "GET /api/berths",
      "GET /api/vessels",
      "GET /api/operations",
      "GET /api/weather",
      "GET /api/weather/stress",
    ],
    note: "⚠ All operational data is SIMULATED. No real port telemetry connected.",
  });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(
    `\n✅  PortSentinel Nexus backend running on http://localhost:${PORT}`
  );
  console.log(`   ⚠  Environment : SIMULATION — no live terminal data`);
  console.log(`   📡  Port state  : http://localhost:${PORT}/api/port-state`);
  console.log(`   🏥  Health      : http://localhost:${PORT}/api/health`);
  console.log(`   🌦  Weather     : http://localhost:${PORT}/api/weather`);
  console.log(`   📊  Stress      : http://localhost:${PORT}/api/weather/stress\n`);
});

export default app;
