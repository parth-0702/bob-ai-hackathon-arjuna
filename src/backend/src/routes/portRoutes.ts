/**
 * PortSentinel Nexus — API Routes
 *
 * GET /api/health       — liveness / readiness check
 * GET /api/port-state   — full simulated operational snapshot
 * GET /api/port-summary — lightweight stats (no entity arrays)
 */

import { Router, type Request, type Response } from "express";
import { getPortState, getPortSummary } from "../services/portStateService.js";

const router = Router();

// ─── Health ───────────────────────────────────────────────────────────────────

router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "portsentinel-nexus-backend",
    version: "0.1.0",
    environment: "simulation",
    dataSource: "SIMULATED",
    note: "No live terminal, SCADA, or AIS connection. All operational data is simulated.",
    timestamp: new Date().toISOString(),
  });
});

// ─── Port summary (lightweight) ───────────────────────────────────────────────

router.get("/port-summary", (_req: Request, res: Response) => {
  res.json(getPortSummary());
});

// ─── Full port state ─────────────────────────────────────────────────────────

router.get("/port-state", (_req: Request, res: Response) => {
  res.json(getPortState());
});

// ─── Per-entity convenience endpoints ────────────────────────────────────────

router.get("/assets", (_req: Request, res: Response) => {
  res.json(getPortState().assets);
});

router.get("/cranes", (_req: Request, res: Response) => {
  res.json(getPortState().cranes);
});

router.get("/berths", (_req: Request, res: Response) => {
  res.json(getPortState().berths);
});

router.get("/vessels", (_req: Request, res: Response) => {
  res.json(getPortState().vessels);
});

router.get("/operations", (_req: Request, res: Response) => {
  res.json(getPortState().operations);
});

export default router;
