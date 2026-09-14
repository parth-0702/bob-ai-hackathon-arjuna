/**
 * PortSentinel Nexus — Port State Service
 *
 * Loads the simulated operational snapshot and assembles it into a
 * typed PortState root object. This is the single integration point
 * for all downstream routes.
 *
 * Later phases will replace the import of simulatedData with calls
 * to an ML inference layer, a weather API, and optional middleware.
 * The route layer should never reach into simulatedData directly.
 *
 * ⚠  ALL DATA IS SIMULATED.
 */

import type { PortState } from "../types/portTypes.js";
import {
  simulatedAssets,
  simulatedBerths,
  simulatedCranes,
  simulatedOperations,
  simulatedVessels,
} from "../data/simulatedData.js";

/**
 * Returns a fresh deep-clone of the current simulated port state.
 * The snapshot timestamp is set to the moment of the call so callers
 * always receive a timestamped response.
 */
export function getPortState(): PortState {
  return {
    snapshotAt: new Date().toISOString(),
    dataSource: "SIMULATED",
    portName: "Deendayal Port (Kandla)",
    coordinates: { lat: 23.03, lon: 70.22 },
    assets: structuredClone(simulatedAssets),
    cranes: structuredClone(simulatedCranes),
    berths: structuredClone(simulatedBerths),
    vessels: structuredClone(simulatedVessels),
    operations: structuredClone(simulatedOperations),
  };
}

/**
 * Summary statistics derived from the port state — useful for the
 * health / status endpoint without sending the full payload.
 */
export function getPortSummary() {
  const state = getPortState();
  return {
    snapshotAt: state.snapshotAt,
    dataSource: state.dataSource,
    portName: state.portName,
    counts: {
      assets: state.assets.length,
      cranes: state.cranes.length,
      berths: state.berths.length,
      vessels: state.vessels.length,
      operations: state.operations.length,
    },
    berthsAtRisk: state.berths.filter((b) => b.status === "At risk").length,
    assetsAtRisk: state.assets.filter((a) => a.status === "At risk").length,
    activeAlerts: state.vessels.filter((v) => v.hasActiveAlert).length,
    delayedOperations: state.operations.filter(
      (o) => o.status === "Delayed"
    ).length,
  };
}
