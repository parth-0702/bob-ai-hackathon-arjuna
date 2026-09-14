/**
 * PortSentinel Nexus — Weather API Routes
 *
 * GET /api/weather        — full normalized Open-Meteo response for Kandla
 * GET /api/weather/stress — deterministic weather stress index + impacts
 *
 * Error policy: if Open-Meteo is unavailable, returns HTTP 503 with a
 * structured error body. Never substitutes fake/simulated weather data.
 */

import { Router, type Request, type Response } from "express";
import {
  fetchWeather,
  calculateWeatherStress,
  WeatherFetchError,
} from "../services/weatherService.js";

const router = Router();

// ─── GET /api/weather ─────────────────────────────────────────────────────────

router.get("/", async (_req: Request, res: Response) => {
  try {
    const weather = await fetchWeather();
    res.json(weather);
  } catch (err) {
    if (err instanceof WeatherFetchError) {
      res.status(503).json({
        error: true,
        message: err.message,
        source: "open-meteo",
        note: "Real weather data is temporarily unavailable. No simulated fallback is provided.",
        fetchedAt: err.fetchedAt,
      });
    } else {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: true, message: msg });
    }
  }
});

// ─── GET /api/weather/stress ──────────────────────────────────────────────────

router.get("/stress", async (_req: Request, res: Response) => {
  try {
    const weather = await fetchWeather();
    const stress = calculateWeatherStress(weather.current);
    res.json(stress);
  } catch (err) {
    if (err instanceof WeatherFetchError) {
      res.status(503).json({
        error: true,
        message: err.message,
        source: "open-meteo",
        note: "Cannot calculate stress index without real weather data. No simulated fallback is provided.",
        fetchedAt: err.fetchedAt,
      });
    } else {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: true, message: msg });
    }
  }
});

export default router;
